import { prisma } from "@/lib/db/prisma";

export async function logEvent(input: {
  actionType: string;
  userId?: string;
  candidateId?: string;
  franchiseeId?: string;
  detailsJson?: Record<string, unknown>;
}) {
  return prisma.eventLog.create({
    data: {
      actionType: input.actionType,
      userId: input.userId,
      candidateId: input.candidateId,
      franchiseeId: input.franchiseeId,
      detailsJson: input.detailsJson ?? {}
    }
  });
}
