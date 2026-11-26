import type { NextResponse } from "next/server";

const secure = process.env.NODE_ENV === "production";
export function setAuthCookies(res: NextResponse, t: { accessToken: string; refreshToken: string; roles: string[] }) {
  res.cookies.set("pbs_at", t.accessToken, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 30 * 60 });
  res.cookies.set("pbs_rt", t.refreshToken, { httpOnly: true, secure, sameSite: "lax", path: "/api", maxAge: 30 * 86400 });
  // Not a security boundary: only used to show/hide navigation. The API enforces roles.
  res.cookies.set("pbs_roles", t.roles.join(","), { httpOnly: false, secure, sameSite: "lax", path: "/", maxAge: 30 * 86400 });
}
export function clearAuthCookies(res: NextResponse) {
  for (const [n, p] of [["pbs_at", "/"], ["pbs_rt", "/api"], ["pbs_roles", "/"]] as const) res.cookies.set(n, "", { path: p, maxAge: 0 });
}
