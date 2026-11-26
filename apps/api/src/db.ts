import { PrismaClient } from "@prisma/client";

// BigInt (paise) values are serialized as numbers; amounts stay well inside Number.MAX_SAFE_INTEGER.
(BigInt.prototype as unknown as { toJSON: () => number }).toJSON = function (this: bigint) { return Number(this); };

export const prisma = new PrismaClient();
export type Db = PrismaClient;
