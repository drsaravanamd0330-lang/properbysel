import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./LoginForm";
export const metadata: Metadata = { title: "Log in", robots: { index: false } };
export default function LoginPage() {
  return <div className="container section" style={{ maxWidth: 460 }}><Suspense><LoginForm /></Suspense></div>;
}
