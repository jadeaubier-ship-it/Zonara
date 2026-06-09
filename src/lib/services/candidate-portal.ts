import { notFound } from "next/navigation";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { prisma } from "@/lib/db/prisma";
import { syncCandidateContractEnvelopeState, syncCandidateDipEnvelopeState } from "@/lib/services/docusign-sync";
import { getAppSettings } from "@/lib/services/settings-store";

export const CANDIDATE_PORTAL_DOCUMENTS = [
  { key: "questionnaire", label: "Formulaire de candidature", visibleFromStep: 2, requiredFromStep: 2, candidateCanUpload: false },
  { key: "cv", label: "CV", visibleFromStep: 2, requiredFromStep: 2, candidateCanUpload: false },
  { key: "retour_journee_decouverte", label: "Retour de la journée découverte", visibleFromStep: 4, requiredFromStep: 4, candidateCanUpload: false },
  { key: "elm", label: "ELM", visibleFromStep: 5, requiredFromStep: 5, candidateCanUpload: false },
  { key: "dip", label: "DIP", visibleFromStep: 5, requiredFromStep: 5, candidateCanUpload: false },
  { key: "business_plan", label: "Business plan", visibleFromStep: 6, requiredFromStep: 7, candidateCanUpload: true },
  { key: "kbis", label: "KBIS", visibleFromStep: 6, requiredFromStep: 99, candidateCanUpload: true },
  { key: "statuts", label: "Statuts de l'entreprise", visibleFromStep: 6, requiredFromStep: 7, candidateCanUpload: true },
  { key: "carte_identite", label: "Carte d'identité", visibleFromStep: 6, requiredFromStep: 7, candidateCanUpload: true },
  { key: "justificatif_domicile", label: "Justificatif de domicile", visibleFromStep: 6, requiredFromStep: 7, candidateCanUpload: true },
  { key: "rib_societe", label: "RIB de la société", visibleFromStep: 6, requiredFromStep: 99, candidateCanUpload: true },
  { key: "contrat_reservation_zone", label: "Contrat de réservation de zone", visibleFromStep: 8, requiredFromStep: 8, candidateCanUpload: false },
  { key: "contrat_definitif", label: "Contrat définitif", visibleFromStep: 8, requiredFromStep: 8, candidateCanUpload: false },
  { key: "plan_3d_local", label: "Plan 3D du local", visibleFromStep: 9, requiredFromStep: 9, candidateCanUpload: false },
  { key: "devis_menuisier", label: "Devis menuisier", visibleFromStep: 9, requiredFromStep: 9, candidateCanUpload: false },
  { key: "devis_menuisier_signe", label: "Devis menuisier signé", visibleFromStep: 9, requiredFromStep: 9, candidateCanUpload: true }
] as const;

const DEVELOPER_RELEASED_CANDIDATE_DOCUMENT_KEYS = new Set([
  "contrat_reservation_zone",
  "contrat_definitif",
  "plan_3d_local",
  "devis_menuisier"
]);

export const CANDIDATE_STEP_EXPECTATIONS = [
  [
    "Prendre contact avec l'équipe Atome3D.",
    "Recevoir le lien vers le dossier de candidature."
  ],
  [
    "Compléter le dossier de candidature.",
    "Téléverser votre photo et votre CV."
  ],
  [
    "Réserver votre visio.",
    "Préparer vos questions et votre projet."
  ],
  [
    "Réserver votre journée découverte.",
    "Participer à la journée en présentiel."
  ],
  [
    "Remplir votre retour de journée découverte.",
    "Contacter le responsable mapping pour l'ELM."
  ],
  [
    "Partager vos pistes de locaux et vos plans.",
    "Déposer vos premières pièces société et administratives."
  ],
  [
    "Rendre obligatoires les pièces société demandées.",
    "Finaliser les éléments administratifs pour passer au contrat."
  ],
  [
    "Télécharger le contrat de réservation ou le contrat définitif.",
    "Recevoir vos dates de formation."
  ],
  [
    "Consulter le plan 3D et le devis menuisier.",
    "Renvoyer le devis menuisier signé."
  ],
  [
    "Finaliser l'ouverture.",
    "Passer officiellement franchisé."
  ]
] as const;

export async function getCandidatePortalCandidate(token: string) {
  const candidate = await prisma.candidate.findFirst({
    where: { onboardingToken: token },
    select: {
      id: true,
      currentStep: true,
      projectZone: true,
      city: true,
      zipcode: true,
      user: {
        select: {
          firstname: true,
          lastname: true,
          email: true,
          phone: true
        }
      }
    }
  });

  if (!candidate) {
    notFound();
  }

  return candidate;
}

