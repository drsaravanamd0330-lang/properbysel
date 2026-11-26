import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { OfflineBanner } from "@/components/OfflineBanner";
import { BRAND, SITE_URL } from "@/lib/config";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${BRAND.name} – ${BRAND.positioning}`, template: `%s | ${BRAND.name}` },
  description: "Rent, buy or sell homes, land and commercial property. Post your property and connect with buyers and tenants.",
  openGraph: { siteName: BRAND.name, type: "website", locale: "en_IN" },
};
export const viewport: Viewport = { themeColor: "#0B2545", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <Header />
        <OfflineBanner />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
