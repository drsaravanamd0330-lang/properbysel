import type { NextConfig } from "next";

const API = process.env.API_INTERNAL_URL ?? process.env.PUBLIC_API_URL ?? "http://localhost:4000";

const config: NextConfig = {
  transpilePackages: ["@pbs/api-client", "@pbs/domain", "@pbs/validation"],
  poweredByHeader: false,
  async rewrites() {
    // Public listing photos are served by the API, which checks visibility.
    return [{ source: "/v1/media/:id", destination: `${API}/v1/media/:id` }];
  },
  async headers() {
    return [{ source: "/(.*)", headers: [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
    ] }];
  },
};
export default config;
