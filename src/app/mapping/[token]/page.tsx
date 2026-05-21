import { notFound } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { MappingPortalTable } from "@/components/public/mapping-portal-table";
import { prisma } from "@/lib/db/prisma";
import { getAppSettings } from "@/lib/services/settings-store";
import { formatPhoneNumber } from "@/lib/utils/formatters";

export default async function MappingPortalPage({
  params
}: {
  params: { token: string };
}) {
  const settings = await getAppSettings();
  if (params.token !== settings.mappingPortalToken) {
    notFound();
  }

  const candidates = await prisma.candidate.findMany({
    where: {
      isArchived: false,
      currentStep: {
        gte: 4
      }
    },
    include: {
      user: true,
      documents: {
        where: {
          type: "elm"
        },
        orderBy: { uploadedAt: "desc" }
      },
      appointments: {
        where: {
          appointmentType: "DISCOVERY_DAY"
        },
        orderBy: { startDatetime: "desc" }
      },
      eventLogs: {
        where: {
          actionType: "CANDIDATE_APPLICATION_UPDATED"
        },
        orderBy: { createdAt: "desc" },
        take: 1
      }
    },
    orderBy: { updatedAt: "desc" }
  });

  return (
    <MappingPortalTable
      token={params.token}
      initialCandidates={candidates
        .map((candidate) => ({
          id: candidate.id,
          firstname: candidate.user.firstname,
          lastname: candidate.user.lastname,
          email: candidate.user.email,
          phone:
            formatPhoneNumber(
              candidate.user.phone ||
                ((candidate.eventLogs[0]?.detailsJson as { formData?: { phone?: string } } | null)?.formData?.phone ?? "")
            ) || "",
          discoveryDate: candidate.appointments[0]
            ? format(candidate.appointments[0].startDatetime, "dd/MM/yyyy", { locale: fr })
            : "-",
          elmFiles: candidate.documents.map((document) => ({
            id: document.id,
            fileName: document.fileName
          }))
        }))
        .sort((left, right) => {
          const leftPending = left.elmFiles.length === 0 ? 0 : 1;
          const rightPending = right.elmFiles.length === 0 ? 0 : 1;
          if (leftPending !== rightPending) {
            return leftPending - rightPending;
          }

          return left.lastname.localeCompare(right.lastname, "fr");
        })}
    />
  );
}
