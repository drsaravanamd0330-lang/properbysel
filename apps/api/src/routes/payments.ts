import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { AppContext } from "../context";
import { requireUser, requireRole, isStaff } from "../lib/auth";
import { HttpError, notFound, forbidden } from "../lib/errors";
import { SandboxProvider, type PaymentEvent } from "../lib/payments";
import { isFlagOn, processPaymentEvent, taxFor } from "../lib/billing";
import { audit } from "../lib/audit";

const orderCreateSchema = z.object({ planCode: z.string().min(1).max(60), listingId: z.string().min(1).max(40).optional() });

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const rupees = (p: bigint | number) => `₹${(Number(p) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const planOut = (p: { code: string; name: string; description: string; kind: string; pricePaise: bigint; gstRateBps: number; durationDays: number; listingQuota: number | null }) => ({
  code: p.code, name: p.name, description: p.description, kind: p.kind, pricePaise: p.pricePaise,
  taxPaise: taxFor(p.pricePaise, p.gstRateBps), totalPaise: p.pricePaise + taxFor(p.pricePaise, p.gstRateBps),
  gstRateBps: p.gstRateBps, durationDays: p.durationDays, listingQuota: p.listingQuota,
});

export async function paymentRoutes(app: FastifyInstance, ctx: AppContext) {
  const { db, cfg } = ctx;

  /** Allow only our own web origins or the app scheme as post-checkout destinations (no open redirect). */
  function safeReturn(url: string | undefined, orderId: string) {
    const fallback = `${cfg.WEB_ORIGIN.split(",")[0]}/dashboard/orders/${orderId}`;
    if (!url) return fallback;
    if (url.startsWith("properbysel://")) return url;
    try {
      const u = new URL(url);
      return cfg.WEB_ORIGIN.split(",").includes(u.origin) ? u.toString() : fallback;
    } catch { return fallback; }
  }

  app.get("/v1/plans", async () => {
    const plans = await db.plan.findMany({ where: { isActive: true }, orderBy: [{ kind: "asc" }, { pricePaise: "asc" }] });
    const visible = [];
    for (const p of plans) if (await isFlagOn(db, p.featureFlag)) visible.push(planOut(p));
    return { items: visible };
  });

  app.post("/v1/orders", async (req, reply) => {
    const u = requireUser(req);
    const body = orderCreateSchema.parse(req.body);
    const plan = await db.plan.findUnique({ where: { code: body.planCode } });
    if (!plan || !plan.isActive || !(await isFlagOn(db, plan.featureFlag))) throw notFound("Plan");
    if (plan.kind === "FEATURED_LISTING") {
      if (!body.listingId) throw new HttpError(400, "LISTING_REQUIRED", "Choose the listing to feature");
      const l = await db.listing.findUnique({ where: { id: body.listingId } });
      if (!l || l.ownerId !== u.id) throw notFound("Listing");
      if (l.status !== "PUBLISHED") throw new HttpError(409, "NOT_PUBLISHED", "Only live listings can be featured");
    }
    const taxPaise = taxFor(plan.pricePaise, plan.gstRateBps);
    const order = await db.order.create({ data: {
      userId: u.id, planId: plan.id, listingId: plan.kind === "FEATURED_LISTING" ? body.listingId : null,
      amountPaise: plan.pricePaise, taxPaise, totalPaise: plan.pricePaise + taxPaise, provider: ctx.payments.name,
    } });
    const co = await ctx.payments.createCheckout({ orderId: order.id, totalPaise: order.totalPaise, description: plan.name });
    const saved = await db.order.update({ where: { id: order.id }, data: { providerRef: co.providerRef, status: "PENDING" } });
    await audit(db, u.id, "order.created", "Order", order.id, { plan: plan.code });
    return reply.code(201).send({ order: orderOut(saved, plan), checkoutUrl: co.checkoutUrl, clientParams: co.clientParams ?? null, provider: ctx.payments.name });
  });

  const orderOut = (o: { id: string; status: string; amountPaise: bigint; taxPaise: bigint; totalPaise: bigint; invoiceNumber: string | null; listingId: string | null; createdAt: Date }, plan: { code: string; name: string; kind: string }, ent?: { startsAt: Date; endsAt: Date; revokedAt: Date | null } | null) => ({
    id: o.id, status: o.status, amountPaise: o.amountPaise, taxPaise: o.taxPaise, totalPaise: o.totalPaise, invoiceNumber: o.invoiceNumber,
    listingId: o.listingId, createdAt: o.createdAt, plan: { code: plan.code, name: plan.name, kind: plan.kind },
    entitlement: ent ? { startsAt: ent.startsAt, endsAt: ent.endsAt, revoked: !!ent.revokedAt } : null,
  });

  app.get("/v1/orders", async (req) => {
    const u = requireUser(req);
    const rows = await db.order.findMany({ where: { userId: u.id }, include: { plan: true, entitlement: true }, orderBy: { createdAt: "desc" }, take: 50 });
    return { items: rows.map((o) => orderOut(o, o.plan, o.entitlement)) };
  });

  app.get<{ Params: { id: string } }>("/v1/orders/:id", async (req) => {
    const u = requireUser(req);
    const o = await db.order.findUnique({ where: { id: req.params.id }, include: { plan: true, entitlement: true } });
    if (!o || (o.userId !== u.id && !isStaff(u))) throw notFound("Order");
    return orderOut(o, o.plan, o.entitlement);
  });

  app.get("/v1/me/entitlements", async (req) => {
    const u = requireUser(req);
    const now = new Date();
    const rows = await db.entitlement.findMany({ where: { userId: u.id, revokedAt: null, endsAt: { gt: now } }, include: { order: { include: { plan: true } } }, orderBy: { endsAt: "desc" } });
    return { items: rows.map((e) => ({ kind: e.kind, plan: e.order.plan.code, listingId: e.listingId, startsAt: e.startsAt, endsAt: e.endsAt, listingQuota: e.order.plan.listingQuota })) };
  });

  /** Printable receipt. Says "Tax invoice" only once a GSTIN is configured. */
  app.get<{ Params: { id: string } }>("/v1/orders/:id/receipt", async (req, reply) => {
    const u = requireUser(req);
    const o = await db.order.findUnique({ where: { id: req.params.id }, include: { plan: true, user: true } });
    if (!o || (o.userId !== u.id && !isStaff(u))) throw notFound("Order");
    if (!o.invoiceNumber) throw new HttpError(409, "NOT_PAID", "A receipt is available once payment is confirmed");
    const title = cfg.BUSINESS_GSTIN ? "Tax invoice" : "Payment receipt";
    const half = o.taxPaise / 2n;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${title} ${esc(o.invoiceNumber)}</title>
<style>body{font:14px system-ui,sans-serif;max-width:640px;margin:32px auto;color:#1a1a1a}table{width:100%;border-collapse:collapse}td{padding:6px 0;border-bottom:1px solid #eee}td:last-child{text-align:right}.muted{color:#666;font-size:12px}h1{font-size:20px}</style></head><body>
<h1>${title}</h1>
<p><strong>${esc(cfg.BUSINESS_LEGAL_NAME)}</strong>${cfg.BUSINESS_ADDRESS ? `<br>${esc(cfg.BUSINESS_ADDRESS)}` : ""}${cfg.BUSINESS_GSTIN ? `<br>GSTIN ${esc(cfg.BUSINESS_GSTIN)}` : ""}</p>
<p>Number: ${esc(o.invoiceNumber)}<br>Date: ${o.updatedAt.toISOString().slice(0, 10)}<br>Billed to: ${esc(o.user.name ?? "Customer")}<br>Status: ${o.status}</p>
<table><tr><td>${esc(o.plan.name)} (${o.plan.durationDays} days)</td><td>${rupees(o.amountPaise)}</td></tr>
<tr><td>CGST ${o.plan.gstRateBps / 200}%</td><td>${rupees(half)}</td></tr><tr><td>SGST ${o.plan.gstRateBps / 200}%</td><td>${rupees(o.taxPaise - half)}</td></tr>
<tr><td><strong>Total</strong></td><td><strong>${rupees(o.totalPaise)}</strong></td></tr></table>
<p class="muted">ProperBySel is a listing platform. This payment is for advertising services only, not for any property, deposit or brokerage. ${cfg.BUSINESS_GSTIN ? "" : "GST registration details pending: this is not a tax invoice."} ${o.provider === "sandbox" ? "SANDBOX: no real money was charged." : ""}</p>
</body></html>`;
    return reply.type("text/html; charset=utf-8").send(html);
  });

  // Provider webhook: raw body is required for signature verification, so JSON parsing is overridden in this scope only.
  await app.register(async (scope) => {
    scope.addContentTypeParser("application/json", { parseAs: "buffer" }, (_req, body, done) => done(null, body));
    scope.post<{ Params: { provider: string } }>("/v1/payments/webhook/:provider", async (req, reply) => {
      if (req.params.provider !== ctx.payments.name) throw notFound("Webhook");
      const raw = req.body as Buffer;
      if (!Buffer.isBuffer(raw)) throw new HttpError(400, "BAD_BODY", "Expected JSON body");
      let ev: PaymentEvent | null = null;
      try { ev = ctx.payments.verifyWebhook(raw, req.headers); } catch { ev = null; }
      if (!ev) return reply.code(400).send({ error: { code: "BAD_SIGNATURE", message: "Signature verification failed" } });
      const r = await processPaymentEvent(ctx, ev);
      return { ok: true, ...r };
    });
  });

  // Admin
  app.get<{ Querystring: { status?: string } }>("/v1/admin/orders", async (req) => {
    requireRole(req, "ADMIN");
    const status = req.query.status && ["CREATED", "PENDING", "PAID", "FAILED", "REFUNDED", "CANCELLED"].includes(req.query.status) ? req.query.status : undefined;
    const rows = await db.order.findMany({ where: status ? { status: status as never } : {}, include: { plan: true, user: { select: { id: true, name: true } }, entitlement: true }, orderBy: { createdAt: "desc" }, take: 100 });
    return { items: rows.map((o) => ({ ...orderOut(o, o.plan, o.entitlement), user: o.user, provider: o.provider })) };
  });

  app.post<{ Params: { id: string } }>("/v1/admin/orders/:id/refund", async (req) => {
    const admin = requireRole(req, "ADMIN");
    const o = await db.order.findUnique({ where: { id: req.params.id }, include: { payments: true } });
    if (!o) throw notFound("Order");
    if (o.status !== "PAID") throw new HttpError(409, "NOT_REFUNDABLE", "Only paid orders can be refunded");
    if (!(ctx.payments instanceof SandboxProvider)) {
      throw new HttpError(501, "REFUND_VIA_PROVIDER", "Issue the refund in the payment provider dashboard. The refund webhook will update this order.");
    }
    await audit(db, admin.id, "order.refund_requested", "Order", o.id, {});
    const ev: PaymentEvent = { eventId: `sbx_evt_refund_${o.id}`, type: "refund.processed", providerRef: o.providerRef!, paymentRef: `sbx_rfnd_${o.id}`, amountPaise: Number(o.totalPaise), raw: { sandbox: true } };
    return processPaymentEvent(ctx, ev);
  });

  // Sandbox checkout (development and staging only: loadConfig refuses the sandbox provider in production).
  if (ctx.payments instanceof SandboxProvider) {
    const sandbox = ctx.payments;
    app.get<{ Params: { ref: string }; Querystring: { return?: string } }>("/v1/payments/sandbox/checkout/:ref", async (req, reply) => {
      const o = await db.order.findUnique({ where: { providerRef: req.params.ref }, include: { plan: true } });
      if (!o) throw notFound("Order");
      const ret = req.query.return ? `?return=${encodeURIComponent(req.query.return)}` : "";
      const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sandbox checkout</title>
<style>body{font:15px system-ui,sans-serif;max-width:420px;margin:40px auto;padding:0 16px;color:#1a1a1a}.box{border:2px dashed #c77700;border-radius:12px;padding:20px}button{width:100%;padding:12px;margin-top:10px;border-radius:8px;border:0;font-size:15px;cursor:pointer}.ok{background:#0b6e4f;color:#fff}.no{background:#eee}</style></head><body>
<div class="box"><p><strong>SANDBOX CHECKOUT</strong>: no real money moves. This page stands in for the payment provider.</p>
<p>${esc(o.plan.name)}<br>Total ${rupees(o.totalPaise)} (incl. GST)<br>Status: ${o.status}</p>
<form method="post" action="/v1/payments/sandbox/checkout/${esc(o.providerRef!)}/succeed${esc(ret)}"><button class="ok" name="r" value="1">Simulate successful payment</button></form>
<form method="post" action="/v1/payments/sandbox/checkout/${esc(o.providerRef!)}/fail${esc(ret)}"><button class="no" name="r" value="1">Simulate failed payment</button></form></div></body></html>`;
      return reply.header("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'; form-action *").type("text/html; charset=utf-8").send(html);
    });

    await app.register(async (scope) => {
    scope.addContentTypeParser("application/x-www-form-urlencoded", { parseAs: "string" }, (_req, _body, done) => done(null, {}));
    scope.post<{ Params: { ref: string; outcome: string }; Querystring: { return?: string } }>("/v1/payments/sandbox/checkout/:ref/:outcome", async (req, reply) => {
      const o = await db.order.findUnique({ where: { providerRef: req.params.ref } });
      if (!o) throw notFound("Order");
      if (!["succeed", "fail"].includes(req.params.outcome)) throw notFound("Outcome");
      const attempt = Date.now().toString(36);
      const ev: PaymentEvent = {
        eventId: `sbx_evt_${o.id}_${req.params.outcome}_${attempt}`,
        type: req.params.outcome === "succeed" ? "payment.captured" : "payment.failed",
        providerRef: o.providerRef!, paymentRef: `sbx_pay_${o.id}_${attempt}`, amountPaise: Number(o.totalPaise), raw: { sandbox: true },
      };
      // Deliver through the real webhook endpoint so the signature path is exercised end to end.
      const payload = JSON.stringify(ev);
      const r = await app.inject({ method: "POST", url: "/v1/payments/webhook/sandbox", headers: { "content-type": "application/json", "x-sandbox-signature": sandbox.sign(payload) }, payload });
      if (r.statusCode !== 200) throw new HttpError(500, "SANDBOX_WEBHOOK_FAILED", "Sandbox webhook delivery failed");
      return reply.redirect(safeReturn(req.query.return, o.id), 303);
    });
    });
  }

  // Feature flags (admin)
  app.get("/v1/admin/flags", async (req) => { requireRole(req, "ADMIN"); return { items: await db.featureFlag.findMany({ orderBy: { key: "asc" } }) }; });
  app.put<{ Params: { key: string } }>("/v1/admin/flags/:key", async (req) => {
    const admin = requireRole(req, "ADMIN");
    const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
    if (!/^[a-z0-9_.-]{2,60}$/.test(req.params.key)) throw forbidden("Invalid flag key");
    const f = await db.featureFlag.upsert({ where: { key: req.params.key }, create: { key: req.params.key, enabled }, update: { enabled } });
    await audit(db, admin.id, "flag.set", "FeatureFlag", f.key, { enabled });
    return f;
  });
}