export async function getCandidatePortalLayoutContext() {
  const settings = await getAppSettings();

  return { settings };
}

export async function getCandidatePortalContext(token: string) {
  const [candidate, settings] = await Promise.all([getCandidatePortalCandidate(token), getAppSettings()]);

  await Promise.race([
    Promise.allSettled([
      syncCandidateDipEnvelopeState(candidate.id, { skipIfFreshMs: 180_000 }),
      syncCandidateContractEnvelopeState(candidate.id, { skipIfFreshMs: 180_000 })
    ]),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 800))
  ]).catch(() => null);

  const [documentRecords, profilePhoto, eventLogs, appointments, docusignEnvelopes] = await Promise.all([
    prisma.document.findMany({
      where: {
        candidateId: candidate.id,
        type: {
          in: [...CANDIDATE_PORTAL_DOCUMENTS.map((item) => item.key), "photo_profil"]
        }
      },
      orderBy: { uploadedAt: "desc" },
      select: {
        id: true,
        type: true,
        fileName: true,
        mimeType: true,
        uploadedAt: true
      }
    }),
    prisma.document.findFirst({
      where: {
        candidateId: candidate.id,
        type: "photo_profil"
      },
      orderBy: { uploadedAt: "desc" },
      select: {
        fileUrl: true
      }
    }),
    prisma.eventLog.findMany({
      where: {
        candidateId: candidate.id,
        actionType: {
          in: ["CANDIDATE_APPLICATION_UPDATED", "DISCOVERY_FEEDBACK_SUBMITTED"]
        }
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        actionType: true,
        detailsJson: true
      }
    }),
    prisma.appointment.findMany({
      where: { candidateId: candidate.id },
      orderBy: { startDatetime: "asc" },
      select: {
        id: true,
        appointmentType: true,
        startDatetime: true,
        endDatetime: true,
        status: true
      }
    }),
    prisma.docuSignEnvelope.findMany({
      where: {
        candidateId: candidate.id,
        stepNumber: 5
      },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: {
        status: true,
        updatedAt: true
      }
    })
  ]);

  const localProjects = await prisma.localProject.findMany({
    where: { candidateId: candidate.id },
    orderBy: { id: "desc" },
    select: {
      id: true,
      address: true,
      city: true,
      zipcode: true,
      surfaceM2: true,
      notesCandidate: true,
      status: true,
      files: {
        orderBy: { uploadedAt: "desc" },
        select: {
          id: true,
          fileType: true,
          uploadedAt: true
        }
      }
    }
  });

  const latestApplicationEvent = eventLogs.find((log) => log.actionType === "CANDIDATE_APPLICATION_UPDATED");
  const latestDiscoveryFeedbackEvent = eventLogs.find((log) => log.actionType === "DISCOVERY_FEEDBACK_SUBMITTED");

  const applicationData =
    latestApplicationEvent?.detailsJson && typeof latestApplicationEvent.detailsJson === "object"
      ? ((latestApplicationEvent.detailsJson as any).formData ?? {})
      : {};
  const discoveryData =
    latestDiscoveryFeedbackEvent?.detailsJson && typeof latestDiscoveryFeedbackEvent.detailsJson === "object"
      ? ((latestDiscoveryFeedbackEvent.detailsJson as any).formData ?? {})
      : {};

  const hasQuestionnaire =
    Boolean(applicationData.firstname) &&
    Boolean(applicationData.lastname) &&
    Boolean(applicationData.email) &&
    Boolean(applicationData.phone) &&
    Boolean(applicationData.address) &&
    Boolean(applicationData.city) &&
    Boolean(applicationData.zipcode) &&
    Boolean(applicationData.birthDate) &&
    Boolean(applicationData.familySituation) &&
    Boolean(applicationData.childrenCount) &&
    Boolean(applicationData.profession) &&
    Boolean(applicationData.professionalSituation) &&
    Boolean(applicationData.projectZone) &&
    Boolean(applicationData.projectZipcode) &&
    Boolean(applicationData.projectDelay) &&
    Boolean(applicationData.personalContribution) &&
    Boolean(applicationData.motivation) &&
    Boolean(applicationData.entrepreneurshipExperience) &&
    Boolean(profilePhoto?.fileUrl) &&
    documentRecords.some((document) => document.type === "cv");

  const hasDiscoveryFeedback =
    Boolean(discoveryData.firstname) &&
    Boolean(discoveryData.lastname) &&
    Boolean(discoveryData.discoveryDate) &&
    Boolean(discoveryData.discoveryFeedback) &&
    Boolean(discoveryData.improvementPoints) &&
    Boolean(discoveryData.continueJourney) &&
    (discoveryData.continueJourney !== "non" || Boolean(discoveryData.stopReason));

  const latestCompletedDipEnvelope = docusignEnvelopes.find((envelope) => envelope.status === "COMPLETED") ?? null;
  const dipLegalDelay =
    candidate.currentStep === 5 && latestCompletedDipEnvelope?.updatedAt
      ? (() => {
          const signedAt = new Date(latestCompletedDipEnvelope.updatedAt);
          const deadline = addDays(signedAt, 20);
          const remainingDays = Math.max(0, differenceInCalendarDays(deadline, new Date()));
          return {
            remainingDays,
            badgeLabel: `J-${remainingDays} jours`,
            deadlineLabel: `Fin de délai légal du DIP`,
            deadlineDateLabel: format(deadline, "dd/MM/yyyy", { locale: fr }),
            deadline
          };
        })()
      : null;

  const documents = CANDIDATE_PORTAL_DOCUMENTS.map((item) => {
    const uploaded = documentRecords
      .filter((document) => document.type === item.key)
      .sort((left, right) => right.uploadedAt.getTime() - left.uploadedAt.getTime());

    const exists =
      item.key === "questionnaire"
        ? hasQuestionnaire
        : item.key === "retour_journee_decouverte"
          ? hasDiscoveryFeedback
          : uploaded.length > 0;

    const href =
      item.key === "questionnaire"
        ? exists
          ? `/espace-candidat/${token}/documents/questionnaire`
          : null
        : item.key === "retour_journee_decouverte"
          ? exists
            ? `/espace-candidat/${token}/documents/retour-journee`
            : null
          : uploaded[0]
            ? `/api/public/candidate-space/${token}/documents/${uploaded[0].id}`
            : null;

    return {
      ...item,
      exists,
      href,
      fileName: uploaded[0]?.fileName ?? "",
      files:
        item.key === "questionnaire" || item.key === "retour_journee_decouverte"
          ? []
          : uploaded.map((document) => ({
              id: document.id,
              fileName: document.fileName,
              href: `/api/public/candidate-space/${token}/documents/${document.id}`,
              mimeType: document.mimeType
            })),
      isRequiredNow: candidate.currentStep >= item.requiredFromStep,
      isVisibleNow: candidate.currentStep >= item.visibleFromStep,
      badgeLabel: item.key === "dip" ? dipLegalDelay?.badgeLabel ?? "" : "",
      secondaryLabel: item.key === "dip" ? dipLegalDelay?.deadlineLabel ?? "" : ""
    };
  }).filter((document) => {
    if (!DEVELOPER_RELEASED_CANDIDATE_DOCUMENT_KEYS.has(document.key)) {
      return true;
    }

    return document.exists;
  });

  const visibleDocumentStep = (() => {
    const currentStepHasDocuments = documents.some((document) => document.visibleFromStep === candidate.currentStep);

    if (currentStepHasDocuments) {
      return candidate.currentStep;
    }

    const nextVisible = documents.find((document) => document.visibleFromStep > candidate.currentStep);
    return nextVisible?.visibleFromStep ?? candidate.currentStep;
  })();

  return {
    candidate: {
      ...candidate,
      appointments,
      docusignEnvelopes
    },
    settings,
    applicationData,
    discoveryData,
    documents,
    localProjects: localProjects.map((project) => ({
      id: project.id,
      address: project.address,
      city: project.city,
      zipcode: project.zipcode,
      surfaceM2: project.surfaceM2,
      monthlyRentHt:
        project.notesCandidate && typeof project.notesCandidate === "string"
          ? (() => {
              try {
                return JSON.parse(project.notesCandidate).monthlyRentHt ?? "";
              } catch {
                return "";
              }
            })()
          : "",
      monthlyChargesHt:
        project.notesCandidate && typeof project.notesCandidate === "string"
          ? (() => {
              try {
                return JSON.parse(project.notesCandidate).monthlyChargesHt ?? "";
              } catch {
                return "";
              }
            })()
          : "",
      status: project.status,
      files: project.files.map((file) => {
        const [kind, ...nameParts] = file.fileType.split("::");
        const fileName = nameParts.join("::") || (kind === "plan" ? "Plan du local" : "Photo du local");

        return {
          id: file.id,
          kind,
          fileName,
          href: `/api/public/candidate-space/${token}/local-projects/${project.id}/files/${file.id}`
        };
      })
    })),
    visibleDocumentStep,
    dipLegalDelay,
    profilePhotoUrl: profilePhoto?.fileUrl ?? null
  };
}
