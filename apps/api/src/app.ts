import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import multipart from "@fastify/multipart";
import { ZodError } from "zod";
import { Prisma, type PrismaClient } from "@prisma/client";
import { loadConfig, type Config } from "./config";
import { TokenService } from "./lib/auth";
import { createOtpSender, type OtpSender } from "./lib/otp";
import { createStorage, type Storage } from "./lib/storage";
import { HttpError } from "./lib/errors";
import type { AppContext } from "./context";
import { authRoutes } from "./routes/auth";
import { listingRoutes } from "./routes/listings";
import { moderationRoutes } from "./routes/moderation";
import { publicRoutes } from "./routes/public";
import { enquiryRoutes } from "./routes/enquiries";
import { mediaRoutes } from "./routes/media";
import { paymentRoutes } from "./routes/payments";
import { createPaymentProvider, type PaymentProvider } from "./lib/payments";

export interface BuildOptions { cfg?: Config; db: PrismaClient; otp?: OtpSender; storage?: Storage; payments?: PaymentProvider; logger?: boolean }

export async function buildApp(opts: BuildOptions): Promise<{ app: FastifyInstance; ctx: AppContext }> {
  const cfg = opts.cfg ?? loadConfig();
  const app = Fastify({
    logger: opts.logger === false ? false : { level: "info", redact: ["req.headers.authorization", "req.body.code", "req.body.phone"] },
    trustProxy: true,
    bodyLimit: 1024 * 1024,
  });
  const ctx: AppContext = {
    cfg, db: opts.db,
    tokens: new TokenService(cfg.JWT_SECRET, cfg.ACCESS_TOKEN_TTL_MIN),
    otp: opts.otp ?? createOtpSender(cfg, (m) => app.log.warn(m)),
    storage: opts.storage ?? createStorage(cfg),
    payments: opts.payments ?? createPaymentProvider(cfg),
  };

  await app.register(helmet, { crossOriginResourcePolicy: { policy: "cross-origin" } });
  await app.register(cors, { origin: cfg.WEB_ORIGIN.split(","), credentials: true, methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"], allowedHeaders: ["content-type", "authorization", "idempotency-key"] });
  await app.register(rateLimit, { max: 300, timeWindow: "1 minute" });
  await app.register(multipart, { limits: { files: 1, fileSize: 10 * 1024 * 1024 } });

  app.decorateRequest("authUser", null);
  app.addHook("onRequest", async (req) => {
    const h = req.headers.authorization;
    req.authUser = h?.startsWith("Bearer ") ? await ctx.tokens.verify(h.slice(7)) : null;
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ error: { code: "VALIDATION", message: "Please check the highlighted fields", details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) } });
    }
    if (err instanceof HttpError) return reply.code(err.statusCode).send({ error: { code: err.code, message: err.message, details: err.details } });
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") return reply.code(404).send({ error: { code: "NOT_FOUND", message: "Not found" } });
    const e = err as { statusCode?: number; message?: string; code?: string };
    if (e.statusCode && e.statusCode < 500) return reply.code(e.statusCode).send({ error: { code: e.code ?? "BAD_REQUEST", message: e.message } });
    req.log.error(err);
    return reply.code(500).send({ error: { code: "INTERNAL", message: "Something went wrong. Please try again." } });
  });

  app.get("/health", async () => ({ ok: true, env: cfg.APP_ENV, otp: ctx.otp.name, storage: cfg.STORAGE_PROVIDER, payments: ctx.payments.name }));

  await authRoutes(app, ctx);
  await listingRoutes(app, ctx);
  await moderationRoutes(app, ctx);
  await publicRoutes(app, ctx);
  await enquiryRoutes(app, ctx);
  await mediaRoutes(app, ctx);
  await paymentRoutes(app, ctx);
  return { app, ctx };
}
