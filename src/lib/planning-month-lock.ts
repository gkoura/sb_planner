import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/** Serialize month mutations before reading state used to make decisions. */
export async function lockPlanningMonth(
    transaction: Prisma.TransactionClient,
    planningMonthId: string,
) {
    await transaction.$executeRaw`SET LOCAL lock_timeout = '3s'`;
    await transaction.$queryRaw`SELECT "id" FROM "PlanningMonth" WHERE "id" = ${planningMonthId} FOR UPDATE`;
}

export async function runLockedMonthTransaction<T>(
    transaction: (client: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
    return prisma.$transaction(transaction, {
        isolationLevel: "ReadCommitted",
    });
}

/** Return a retryable message when a concurrent operation outlives a transaction. */
export async function runMonthTransaction<T>(
    transaction: (client: Prisma.TransactionClient) => Promise<T>,
): Promise<T | { error: string }> {
    try {
        return await runLockedMonthTransaction(transaction);
    } catch (error) {
        if (isMonthTransactionConflict(error)) {
            return {
                error: "The planning month is busy or changed concurrently. Please try again.",
            };
        }
        throw error;
    }
}

export function isMonthTransactionConflict(error: unknown) {
    if (!error || typeof error !== "object" || !("code" in error)) return false;
    if (error.code === "P2028" || error.code === "P2034") return true;
    if (
        error.code !== "P2010" ||
        !("meta" in error) ||
        !error.meta ||
        typeof error.meta !== "object"
    )
        return false;
    const meta = error.meta;
    if ("code" in meta && meta.code === "55P03") return true;
    if (
        !("driverAdapterError" in meta) ||
        !meta.driverAdapterError ||
        typeof meta.driverAdapterError !== "object"
    )
        return false;
    const adapterError = meta.driverAdapterError;
    if (
        !("cause" in adapterError) ||
        !adapterError.cause ||
        typeof adapterError.cause !== "object"
    )
        return false;
    return "code" in adapterError.cause && adapterError.cause.code === "55P03";
}
