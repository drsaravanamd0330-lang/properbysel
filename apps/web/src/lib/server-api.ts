import "server-only";
import { cookies } from "next/headers";
import { createClient, ApiError, type Me } from "@pbs/api-client";
import { API_URL } from "./config";

/** Server-side client for public, cacheable data. */
export const publicApi = createClient({ baseUrl: API_URL, fetch: (url, init) => fetch(url, { ...init, next: { revalidate: 60 } } as RequestInit) });
export const freshApi = createClient({ baseUrl: API_URL, fetch: (url, init) => fetch(url, { ...init, cache: "no-store" }) });

export async function getSession(): Promise<Me | null> {
  const token = (await cookies()).get("pbs_at")?.value;
  if (!token) return null;
  try {
    return await createClient({ baseUrl: API_URL, getToken: () => token, fetch: (u, i) => fetch(u, { ...i, cache: "no-store" }) }).me.get();
  } catch (e) {
    if (e instanceof ApiError) return null;
    throw e;
  }
}
