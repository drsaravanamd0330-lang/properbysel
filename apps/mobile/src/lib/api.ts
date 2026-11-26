import * as SecureStore from "expo-secure-store";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { createClient } from "@pbs/api-client";

/** API base URL: EXPO_PUBLIC_API_URL, else app.json extra.apiUrl. Android emulators reach the host machine at 10.0.2.2. */
const rawConfigUrl = (Constants.expoConfig?.extra as { apiUrl?: unknown } | undefined)?.apiUrl;
// Only a non-empty string counts: on web an unset (null) value can arrive as an empty object.
const fromConfig = typeof rawConfigUrl === "string" && rawConfigUrl ? rawConfigUrl : undefined;
export const API_URL = process.env.EXPO_PUBLIC_API_URL || fromConfig || (Platform.OS === "android" ? "http://10.0.2.2:4000" : "http://localhost:4000");

const AT = "pbs_access", RT = "pbs_refresh";
const store = {
  get: (k: string) => (Platform.OS === "web" ? Promise.resolve(globalThis.localStorage?.getItem(k) ?? null) : SecureStore.getItemAsync(k)),
  set: (k: string, v: string) => (Platform.OS === "web" ? Promise.resolve(globalThis.localStorage?.setItem(k, v)) : SecureStore.setItemAsync(k, v)),
  del: (k: string) => (Platform.OS === "web" ? Promise.resolve(globalThis.localStorage?.removeItem(k)) : SecureStore.deleteItemAsync(k)),
};

let accessToken: string | null = null;
let onSignedOut: (() => void) | null = null;
export const setSignedOutHandler = (fn: () => void) => { onSignedOut = fn; };

export async function loadTokens() { accessToken = await store.get(AT); return { accessToken, refreshToken: await store.get(RT) }; }
export async function saveTokens(t: { accessToken: string; refreshToken: string }) { accessToken = t.accessToken; await store.set(AT, t.accessToken); await store.set(RT, t.refreshToken); }
export async function clearTokens() { accessToken = null; await store.del(AT); await store.del(RT); }
export const currentToken = () => accessToken;

let refreshing: Promise<boolean> | null = null;
async function refresh(): Promise<boolean> {
  const rt = await store.get(RT);
  if (!rt) return false;
  refreshing ??= (async () => {
    try {
      const r = await fetch(`${API_URL}/v1/auth/refresh`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ refreshToken: rt }) });
      if (!r.ok) { await clearTokens(); onSignedOut?.(); return false; }
      await saveTokens(await r.json());
      return true;
    } catch { return false; } finally { setTimeout(() => { refreshing = null; }, 0); }
  })();
  return refreshing;
}

/** Same typed client and the same API as the website. */
export const api = createClient({ baseUrl: API_URL, getToken: () => accessToken, onUnauthorized: refresh });

export const mediaSource = (url: string) => ({ uri: `${API_URL}${url}`, headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined });
export const newKey = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
