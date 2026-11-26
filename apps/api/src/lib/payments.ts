import { createHmac } from "node:crypto";
import type { Config } from "../config";
import { safeEqual } from "./crypto";

export interface CheckoutRequest { orderId: string; totalPaise: bigint; description: string }
export interface Checkout { providerRef: string; checkoutUrl: string; clientParams?: Record<string, unknown> }
export interface PaymentEvent { eventId: string; type: "payment.captured" | "payment.failed" | "refund.processed"; providerRef: string; paymentRef: string; amountPaise: number; raw: unknown }

export interface PaymentProvider {
  name: string;
  createCheckout(req: CheckoutRequest): Promise<Checkout>;
  /** Returns the parsed event only when the signature is valid. */
  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): PaymentEvent | null;
}

const hmac = (secret: string, body: Buffer | string) => createHmac("sha256", secret).update(body).digest("hex");

/** Deterministic development provider. loadConfig() refuses it in production. */
export class SandboxProvider implements PaymentProvider {
  name = "sandbox";
  constructor(private secret: string, private publicApiUrl: string) {}
  async createCheckout(req: CheckoutRequest): Promise<Checkout> {
    const providerRef = `sbx_order_${req.orderId}`;
    return { providerRef, checkoutUrl: `${this.publicApiUrl}/v1/payments/sandbox/checkout/${providerRef}` };
  }
  sign(body: string) { return hmac(this.secret, body); }
  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): PaymentEvent | null {
    const sig = headers["x-sandbox-signature"];
    if (typeof sig !== "string" || !safeEqual(sig, this.sign(rawBody.toString()))) return null;
    return JSON.parse(rawBody.toString()) as PaymentEvent;
  }
}

/**
 * Razorpay adapter. Webhook verification follows Razorpay's documented HMAC-SHA256 over the raw body
 * (X-Razorpay-Signature). Order creation calls the Orders API. Not exercised against live Razorpay yet:
 * needs a merchant account and keys.
 */
export class RazorpayProvider implements PaymentProvider {
  name = "razorpay";
  constructor(private keyId: string, private keySecret: string, private webhookSecret: string) {}
  async createCheckout(req: CheckoutRequest): Promise<Checkout> {
    const r = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}` },
      body: JSON.stringify({ amount: Number(req.totalPaise), currency: "INR", receipt: req.orderId, notes: { description: req.description } }),
    });
    if (!r.ok) throw new Error(`Razorpay order creation failed (${r.status})`);
    const o = (await r.json()) as { id: string };
    return { providerRef: o.id, checkoutUrl: "", clientParams: { key: this.keyId, order_id: o.id, amount: Number(req.totalPaise), currency: "INR", name: "ProperBySel" } };
  }
  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): PaymentEvent | null {
    const sig = headers["x-razorpay-signature"];
    if (typeof sig !== "string" || !safeEqual(sig, hmac(this.webhookSecret, rawBody))) return null;
    const ev = JSON.parse(rawBody.toString()) as { event: string; payload: { payment?: { entity: { id: string; order_id: string; amount: number } }; refund?: { entity: { id: string; payment_id: string; amount: number; notes?: { order_id?: string } } } } };
    const eventId = typeof headers["x-razorpay-event-id"] === "string" ? headers["x-razorpay-event-id"] : hmac("id", rawBody);
    if (ev.event === "payment.captured" || ev.event === "payment.failed") {
      const p = ev.payload.payment!.entity;
      return { eventId, type: ev.event, providerRef: p.order_id, paymentRef: p.id, amountPaise: p.amount, raw: ev };
    }
    if (ev.event === "refund.processed") {
      const rf = ev.payload.refund!.entity;
      return { eventId, type: "refund.processed", providerRef: rf.notes?.order_id ?? "", paymentRef: rf.id, amountPaise: rf.amount, raw: ev };
    }
    return null;
  }
}

export function createPaymentProvider(cfg: Config): PaymentProvider {
  if (cfg.PAYMENT_PROVIDER === "razorpay") {
    if (!cfg.RAZORPAY_KEY_ID || !cfg.RAZORPAY_KEY_SECRET || !cfg.RAZORPAY_WEBHOOK_SECRET) throw new Error("Razorpay keys are not configured");
    return new RazorpayProvider(cfg.RAZORPAY_KEY_ID, cfg.RAZORPAY_KEY_SECRET, cfg.RAZORPAY_WEBHOOK_SECRET);
  }
  return new SandboxProvider(`sandbox:${cfg.JWT_SECRET}`, cfg.PUBLIC_API_URL);
}
