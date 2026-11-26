import { NextResponse, type NextRequest } from "next/server";
import { API_URL } from "@/lib/config";
import { setAuthCookies } from "@/lib/cookies";

export async function POST(req: NextRequest) {
  const r = await fetch(`${API_URL}/v1/auth/otp/verify`, { method: "POST", headers: { "content-type": "application/json", "user-agent": req.headers.get("user-agent") ?? "" }, body: await req.text() });
  const body = await r.json();
  if (!r.ok) return NextResponse.json(body, { status: r.status });
  const res = NextResponse.json({ user: body.user, roles: body.roles, isNew: body.isNew });
  setAuthCookies(res, body);
  return res;
}
