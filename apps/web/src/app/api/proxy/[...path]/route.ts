import { NextResponse, type NextRequest } from "next/server";
import { API_URL } from "@/lib/config";
import { setAuthCookies, clearAuthCookies } from "@/lib/cookies";

/** Backend-for-frontend proxy: attaches the access token from an httpOnly cookie and refreshes it when needed. */
async function handle(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  if (path[0] !== "v1") return NextResponse.json({ error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 });
  const url = `${API_URL}/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;
  const body = ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.from(await req.arrayBuffer());
  const fwd = (token?: string) => {
    const h: Record<string, string> = {};
    for (const k of ["content-type", "idempotency-key", "accept"]) { const v = req.headers.get(k); if (v) h[k] = v; }
    h["x-forwarded-for"] = req.headers.get("x-forwarded-for") ?? "";
    if (token) h.authorization = `Bearer ${token}`;
    return fetch(url, { method: req.method, headers: h, body, cache: "no-store" });
  };

  let token = req.cookies.get("pbs_at")?.value;
  const rt = req.cookies.get("pbs_rt")?.value;
  let refreshed: { accessToken: string; refreshToken: string; roles: string[] } | null = null;
  let r = await fwd(token);
  if (r.status === 401 && rt) {
    const rr = await fetch(`${API_URL}/v1/auth/refresh`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refreshToken: rt }) });
    if (rr.ok) { refreshed = await rr.json(); token = refreshed!.accessToken; r = await fwd(token); }
  }
  const res = new NextResponse(r.body, { status: r.status, headers: { "content-type": r.headers.get("content-type") ?? "application/json", "cache-control": "no-store" } });
  if (refreshed) setAuthCookies(res, refreshed);
  else if (r.status === 401 && rt) clearAuthCookies(res);
  return res;
}
export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
