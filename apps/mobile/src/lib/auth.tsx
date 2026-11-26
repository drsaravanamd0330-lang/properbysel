import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Me } from "@pbs/api-client";
import { api, loadTokens, saveTokens, clearTokens, setSignedOutHandler } from "./api";

interface AuthState { me: Me | null; ready: boolean; signIn: (t: { accessToken: string; refreshToken: string }) => Promise<void>; signOut: () => Promise<void>; reload: () => Promise<void> }
const Ctx = createContext<AuthState>({ me: null, ready: false, signIn: async () => {}, signOut: async () => {}, reload: async () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const reload = useCallback(async () => {
    try { setMe(await api.me.get()); } catch { setMe(null); }
  }, []);
  useEffect(() => {
    setSignedOutHandler(() => setMe(null));
    loadTokens().then(async (t) => { if (t.accessToken || t.refreshToken) await reload(); setReady(true); });
  }, [reload]);
  const signIn = async (t: { accessToken: string; refreshToken: string }) => { await saveTokens(t); await reload(); };
  const signOut = async () => {
    const { refreshToken } = await loadTokens();
    if (refreshToken) await api.auth.logout(refreshToken).catch(() => undefined);
    await clearTokens(); setMe(null);
  };
  return <Ctx.Provider value={{ me, ready, signIn, signOut, reload }}>{children}</Ctx.Provider>;
}
export const useAuth = () => useContext(Ctx);
