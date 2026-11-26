import type { FastifyInstance } from "fastify";
import { Prisma } from "@prisma/client";
import { enquirySchema, messageSchema, leadUpdateSchema, visitRequestSchema, visitActionSchema } from "@pbs/validation";
import { ENQUIRABLE } from "@pbs/domain";
import type { AppContext } from "../context";
import { requireUser } from "../lib/auth";
import { HttpError, notFound, forbidden, conflict } from "../lib/errors";
import { publicListing } from "../lib/serialize";

const listingInclude = { media: true, city: true, locality: true, owner: { select: { id: true, name: true } }, verifications: true } as const;

export async function enquiryRoutes(app: FastifyInstance, ctx: AppContext) {
  const { db } = ctx;

  app.post("/v1/properties/:id/enquiries", { config: { rateLimit: { max: 20, timeWindow: "1 hour" } } }, async (req, reply) => {
    const u = requireUser(req);
    const listingId = (req.params as { id: string }).id;
    const body = enquirySchema.parse(req.body);
    const idemKey = typeof req.headers["idempotency-key"] === "string" ? req.headers["idempotency-key"].slice(0, 100) : null;

    if (idemKey) {
      const prior = await db.enquiry.findUnique({ where: { buyerId_idempotencyKey: { buyerId: u.id, idempotencyKey: idemKey } } });
      if (prior) return { id: prior.id, conversationId: prior.conversationId, duplicate: true };
    }
    const l = await db.listing.findUnique({ where: { id: listingId } });
    if (!l || !ENQUIRABLE.includes(l.status) || !l.expiresAt || l.expiresAt < new Date()) throw new HttpError(409, "NOT_ENQUIRABLE", "This property is not accepting enquiries");
    if (l.ownerId === u.id) throw new HttpError(400, "OWN_LISTING", "You cannot enquire about your own listing");

    const existing = await db.enquiry.findUnique({ where: { listingId_buyerId: { listingId, buyerId: u.id } } });
    if (existing) {
      const blocked = await db.conversationParticipant.findFirst({ where: { conversationId: existing.conversationId, blocked: true } });
      if (blocked) throw forbidden("You cannot message this advertiser");
      await db.message.create({ data: { conversationId: existing.conversationId, senderId: u.id, body: body.message } });
      await db.conversation.update({ where: { id: existing.conversationId }, data: { updatedAt: new Date() } });
      return { id: existing.id, conversationId: existing.conversationId, duplicate: false, appended: true };
    }
    try {
      const enquiry = await db.$transaction(async (tx) => {
        const conv = await tx.conversation.create({ data: { participants: { create: [{ userId: u.id, lastReadAt: new Date() }, { userId: l.ownerId }] } } });
        await tx.message.create({ data: { conversationId: conv.id, senderId: u.id, body: body.message } });
        const e = await tx.enquiry.create({ data: { listingId, buyerId: u.id, advertiserId: l.ownerId, conversationId: conv.id, message: body.message, shareBuyerPhone: body.shareMyPhone, idempotencyKey: idemKey } });
        await tx.notification.create({ data: { userId: l.ownerId, type: "NEW_ENQUIRY", title: "New enquiry", body: `Someone is interested in "${l.title}"`, link: `/dashboard/inbox/${e.id}` } });
        return e;
      });
      reply.code(201);
      return { id: enquiry.id, conversationId: enquiry.conversationId, duplicate: false };
    } catch (e) {
      // A concurrent retry created it first: return that one.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const prior = await db.enquiry.findUnique({ where: { listingId_buyerId: { listingId, buyerId: u.id } } });
        if (prior) return { id: prior.id, conversationId: prior.conversationId, duplicate: true };
      }
      throw e;
    }
  });

  /** Advertiser inbox: leads on my listings. */
  app.get("/v1/me/inbox", async (req) => {
    const u = requireUser(req);
    const rows = await db.enquiry.findMany({
      where: { advertiserId: u.id },
      include: {
        listing: { include: listingInclude },
        buyer: { select: { id: true, name: true, phone: true } },
        conversation: { include: { messages: { orderBy: { createdAt: "desc" }, take: 1 }, participants: { where: { userId: u.id } } } },
      },
      orderBy: { updatedAt: "desc" },
    });
    return { items: rows.map((e) => {
      const last = e.conversation.messages[0];
      const me = e.conversation.participants[0];
      return {
        id: e.id, stage: e.stage, leadNotes: e.leadNotes, createdAt: e.createdAt, conversationId: e.conversationId,
        listing: { id: e.listing.id, title: e.listing.title, status: e.listing.status },
        buyer: { name: e.buyer.name ?? "ProperBySel user", phone: e.shareBuyerPhone ? e.buyer.phone : null },
        lastMessage: last ? { body: last.body, at: last.createdAt, fromMe: last.senderId === u.id } : null,
        unread: !!last && last.senderId !== u.id && (!me?.lastReadAt || me.lastReadAt < last.createdAt),
      };
    }) };
  });

  /** Buyer view: enquiries I sent. */
  app.get("/v1/me/enquiries", async (req) => {
    const u = requireUser(req);
    const rows = await db.enquiry.findMany({ where: { buyerId: u.id }, include: { listing: { include: listingInclude }, visits: true }, orderBy: { updatedAt: "desc" } });
    return { items: rows.map((e) => ({ id: e.id, conversationId: e.conversationId, createdAt: e.createdAt, listing: publicListing(e.listing), visits: e.visits })) };
  });

  app.patch("/v1/leads/:id", async (req) => {
    const u = requireUser(req);
    const body = leadUpdateSchema.parse(req.body);
    const e = await db.enquiry.findUnique({ where: { id: (req.params as { id: string }).id } });
    if (!e || e.advertiserId !== u.id) throw notFound("Lead");
    const updated = await db.enquiry.update({ where: { id: e.id }, data: { stage: body.stage, leadNotes: body.note } });
    return { id: updated.id, stage: updated.stage, leadNotes: updated.leadNotes };
  });

  async function participant(conversationId: string, userId: string) {
    const p = await db.conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId, userId } } });
    if (!p) throw notFound("Conversation"); // non-participants get 404, not 403
    return p;
  }

  app.get("/v1/conversations/:id", async (req) => {
    const u = requireUser(req);
    const id = (req.params as { id: string }).id;
    await participant(id, u.id);
    const conv = await db.conversation.findUniqueOrThrow({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: "asc" }, take: 200 },
        participants: { include: { user: { select: { id: true, name: true } } } },
        enquiry: { include: { listing: { select: { id: true, title: true, status: true } }, visits: { orderBy: { createdAt: "desc" } } } },
      },
    });
    await db.conversationParticipant.update({ where: { conversationId_userId: { conversationId: id, userId: u.id } }, data: { lastReadAt: new Date() } });
    return {
      id: conv.id,
      listing: conv.enquiry?.listing ?? null,
      enquiryId: conv.enquiry?.id ?? null,
      myRole: conv.enquiry?.advertiserId === u.id ? "ADVERTISER" : "BUYER",
      participants: conv.participants.map((p) => ({ id: p.user.id, name: p.user.name ?? "ProperBySel user", isMe: p.userId === u.id })),
      blocked: conv.participants.some((p) => p.blocked),
      visits: conv.enquiry?.visits ?? [],
      messages: conv.messages.map((m) => ({ id: m.id, body: m.body, at: m.createdAt, fromMe: m.senderId === u.id })),
    };
  });

  app.post("/v1/conversations/:id/messages", { config: { rateLimit: { max: 60, timeWindow: "10 minutes" } } }, async (req, reply) => {
    const u = requireUser(req);
    const id = (req.params as { id: string }).id;
    await participant(id, u.id);
    const body = messageSchema.parse(req.body);
    const blocked = await db.conversationParticipant.findFirst({ where: { conversationId: id, blocked: true } });
    if (blocked) throw forbidden("This conversation is blocked");
    const conv = await db.conversation.findUniqueOrThrow({ where: { id }, include: { enquiry: { include: { listing: true } }, participants: true } });
    const m = await db.message.create({ data: { conversationId: id, senderId: u.id, body: body.body } });
    await db.conversation.update({ where: { id }, data: { updatedAt: new Date() } });
    if (conv.enquiry) await db.enquiry.update({ where: { id: conv.enquiry.id }, data: { updatedAt: new Date() } });
    const other = conv.participants.find((p) => p.userId !== u.id);
    if (other) await db.notification.create({ data: { userId: other.userId, type: "NEW_MESSAGE", title: "New message", body: conv.enquiry?.listing.title ? `About "${conv.enquiry.listing.title}"` : "You have a new message", link: `/dashboard/messages/${id}` } });
    reply.code(201);
    return { id: m.id, body: m.body, at: m.createdAt, fromMe: true };
  });

  app.post("/v1/conversations/:id/block", async (req) => {
    const u = requireUser(req);
    const id = (req.params as { id: string }).id;
    await participant(id, u.id);
    await db.conversationParticipant.update({ where: { conversationId_userId: { conversationId: id, userId: u.id } }, data: { blocked: true } });
    return { blocked: true };
  });

  // ---- Visits ----
  app.post("/v1/leads/:id/visits", async (req, reply) => {
    const u = requireUser(req);
    const body = visitRequestSchema.parse(req.body);
    const e = await db.enquiry.findUnique({ where: { id: (req.params as { id: string }).id }, include: { listing: true } });
    if (!e || (e.buyerId !== u.id && e.advertiserId !== u.id)) throw notFound("Lead");
    if (e.listing.status !== "PUBLISHED") throw conflict("Visits can only be requested for live listings");
    const v = await db.visitRequest.create({ data: { enquiryId: e.id, requestedBy: u.id, proposedAt: body.proposedAt, note: body.note ?? null } });
    const other = e.buyerId === u.id ? e.advertiserId : e.buyerId;
    await db.notification.create({ data: { userId: other, type: "VISIT_REQUESTED", title: "Visit requested", body: `For "${e.listing.title}" on ${body.proposedAt.toISOString().slice(0, 16).replace("T", " ")}`, link: `/dashboard/messages/${e.conversationId}` } });
    reply.code(201);
    return v;
  });

  app.post("/v1/visits/:id/action", async (req) => {
    const u = requireUser(req);
    const body = visitActionSchema.parse(req.body);
    const v = await db.visitRequest.findUnique({ where: { id: (req.params as { id: string }).id }, include: { enquiry: true } });
    if (!v || (v.enquiry.buyerId !== u.id && v.enquiry.advertiserId !== u.id)) throw notFound("Visit");
    const isRequester = v.requestedBy === u.id;
    const isAdvertiser = v.enquiry.advertiserId === u.id;
    const open = ["REQUESTED", "RESCHEDULE_PROPOSED"].includes(v.status);
    let data: Prisma.VisitRequestUpdateInput;
    switch (body.action) {
      case "ACCEPT":
      case "DECLINE":
        if (!open || isRequester) throw conflict("Only the other party can accept or decline an open request");
        data = { status: body.action === "ACCEPT" ? "ACCEPTED" : "DECLINED" };
        break;
      case "RESCHEDULE":
        if (!body.proposedAt || body.proposedAt < new Date()) throw new HttpError(400, "VALIDATION", "Choose a future time");
        if (!open && v.status !== "ACCEPTED") throw conflict("This visit cannot be rescheduled");
        data = { status: "RESCHEDULE_PROPOSED", proposedAt: body.proposedAt, requestedBy: u.id };
        break;
      case "CANCEL":
        if (!open && v.status !== "ACCEPTED") throw conflict("This visit cannot be cancelled");
        data = { status: "CANCELLED" };
        break;
      case "COMPLETE":
        if (!isAdvertiser || v.status !== "ACCEPTED") throw conflict("Only the advertiser can mark an accepted visit completed");
        data = { status: "COMPLETED" };
        break;
    }
    const updated = await db.visitRequest.update({ where: { id: v.id }, data });
    if (updated.status === "ACCEPTED" && v.enquiry.stage === "NEW" || updated.status === "ACCEPTED" && v.enquiry.stage === "CONTACTED") {
      await db.enquiry.update({ where: { id: v.enquiry.id }, data: { stage: "VISIT_SCHEDULED" } });
    }
    return updated;
  });

  // ---- Favourites & notifications ----
  app.get("/v1/me/favourites", async (req) => {
    const u = requireUser(req);
    const rows = await db.favourite.findMany({ where: { userId: u.id }, include: { listing: { include: listingInclude } }, orderBy: { createdAt: "desc" } });
    return { items: rows.map((f) => ({ ...publicListing(f.listing), savedAt: f.createdAt, available: f.listing.status === "PUBLISHED" })) };
  });
  app.put("/v1/me/favourites/:listingId", async (req) => {
    const u = requireUser(req);
    const listingId = (req.params as { listingId: string }).listingId;
    const l = await db.listing.findFirst({ where: { id: listingId, status: "PUBLISHED" } });
    if (!l) throw notFound("Property");
    await db.favourite.upsert({ where: { userId_listingId: { userId: u.id, listingId } }, create: { userId: u.id, listingId }, update: {} });
    return { saved: true };
  });
  app.delete("/v1/me/favourites/:listingId", async (req) => {
    const u = requireUser(req);
    await db.favourite.deleteMany({ where: { userId: u.id, listingId: (req.params as { listingId: string }).listingId } });
    return { saved: false };
  });

  app.get("/v1/me/notifications", async (req) => {
    const u = requireUser(req);
    const items = await db.notification.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" }, take: 50 });
    return { items, unread: items.filter((n) => !n.readAt).length };
  });
  app.post("/v1/me/notifications/read", async (req) => {
    const u = requireUser(req);
    await db.notification.updateMany({ where: { userId: u.id, readAt: null }, data: { readAt: new Date() } });
    return { ok: true };
  });
}
