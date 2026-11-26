import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";
export default function robots(): MetadataRoute.Robots {
  const prod = process.env.APP_ENV === "production";
  return { rules: prod ? [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/admin", "/api", "/login", "/post-property/"] }] : [{ userAgent: "*", disallow: "/" }], sitemap: `${SITE_URL}/sitemap.xml` };
}
