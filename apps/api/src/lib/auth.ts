import { SignJWT, jwtVerify } from "jose";
import type { FastifyRequest } from "fastify";
import type { Role } from "@pbs/domain";
import { STAFF_ROLES } from "@pbs/domain";
import { unauthorized, forbidden } from "./errors";

export interface AuthUser { id: string; roles: Role[] }

declare module "fastify" {
  interface FastifyRequest { authUser: AuthUser | null }
}

export class TokenService {
  private key: Uint8Array;
  constructor(secret: string, private ttlMin: number) { this.key = new TextEncoder().encode(secret); }
  async sign(u: AuthUser): Promise<string> {
    return new SignJWT({ roles: u.roles }).setProtectedHeader({ alg: "HS256" }).setSubject(u.id)
      .setIssuedAt().setIssuer("properbysel").setAudience("properbysel-api").setExpirationTime(`${this.ttlMin}m`).sign(this.key);
  }
  async verify(token: string): Promise<AuthUser | null> {
    try {
      const { payload } = await jwtVerify(token, this.key, { issuer: "properbysel", audience: "properbysel-api" });
      return { id: String(payload.sub), roles: (payload.roles as Role[]) ?? [] };
    } catch { return null; }
  }
}

export function requireUser(req: FastifyRequest): AuthUser {
  if (!req.authUser) throw unauthorized();
  return req.authUser;
}

export function requireRole(req: FastifyRequest, ...roles: Role[]): AuthUser {
  const u = requireUser(req);
  if (!u.roles.some((r) => roles.includes(r))) throw forbidden();
  return u;
}

export const isStaff = (u: AuthUser | null) => !!u && u.roles.some((r) => STAFF_ROLES.includes(r));
export const isModerator = (u: AuthUser | null) => !!u && (u.roles.includes("MODERATOR") || u.roles.includes("ADMIN"));
