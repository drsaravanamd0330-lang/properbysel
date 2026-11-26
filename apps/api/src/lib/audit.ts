import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = PrismaClient | Prisma.TransactionClient;

export function audit(db: Tx, actorId: string | null, action: string, entityType: string, entityId: string, meta: Record<string, unknown> = {}) {
  return db.auditLog.create({ data: { actorId, action, entityType, entityId, meta: meta as Prisma.InputJsonValue } });
}
