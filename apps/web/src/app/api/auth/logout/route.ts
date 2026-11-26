import { NextResponse, type NextRequest } from "next/server";
import { API_URL } from "@/lib/config";
import { clearAuthCookies } from "@/lib/cookies";

export async function POST(req: NextRequest) {
  const rt = req.cookies.get("pbs_rt")?.value;
  if (rt) await fetch(`${API_URL}/v1/auth/logout`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refreshToken: rt }) }).catch(() => undefined);
  const res = NextResponse.json({ ok: true });
  clearAuthCookies(res);
  return res;
}
