import type { FastifyInstance } from "fastify";
import { otpRequestSchema, otpVerifySchema, refreshSchema, profileSchema } from "@pbs/validation";
import type { Role } from "@pbs/domain";
import type { AppContext } from "../context";
import { sha256, sixDigitCode, randomToken, safeEqual } from "../lib/crypto";
import { HttpError, unauthorized } from "../lib/errors";
import { requireUser } from "../lib/auth";
import { audit } from "../lib/audit";

const OTP_WINDOW_MIN = 10;
const OTP_MAX_PER_WINDOW = 5;

export async function authRoutes(app: FastifyInstance, ctx: AppContext) {
  const { db, cfg, tokens, otp } = ctx;

  async function issueSession(userId: string, userAgent?: string) {
    const roles = (await db.userRole.findMany({ where: { userId } })).map((r) => r.role as Role);
    const refreshToken = randomToken();
    await db.session.create({
      data: { userId, refreshTokenHash: sha256(refreshToken), userAgent: userAgent?.slice(0, 200), expiresAt: new Date(Date.now() + cfg.REFRESH_TOKEN_TTL_DAYS * 86400_000) },
    });
    return { accessToken: await tokens.sign({ id: userId, roles }), refreshToken, roles };
  }

  app.post("/v1/auth/otp/request", { config: { rateLimit: { max: 10, timeWindow: "10 minutes" } } }, async (req) => {
    const { phone } = otpRequestSchema.parse(req.body);
    const recent = await db.otpChallenge.count({ where: { phone, createdAt: { gt: new Date(Date.now() - OTP_WINDOW_MIN * 60_000) } } });
    if (recent >= OTP_MAX_PER_WINDOW) throw new HttpError(429, "OTP_LIMIT", "Too many codes requested. Try again in a few minutes.");
    const code = sixDigitCode();
    await db.otpChallenge.create({ data: { phone, codeHash: sha256(`${phone}:${code}`), expiresAt: new Date(Date.now() + cfg.OTP_TTL_SECONDS * 1000), ipHash: sha256(req.ip).slice(0, 16) } });
    await otp.send(phone, code);
    return { sent: true, provider: otp.name === "dev" ? "development (code shown in API log)" : otp.name, expiresInSeconds: cfg.OTP_TTL_SECONDS };
  });

  app.post("/v1/auth/otp/verify", { config: { rateLimit: { max: 20, timeWindow: "10 minutes" } } }, async (req) => {
    const { phone, code, name } = otpVerifySchema.parse(req.body);
    const ch = await db.otpChallenge.findFirst({ where: { phone, consumedAt: null }, orderBy: { createdAt: "desc" } });
    if (!ch || ch.expiresAt < new Date()) throw new HttpError(400, "OTP_EXPIRED", "This code has expired. Request a new one.");
    if (ch.attempts >= cfg.OTP_MAX_ATTEMPTS) throw new HttpError(429, "OTP_ATTEMPTS", "Too many wrong attempts. Request a new code.");
    if (!safeEqual(ch.codeHash, sha256(`${phone}:${code}`))) {
      await db.otpChallenge.update({ where: { id: ch.id }, data: { attempts: { increment: 1 } } });
      throw new HttpError(400, "OTP_INVALID", "That code is not correct.");
    }
    await db.otpChallenge.update({ where: { id: ch.id }, data: { consumedAt: new Date() } });
    let user = await db.user.findUnique({ where: { phone } });
    if (user?.blockedAt || user?.deletedAt) throw new HttpError(403, "ACCOUNT_UNAVAILABLE", "This account is not available. Contact support.");
    const isNew = !user;
    if (!user) {
      user = await db.user.create({ data: { phone, phoneVerifiedAt: new Date(), name: name ?? null, roles: { create: [{ role: "USER" }] } } });
      await audit(db, user.id, "USER_SIGNUP", "User", user.id);
    } else if (!user.phoneVerifiedAt) {
      await db.user.update({ where: { id: user.id }, data: { phoneVerifiedAt: new Date() } });
    }
    const session = await issueSession(user.id, req.headers["user-agent"]);
    return { ...session, user: { id: user.id, name: user.name, phone: user.phone }, isNew };
  });

  app.post("/v1/auth/refresh", async (req) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    const s = await db.session.findUnique({ where: { refreshTokenHash: sha256(refreshToken) } });
    if (!s || s.revokedAt || s.expiresAt < new Date()) throw unauthorized("Session expired. Please sign in again.");
    await db.session.update({ where: { id: s.id }, data: { revokedAt: new Date() } }); // rotate
    return issueSession(s.userId, req.headers["user-agent"]);
  });

  app.post("/v1/auth/logout", async (req) => {
    const { refreshToken } = refreshSchema.parse(req.body);
    await db.session.updateMany({ where: { refreshTokenHash: sha256(refreshToken), revokedAt: null }, data: { revokedAt: new Date() } });
    return { ok: true };
  });

  app.get("/v1/me", async (req) => {
    const u = requireUser(req);
    const user = await db.user.findUniqueOrThrow({ where: { id: u.id }, include: { roles: true } });
    return { id: user.id, name: user.name, phone: user.phone, email: user.email, roles: user.roles.map((r) => r.role) };
  });

  app.patch("/v1/me", async (req) => {
    const u = requireUser(req);
    const body = profileSchema.parse(req.body);
    const user = await db.user.update({ where: { id: u.id }, data: { name: body.name, email: body.email || null } });
    return { id: user.id, name: user.name, phone: user.phone, email: user.email };
  });
}
