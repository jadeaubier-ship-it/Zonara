import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { getAppSettings } from "@/lib/services/settings-store";

export const CANDIDATE_PORTAL_DOCUMENTS = [
  { key: "questionnaire", label: "Formulaire de candidature", visibleFromStep: 2, requiredFromStep: 2, candidateCanUpload: false },
  { key: "cv", label: "CV", visibleFromStep: 2, requiredFromStep: 2, candidateCanUpload: false },
  { key: "retour_journee_decouverte", label: "Retour de la journée découverte", visibleFromStep: 4, requiredFromStep: 4, candidateCanUpload: false },
  { key: "elm", label: "ELM", visibleFromStep: 5, requiredFromStep: 5, candidateCanUpload: false },
  { key: "dip", label: "DIP", visibleFromStep: 5, requiredFromStep: 5, candidateCanUpload: false },
  { key: "plans_local", label: "Plan du local", visibleFromStep: 6, requiredFromStep: 7, candidateCanUpload: true },
  { key: "photos_local", label: "Photos du local", visibleFromStep: 6, requiredFromStep: 7, candidateCanUpload: true },
  { key: "business_plan", label: "Business plan", visibleFromStep: 6, requiredFromStep: 7, candidateCanUpload: true },
  { key: "kbis", label: "KBIS", visibleFromStep: 6, requiredFromStep: 7, candidateCanUpload: true },
  { key: "statuts", label: "Statuts de l'entreprise", visibleFromStep: 6, requiredFromStep: 7, candidateCanUpload: true },
  { key: "carte_identite", label: "Carte d'identité", visibleFromStep: 6, requiredFromStep: 7, candidateCanUpload: true },
  { key: "justificatif_domicile", label: "Justificatif de domicile", visibleFromStep: 6, requiredFromStep: 7, candidateCanUpload: true },
  { key: "rib_societe", label: "RIB de la société", visibleFromStep: 6, requiredFromStep: 7, candidateCanUpload: true },
  { key: "contrat_reservation_zone", label: "Contrat de réservation de zone", visibleFromStep: 8, requiredFromStep: 8, candidateCanUpload: false },
  { key: "contrat_definitif", label: "Contrat définitif", visibleFromStep: 8, requiredFromStep: 8, candidateCanUpload: false },
  { key: "plan_3d_local", label: "Plan 3D du local", visibleFromStep: 9, requiredFromStep: 9, candidateCanUpload: false },
  { key: "devis_menuisier", label: "Devis menuisier", visibleFromStep: 9, requiredFromStep: 9, candidateCanUpload: false },
  { key: "devis_menuisier_signe", label: "Devis menuisier signé", visibleFromStep: 9, requiredFromStep: 9, candidateCanUpload: true }
] as const;

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

export async function getCandidatePortalContext(token: string) {
  const [candidate, settings] = await Promise.all([
    prisma.candidate.findFirst({
      where: { onboardingToken: token },
      include: {
        user: true,
        documents: { orderBy: { uploadedAt: "desc" } },
        eventLogs: { orderBy: { createdAt: "desc" } },
        appointments: { orderBy: { startDatetime: "asc" } }
      }
    }),
    getAppSettings()
  ]);

  if (!candidate) {
    notFound();
  }

  const latestApplicationEvent = candidate.eventLogs.find((log) => log.actionType === "CANDIDATE_APPLICATION_UPDATED");
  const latestDiscoveryFeedbackEvent = candidate.eventLogs.find(
    (log) => log.actionType === "DISCOVERY_FEEDBACK_SUBMITTED"
  );

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
    candidate.documents.some((document) => document.type === "photo_profil" && document.fileUrl) &&
    candidate.documents.some((document) => document.type === "cv" && document.fileUrl);

  const hasDiscoveryFeedback =
    Boolean(discoveryData.firstname) &&
    Boolean(discoveryData.lastname) &&
    Boolean(discoveryData.discoveryDate) &&
    Boolean(discoveryData.discoveryFeedback) &&
    Boolean(discoveryData.improvementPoints) &&
    Boolean(discoveryData.continueJourney) &&
    (discoveryData.continueJourney !== "non" || Boolean(discoveryData.stopReason));

  const documents = CANDIDATE_PORTAL_DOCUMENTS.map((item) => {
    const uploaded = candidate.documents
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
          : uploaded[0]?.fileUrl ?? null;

    return {
      ...item,
      exists,
      href,
      fileName: uploaded[0]?.fileName ?? ""
      ,
      files:
        item.key === "questionnaire" || item.key === "retour_journee_decouverte"
          ? []
          : uploaded.map((document) => ({
              id: document.id,
              fileName: document.fileName,
              fileUrl: document.fileUrl ?? "",
              mimeType: document.mimeType
            })),
      isRequiredNow: candidate.currentStep >= item.requiredFromStep,
      isVisibleNow: candidate.currentStep >= item.visibleFromStep
    };
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
    candidate,
    settings,
    applicationData,
    discoveryData,
    documents,
    visibleDocumentStep
  };
}
