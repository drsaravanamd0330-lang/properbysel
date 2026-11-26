import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { searchQuerySchema } from "@pbs/validation";
import type { AppContext } from "../context";
import { requireUser } from "../lib/auth";
import { HttpError, notFound } from "../lib/errors";
import { publicListing } from "../lib/serialize";
import { publicWhere } from "./public";

const MAX_SAVED = 20;
const saveSchema = z.object({ name: z.string().trim().min(2).max(80), query: z.record(z.string(), z.unknown()), alerts: z.boolean().default(true) });
const include = { media: true, city: true, locality: true, owner: { select: { id: true, name: true } }, verifications: true } as const;

/** Keep only fields the search understands, after validating them. */
export function cleanQuery(raw: Record<string, unknown>) {
  const q = searchQuerySchema.parse(raw);
  const { page: _p, pageSize: _s, sort: _o, bbox: _b, ...rest } = q as Record<string, unknown>;
  return Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined && v !== "")) as Prisma.InputJsonObject;
}

export async function savedRoutes(app: FastifyInstance, ctx: AppContext) {
  const { db } = ctx;

  app.get("/v1/me/saved-searches", async (req) => {
    const u = requireUser(req);
    return { items: await db.savedSearch.findMany({ where: { userId: u.id }, orderBy: { createdAt: "desc" } }) };
  });

  app.post("/v1/me/saved-searches", async (req, reply) => {
    const u = requireUser(req);
    const body = saveSchema.parse(req.body);
    if ((await db.savedSearch.count({ where: { userId: u.id } })) >= MAX_SAVED) throw new HttpError(409, "LIMIT", `You can save up to ${MAX_SAVED} searches. Delete one first.`);
    const s = await db.savedSearch.create({ data: { userId: u.id, name: body.name, query: cleanQuery(body.query), alerts: body.alerts, lastAlertedAt: new Date() } });
    return reply.code(201).send(s);
  });

  app.patch<{ Params: { id: string } }>("/v1/me/saved-searches/:id", async (req) => {
    const u = requireUser(req);
    const body = z.object({ alerts: z.boolean().optional(), name: z.string().trim().min(2).max(80).optional() }).parse(req.body);
    const r = await db.savedSearch.updateMany({ where: { id: req.params.id, userId: u.id }, data: body });
    if (!r.count) throw notFound("Saved search");
    return db.savedSearch.findUniqueOrThrow({ where: { id: req.params.id } });
  });

  app.delete<{ Params: { id: string } }>("/v1/me/saved-searches/:id", async (req) => {
    const u = requireUser(req);
    const r = await db.savedSearch.deleteMany({ where: { id: req.params.id, userId: u.id } });
    if (!r.count) throw notFound("Saved search");
    return { ok: true };
  });

  /** Side-by-side comparison of up to 4 public listings. Unavailable ones are reported, not leaked. */
  app.get<{ Querystring: { ids?: string } }>("/v1/compare", async (req) => {
    const ids = [...new Set((req.query.ids ?? "").split(",").map((s) => s.trim()).filter(Boolean))].slice(0, 4);
    if (!ids.length) return { items: [], unavailable: [] };
    const now = new Date();
    const rows = await db.listing.findMany({ where: { AND: [{ id: { in: ids } }, publicWhere(now)] }, include });
    const found = new Set(rows.map((r) => r.id));
    return { items: ids.filter((id) => found.has(id)).map((id) => publicListing(rows.find((r) => r.id === id)!, now)), unavailable: ids.filter((id) => !found.has(id)) };
  });
}
