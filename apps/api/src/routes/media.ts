import type { FastifyInstance } from "fastify";
import sharp, { type OutputInfo } from "sharp";
import { randomUUID } from "node:crypto";
import type { AppContext } from "../context";
import { requireUser, isModerator } from "../lib/auth";
import { HttpError, notFound, forbidden } from "../lib/errors";
import { loadOwned } from "./listings";
import { signFileToken, verifyFileToken } from "../lib/crypto";
import { audit } from "../lib/audit";

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DOC_TYPES = new Set(["application/pdf", "image/jpeg", "image/png"]);
const MAX_PHOTO = 8 * 1024 * 1024;
const MAX_DOC = 10 * 1024 * 1024;
const MAX_PHOTOS = 20;

export async function mediaRoutes(app: FastifyInstance, ctx: AppContext) {
  const { db, storage, cfg } = ctx;

  app.post("/v1/listings/:id/media", async (req, reply) => {
    const u = requireUser(req);
    const { l, actor } = await loadOwned(ctx, (req.params as { id: string }).id, u);
    if (actor !== "OWNER") throw forbidden();
    if (l.media.length >= MAX_PHOTOS) throw new HttpError(400, "TOO_MANY_PHOTOS", `A listing can have up to ${MAX_PHOTOS} photos`);
    const file = await req.file({ limits: { fileSize: MAX_PHOTO } });
    if (!file) throw new HttpError(400, "NO_FILE", "Choose a photo to upload");
    if (!PHOTO_TYPES.has(file.mimetype)) throw new HttpError(415, "UNSUPPORTED_TYPE", "Photos must be JPEG, PNG or WebP");
    const raw = await file.toBuffer();
    if (file.file.truncated) throw new HttpError(413, "TOO_LARGE", "Photos must be 8 MB or smaller");
    let out: Buffer, meta: OutputInfo;
    try {
      // Re-encoding strips EXIF (including GPS location) and validates that the file really is an image.
      const r = await sharp(raw).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
      out = r.data; meta = r.info;
    } catch { throw new HttpError(415, "INVALID_IMAGE", "That file is not a valid image"); }
    const key = `public/listings/${l.id}/${randomUUID()}.webp`;
    await storage.put(key, out);
    const m = await db.media.create({ data: { listingId: l.id, storageKey: key, mimeType: "image/webp", bytes: out.length, width: meta.width, height: meta.height, position: l.media.length } });
    if (l.status === "PUBLISHED" || l.status === "PAUSED") {
      // New photos on a live listing need review.
      const { transition } = await import("./listings");
      await transition(ctx, l, "EDIT_MATERIAL", "OWNER", u.id);
    }
    reply.code(201);
    return { id: m.id, url: `/v1/media/${m.id}`, width: m.width, height: m.height };
  });

  app.delete("/v1/listings/:id/media/:mediaId", async (req) => {
    const u = requireUser(req);
    const p = req.params as { id: string; mediaId: string };
    const { l, actor } = await loadOwned(ctx, p.id, u);
    if (actor !== "OWNER") throw forbidden();
    const m = l.media.find((x) => x.id === p.mediaId);
    if (!m) throw notFound("Photo");
    await db.media.delete({ where: { id: m.id } });
    await storage.remove(m.storageKey);
    return { ok: true };
  });

  /** Photos are viewable when the listing is public, or by its owner / moderators. */
  app.get("/v1/media/:id", async (req, reply) => {
    const m = await db.media.findUnique({ where: { id: (req.params as { id: string }).id }, include: { listing: true } });
    if (!m) throw notFound("Photo");
    const publicOk = ["PUBLISHED"].includes(m.listing.status);
    if (!publicOk) {
      const u = req.authUser;
      if (!u || (u.id !== m.listing.ownerId && !isModerator(u))) throw notFound("Photo");
    }
    reply.header("Content-Type", m.mimeType).header("Cache-Control", publicOk ? "public, max-age=86400" : "private, no-store");
    return reply.send(await storage.get(m.storageKey));
  });

  // ---- Private documents ----
  app.post("/v1/listings/:id/documents", async (req, reply) => {
    const u = requireUser(req);
    const { l, actor } = await loadOwned(ctx, (req.params as { id: string }).id, u);
    if (actor !== "OWNER") throw forbidden();
    const file = await req.file({ limits: { fileSize: MAX_DOC } });
    if (!file) throw new HttpError(400, "NO_FILE", "Choose a document");
    if (!DOC_TYPES.has(file.mimetype)) throw new HttpError(415, "UNSUPPORTED_TYPE", "Documents must be PDF, JPEG or PNG");
    const buf = await file.toBuffer();
    if (file.file.truncated) throw new HttpError(413, "TOO_LARGE", "Documents must be 10 MB or smaller");
    const label = String((file.fields.label as { value?: string } | undefined)?.value ?? file.filename).slice(0, 120);
    const ext = file.mimetype === "application/pdf" ? "pdf" : file.mimetype === "image/png" ? "png" : "jpg";
    const key = `private/documents/${u.id}/${randomUUID()}.${ext}`;
    await storage.put(key, buf);
    const d = await db.privateDocument.create({ data: { ownerId: u.id, listingId: l.id, label, storageKey: key, mimeType: file.mimetype, bytes: buf.length } });
    reply.code(201);
    return { id: d.id, label: d.label, bytes: d.bytes };
  });

  /** Issues a 5-minute signed URL to the document owner or moderators only. */
  app.get("/v1/documents/:id/url", async (req) => {
    const u = requireUser(req);
    const d = await db.privateDocument.findUnique({ where: { id: (req.params as { id: string }).id } });
    if (!d || (d.ownerId !== u.id && !isModerator(u))) throw notFound("Document");
    if (d.ownerId !== u.id) await audit(db, u.id, "DOCUMENT_VIEWED", "PrivateDocument", d.id);
    return { url: `/v1/files/private?token=${encodeURIComponent(signFileToken(cfg.JWT_SECRET, d.storageKey, 300))}`, expiresInSeconds: 300 };
  });

  app.get("/v1/files/private", async (req, reply) => {
    const token = (req.query as { token?: string }).token ?? "";
    const key = verifyFileToken(cfg.JWT_SECRET, token);
    if (!key || !key.startsWith("private/")) throw new HttpError(403, "LINK_EXPIRED", "This link has expired");
    const d = await db.privateDocument.findFirst({ where: { storageKey: key } });
    if (!d) throw notFound("Document");
    reply.header("Content-Type", d.mimeType).header("Cache-Control", "private, no-store").header("Content-Disposition", "inline");
    return reply.send(await storage.get(key));
  });
}
