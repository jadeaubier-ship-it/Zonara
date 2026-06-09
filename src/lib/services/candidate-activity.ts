import { prisma } from "@/lib/db/prisma";
import { STEP_LABELS } from "@/lib/utils/constants";

function formatHistoryDate(date: Date | string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(date));
}

export async function getCandidateActivity(candidateId: string) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    select: {
      id: true,
      assignedDev: {
        select: {
          firstname: true,
          lastname: true
        }
      },
      notes: {
        include: {
          author: {
            select: {
              id: true,
              firstname: true,
              lastname: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 25
      },
      appointments: {
        orderBy: { startDatetime: "desc" },
        select: {
          id: true,
          appointmentType: true,
          startDatetime: true,
          endDatetime: true,
          status: true
        }
      },
      eventLogs: {
        include: {
          user: {
            select: {
              id: true,
              firstname: true,
              lastname: true
            }
          }
        },
        orderBy: { createdAt: "desc" },
        take: 40
      }
    }
  });

  if (!candidate) {
    return null;
  }

  const appointmentItems = (candidate.appointments ?? [])
    .filter((appointment) => appointment.status !== "CANCELLED")
    .map((appointment) => {
      const isDiscoveryDay = appointment.appointmentType === "DISCOVERY_DAY";
      const isTraining = appointment.appointmentType === "FORMATION";
      const interlocutorName = candidate.assignedDev
        ? `${candidate.assignedDev.firstname} ${candidate.assignedDev.lastname}`
        : "Atome3D";

      return {
        id: `appointment-${appointment.id}`,
        date: appointment.startDatetime,
        title: isDiscoveryDay ? "Journée découverte planifiée" : isTraining ? "Formation planifiée" : "Visio planifiée",
        description: isTraining
          ? `Formation prévue du ${formatHistoryDate(appointment.startDatetime)} au ${formatHistoryDate(
              appointment.endDatetime
            )}.`
          : `${isDiscoveryDay ? "Journée découverte" : "RDV visio"} prévue le ${formatHistoryDate(
              appointment.startDatetime
            )} avec ${interlocutorName}.`
      };
    });

  const eventItems = (candidate.eventLogs ?? [])
    .map((log) => {
      const details = log.detailsJson && typeof log.detailsJson === "object" ? log.detailsJson : {};
      const actorName = log.user ? `${log.user.firstname} ${log.user.lastname}`.trim() : "Système";

      switch (log.actionType) {
        case "STEP_CHANGED_MANUALLY": {
          const previousStep = Number((details as any).previousStep ?? 0);
          const nextStep = Number((details as any).nextStep ?? 0);
          return {
            id: `event-${log.id}`,
            date: log.createdAt,
            title: "Étape modifiée",
            description: `${actorName} a fait passer le candidat de "${STEP_LABELS[previousStep - 1] ?? `Étape ${previousStep}`}" à "${STEP_LABELS[nextStep - 1] ?? `Étape ${nextStep}`}".`
          };
        }
        case "CANDIDATE_DOCUMENT_UPDATED": {
          const type = String((details as any).type ?? "");
          const label = type || "document";
          if ((details as any).deletedFileName) {
            return {
              id: `event-${log.id}`,
              date: log.createdAt,
              title: "Document supprimé",
              description: `${actorName} a supprimé ${(details as any).deletedFileName} (${label}).`
            };
          }

          return {
            id: `event-${log.id}`,
            date: log.createdAt,
            title: "Document mis à jour",
            description: `${actorName} a ajouté ou remplacé ${(details as any).fileName ?? "un document"} (${label}).`
          };
        }
        case "CANDIDATE_APPLICATION_UPDATED":
          return {
            id: `event-${log.id}`,
            date: log.createdAt,
            title: "Dossier de candidature mis à jour",
            description: `${actorName} a mis à jour le dossier de candidature.`
          };
        case "CANDIDATE_APPLICATION_COMPLETED":
          return {
            id: `event-${log.id}`,
            date: log.createdAt,
            title: "Dossier de candidature complété",
            description: "Le candidat a complété son dossier de candidature."
          };
        case "DISCOVERY_FEEDBACK_SUBMITTED":
          return {
            id: `event-${log.id}`,
            date: log.createdAt,
            title: "Retour de journée découverte reçu",
            description: "Le formulaire de retour de la journée découverte a été complété."
          };
        case "DISCOVERY_DAY_INVITED":
          return {
            id: `event-${log.id}`,
            date: log.createdAt,
            title: "Invitation journée découverte envoyée",
            description: `${actorName} a envoyé l'invitation à la journée découverte.`
          };
        case "CALENDAR_APPOINTMENT_CANCELLED": {
          const appointmentType = String((details as any).appointmentType ?? "");
          return {
            id: `event-${log.id}`,
            date: log.createdAt,
            title: "Rendez-vous annulé",
            description: appointmentType === "DISCOVERY_DAY" ? "Journée découverte annulée" : "RDV visio annulé"
          };
        }
        case "CALENDAR_APPOINTMENT_RESCHEDULED": {
          const appointmentType = String((details as any).appointmentType ?? "");
          const startDatetime =
            typeof (details as any).startDatetime === "string" ? (details as any).startDatetime : log.createdAt;
          return {
            id: `event-${log.id}`,
            date: log.createdAt,
            title: "Rendez-vous déplacé",
            description: `${
              appointmentType === "DISCOVERY_DAY" ? "Journée découverte déplacée" : "RDV visio déplacé"
            } au ${formatHistoryDate(startDatetime)}`
          };
        }
        case "DISCOVERY_FOLLOWUP_SENT":
          return {
            id: `event-${log.id}`,
            date: log.createdAt,
            title: "Suivi après journée découverte envoyé",
            description: "Le mail de retour de journée découverte et la notification mapping ont été envoyés."
          };
        case "CANDIDATE_APPLICATION_INVITED":
          return {
            id: `event-${log.id}`,
            date: log.createdAt,
            title: "Invitation dossier envoyée",
            description: `${actorName} a envoyé le mail d'invitation au dossier de candidature.`
          };
        case "CANDIDATE_PHOTO_UPDATED":
          return {
            id: `event-${log.id}`,
            date: log.createdAt,
            title: "Photo mise à jour",
            description: `${actorName} a mis à jour la photo du candidat.`
          };
        case "CANDIDATE_ARCHIVED":
          return {
            id: `event-${log.id}`,
            date: log.createdAt,
            title: "Candidat archivé",
            description: `${actorName} a archivé le candidat.`
          };
        case "CANDIDATE_UNARCHIVED":
          return {
            id: `event-${log.id}`,
            date: log.createdAt,
            title: "Candidat désarchivé",
            description: `${actorName} a désarchivé le candidat.`
          };
        default:
          return null;
      }
    })
    .filter(Boolean);

  const historyItems = [...appointmentItems, ...eventItems].sort(
    (a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return {
    notes: candidate.notes,
    historyItems
  };
}
