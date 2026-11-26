import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/config";
import { publicApi } from "@/lib/server-api";

export const revalidate = 3600;
/** Only published, non-demo listings and a few top-level pages. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base: MetadataRoute.Sitemap = ["", "/search?city=chennai&transaction=RENT", "/search?city=chennai&transaction=SALE", "/post-property", "/about", "/help", "/safety", "/pricing"].map((p) => ({ url: `${SITE_URL}${p}` }));
  try {
    const items = [];
    for (let page = 1; page <= 20; page++) {
      const r = await publicApi.search({ sort: "newest", page, pageSize: 50 });
      items.push(...r.items.filter((l) => !l.isDemo));
      if (page >= r.totalPages) break;
    }
    return [...base, ...items.map((l) => ({ url: `${SITE_URL}${l.path}`, lastModified: l.updatedAt }))];
  } catch { return base; }
}
