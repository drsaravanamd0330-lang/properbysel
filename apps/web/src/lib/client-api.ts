"use client";
import { createClient } from "@pbs/api-client";

/** Browser client. Tokens live in httpOnly cookies; the /api/proxy route attaches them. */
export const api = createClient({ baseUrl: "/api/proxy" });

export function newIdempotencyKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()) + Math.random();
}
