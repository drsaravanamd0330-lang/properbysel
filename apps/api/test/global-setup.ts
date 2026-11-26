import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

/** Applies migrations to the dedicated test database and empties its tables. Refuses any non-test database. */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://pbs:pbs@localhost:5432/properbysel_test";
  if (!/_test(\?|$)/.test(url)) throw new Error("TEST_DATABASE_URL must point to a database whose name ends in _test");
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
  const db = new PrismaClient({ datasourceUrl: url });
  const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  await db.$disconnect();
}
