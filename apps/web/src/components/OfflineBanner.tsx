"use client";
import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const on = () => setOffline(false), off = () => setOffline(true);
    setOffline(!navigator.onLine);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  if (!offline) return null;
  return <div role="status" className="alert alert-warn" style={{ margin: 0, borderRadius: 0, textAlign: "center" }}>You are offline. Some actions will not work until your connection returns.</div>;
}
