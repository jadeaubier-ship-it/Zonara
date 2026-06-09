import { prisma } from "@/lib/db/prisma";

export const CONTRACT_TEMPLATE_RESERVATION_TYPE = "contract_template_reservation";
export const CONTRACT_TEMPLATE_DEFINITIVE_TYPE = "contract_template_definitive";

export async function getContractTemplateDocuments() {
  const documents = await prisma.document.findMany({
    where: {
      candidateId: null,
      type: {
        in: [CONTRACT_TEMPLATE_RESERVATION_TYPE, CONTRACT_TEMPLATE_DEFINITIVE_TYPE]
      }
    },
    orderBy: [{ uploadedAt: "desc" }, { fileName: "asc" }]
  });

  return {
    reservationTemplate:
      documents.find((document) => document.type === CONTRACT_TEMPLATE_RESERVATION_TYPE) ?? null,
    definitiveTemplate:
      documents.find((document) => document.type === CONTRACT_TEMPLATE_DEFINITIVE_TYPE) ?? null
  };
}
