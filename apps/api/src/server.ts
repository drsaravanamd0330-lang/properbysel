import { buildApp } from "./app";
import { prisma } from "./db";
import { loadConfig } from "./config";
import { expireListings } from "./jobs";

const cfg = loadConfig(); // throws on unsafe production settings
const { app } = await buildApp({ cfg, db: prisma });

const timer = setInterval(() => { expireListings(prisma).catch((e) => app.log.error(e)); }, 15 * 60_000);
const close = async () => { clearInterval(timer); await app.close(); await prisma.$disconnect(); process.exit(0); };
process.on("SIGINT", close);
process.on("SIGTERM", close);

await app.listen({ port: cfg.API_PORT, host: "0.0.0.0" });
