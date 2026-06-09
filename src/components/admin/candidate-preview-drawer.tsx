"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { fr } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { ApplicationInvitationModal } from "@/components/admin/application-invitation-modal";
import { DipPreparationPanel } from "@/components/admin/dip-preparation-panel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CandidateMiniMap } from "@/components/maps/candidate-mini-map";
import { getStepTheme, STEP_LABELS } from "@/lib/utils/constants";
import { formatPhoneNumber } from "@/lib/utils/formatters";

type CandidatePreviewDrawerProps = {
  candidateId: string | null;
  onClose: () => void;
};

type DipPreparationPayload = {
  candidate: {
    id: string;
    firstname: string;
    lastname: string;
    email: string;
    currentStep: number;
    projectZone: string;
    projectZipcode: string;
  };
  frozenAt: string | null;
  sentEnvelopeId: string | null;
  version: string;
  docusignTemplateId: string;
  docusignTemplateRoleName: string;
  mainDipDocument: {
    id: string;
    fileName: string;
    fileUrl: string;
    mimeType: string;
    uploadedAt: string;
  } | null;
  templateAnnexes: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    mimeType: string;
    uploadedAt: string;
  }>;
  elmFiles: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    mimeType: string;
    uploadedAt: string;
  }>;
};

type ContractTemplatePayload = {
  reservationTemplate: {
    id: string;
    fileName: string;
    fileUrl: string;
    mimeType: string;
    uploadedAt: string;
  } | null;
  definitiveTemplate: {
    id: string;
    fileName: string;
    fileUrl: string;
    mimeType: string;
    uploadedAt: string;
  } | null;
};

type DrawerDocumentFile = {
  id: string;
  fileUrl?: string | null;
  fileName?: string;
};

type DrawerNote = {
  id: string;
  noteText: string;
  createdAt: string;
  author: {
    id: string;
    firstname: string;
    lastname: string;
  };
};

type DrawerHistoryItem = {
  id: string;
  date: string;
  title: string;
  description: string;
};

const DOCUMENT_LABELS: Array<{ type: string; label: string }> = [
  { type: "questionnaire", label: "Formulaire de candidature" },
  { type: "cv", label: "CV" },
  { type: "retour_journee_decouverte", label: "Retour de la journée découverte" },
  { type: "elm", label: "ELM" },
  { type: "dip", label: "DIP" },
  { type: "business_plan", label: "Business plan" },
  { type: "kbis", label: "KBIS" },
  { type: "statuts", label: "Statuts de l'entreprise" },
  { type: "carte_identite", label: "Carte d'identité" },
  { type: "justificatif_domicile", label: "Justificatif de domicile" },
  { type: "rib_societe", label: "RIB de la société" },
  { type: "contrat_reservation_zone", label: "Contrat de réservation de zone" },
  { type: "contrat_definitif", label: "Contrat définitif" },
  { type: "plan_3d_local", label: "Plan 3D du local" },
  { type: "devis_menuisier", label: "Devis menuisier" },
  { type: "devis_menuisier_signe", label: "Devis menuisier signé" }
];

const DOCUMENT_STEP_BY_TYPE: Record<string, number> = {
  questionnaire: 2,
  cv: 2,
  retour_journee_decouverte: 4,
  elm: 5,
  dip: 5,
  business_plan: 6,
  kbis: 6,
  statuts: 6,
  carte_identite: 6,
  justificatif_domicile: 6,
  rib_societe: 6,
  contrat_reservation_zone: 8,
  contrat_definitif: 8,
  plan_3d_local: 9,
  devis_menuisier: 9,
  devis_menuisier_signe: 9
};

const REQUIRED_APPLICATION_DRAWER_KEYS = [
  "firstname",
  "lastname",
  "email",
  "phone",
  "address",
  "city",
  "zipcode",
  "birthDate",
  "familySituation",
  "childrenCount",
  "profession",
  "professionalSituation",
  "projectZone",
  "projectZipcode",
  "projectDelay",
  "personalContribution",
  "motivation",
  "entrepreneurshipExperience"
] as const;

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  questionnaire: "formulaire de candidature",
  cv: "CV",
  retour_journee_decouverte: "retour de la journée découverte",
  elm: "ELM",
  dip: "DIP",
  business_plan: "business plan",
  kbis: "KBIS",
  statuts: "statuts de l'entreprise",
  carte_identite: "carte d'identité",
  justificatif_domicile: "justificatif de domicile",
  rib_societe: "RIB de la société",
  contrat_reservation_zone: "contrat de réservation de zone",
  contrat_definitif: "contrat définitif",
  plan_3d_local: "plan 3D du local",
  devis_menuisier: "devis menuisier",
  devis_menuisier_signe: "devis menuisier signé",
  photo_profil: "photo de profil"
};

function formatHistoryDate(date: Date | string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(date));
}

function isAlertNote(noteText: string) {
  const normalized = noteText.toLowerCase();
  return normalized.includes("annul") || normalized.includes("déplac") || normalized.includes("deplac");
}

export function CandidatePreviewDrawer({ candidateId, onClose }: CandidatePreviewDrawerProps) {
  const router = useRouter();
  const [candidate, setCandidate] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stepPickerOpen, setStepPickerOpen] = useState(false);
  const [isSavingStep, setIsSavingStep] = useState(false);
  const [applicationFormOpen, setApplicationFormOpen] = useState(false);
  const [applicationPreviewOpen, setApplicationPreviewOpen] = useState(false);
  const [discoveryFeedbackPreviewOpen, setDiscoveryFeedbackPreviewOpen] = useState(false);
  const [dipPreparationOpen, setDipPreparationOpen] = useState(false);
  const [contractModalOpen, setContractModalOpen] = useState(false);
  const [contractTemplateLoading, setContractTemplateLoading] = useState(false);
  const [contractTemplateData, setContractTemplateData] = useState<ContractTemplatePayload | null>(null);
  const [trainingStartDate, setTrainingStartDate] = useState("");
  const [trainingEndDate, setTrainingEndDate] = useState("");
  const [isSavingTrainingDates, setIsSavingTrainingDates] = useState(false);
  const [dipPreparationLoading, setDipPreparationLoading] = useState(false);
  const [dipPreparationError, setDipPreparationError] = useState("");
  const [dipPreparationData, setDipPreparationData] = useState<DipPreparationPayload | null>(null);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadingDocumentType, setUploadingDocumentType] = useState<string | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [showFutureDocuments, setShowFutureDocuments] = useState(false);
  const [showPastDocuments, setShowPastDocuments] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityNotes, setActivityNotes] = useState<DrawerNote[]>([]);
  const [activityHistoryItems, setActivityHistoryItems] = useState<DrawerHistoryItem[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [isArchivingCandidate, setIsArchivingCandidate] = useState(false);
  const [isTestingDiscoveryFollowup, setIsTestingDiscoveryFollowup] = useState(false);
  const [invitationModalOpen, setInvitationModalOpen] = useState(false);
  const [discoveryInvitationModalOpen, setDiscoveryInvitationModalOpen] = useState(false);
  const [isSimulatingDipFinished, setIsSimulatingDipFinished] = useState(false);
  const [processingLocalProjectId, setProcessingLocalProjectId] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [now, setNow] = useState(() => new Date());

  const trainingAppointment = candidate?.appointments?.find((appointment: any) => appointment.appointmentType === "FORMATION") ?? null;

  async function openDipPreparationModal() {
    if (!candidate) return;
    setDipPreparationOpen(true);
    setDipPreparationLoading(true);
    setDipPreparationError("");

    try {
      const response = await fetch(`/api/admin/candidates/${candidate.id}/dip`);
      const data = (await response.json().catch(() => null)) as DipPreparationPayload | { error?: string } | null;
      if (!response.ok) {
        throw new Error((data as { error?: string } | null)?.error ?? "Impossible de charger la préparation du DIP.");
      }
      setDipPreparationData(data as DipPreparationPayload);
    } catch (err) {
      setDipPreparationError(err instanceof Error ? err.message : "Impossible de charger la préparation du DIP.");
    } finally {
      setDipPreparationLoading(false);
    }
  }

  async function handleRelaunchDipSignature() {
    if (!candidate) return;

    const confirmed = window.confirm("Voulez-vous relancer la signature de réception du DIP ?");
    if (!confirmed) return;

    setError("");

    try {
      const response = await fetch("/api/docusign/send-envelope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: candidate.id, forceResend: true })
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? "Impossible de relancer la signature du DIP.");
      }

      const refreshedCandidate = await syncCandidate(candidate.id);
      setCandidate(refreshedCandidate);
      setError("Signature du DIP relancée.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de relancer la signature du DIP.");
    }
  }

  async function handleSaveTrainingDates() {
    if (!candidate) return;
    if (!trainingStartDate || !trainingEndDate) {
      setError("Les dates de formation sont obligatoires.");
      return;
    }

    setIsSavingTrainingDates(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/candidates/${candidate.id}/training-dates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: trainingStartDate,
          endDate: trainingEndDate
        })
      });

      const data = (await response.json().catch(() => null)) as { error?: string; advancedToStep9?: boolean } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? "Impossible d’enregistrer les dates de formation.");
      }

      const refreshedCandidate = await syncCandidate(candidate.id);
      setCandidate(refreshedCandidate);
      setError(data?.advancedToStep9 ? "Dates de formation enregistrées. Passage à Devis menuisier effectué." : "Dates de formation enregistrées.");
      setContractModalOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d’enregistrer les dates de formation.");
    } finally {
      setIsSavingTrainingDates(false);
    }
  }

  async function handleSimulateDipFinished() {
    if (!candidate) return;

    const confirmed = window.confirm("Simuler la fin du délai légal du DIP et faire passer le candidat à l’étape suivante ?");
    if (!confirmed) return;

    setIsSimulatingDipFinished(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/candidates/${candidate.id}/dip-finished`, {
        method: "POST"
      });
      const data = (await response.json().catch(() => null)) as { error?: string; alreadyCompleted?: boolean } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Impossible de simuler la fin du délai DIP.");
      }

      const refreshedCandidate = await syncCandidate(candidate.id);
      setCandidate(refreshedCandidate);
      setError(data?.alreadyCompleted ? "La fin du délai DIP était déjà enregistrée." : "Fin du délai DIP simulée.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de simuler la fin du délai DIP.");
    } finally {
      setIsSimulatingDipFinished(false);
    }
  }

  async function handleValidateLocalProject(projectId: string) {
    if (!candidate) return;

    setProcessingLocalProjectId(projectId);
    setError("");

    try {
      const response = await fetch(`/api/admin/candidates/${candidate.id}/local-projects/${projectId}`, {
        method: "PATCH"
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Impossible de valider ce projet de local.");
      }

      const refreshedCandidate = await syncCandidate(candidate.id);
      setCandidate(refreshedCandidate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de valider ce projet de local.");
    } finally {
      setProcessingLocalProjectId(null);
    }
  }

  async function handleInvalidateLocalProject(projectId: string) {
    if (!candidate) return;

    const confirmed = window.confirm("Êtes-vous sûr de vouloir invalider ce local ?");
    if (!confirmed) return;

    setProcessingLocalProjectId(projectId);
    setError("");

    try {
      const response = await fetch(`/api/admin/candidates/${candidate.id}/local-projects/${projectId}`, {
        method: "DELETE"
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Impossible d'invalider ce projet de local.");
      }

      const refreshedCandidate = await syncCandidate(candidate.id);
      setCandidate(refreshedCandidate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'invalider ce projet de local.");
    } finally {
      setProcessingLocalProjectId(null);
    }
  }

  const loadCandidate = async (id: string) => {
    const response = await fetch(`/api/admin/candidates/${id}`);

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Impossible de charger le candidat.");
    }

    return response.json();
  };

  const loadCandidateActivity = async (id: string) => {
    const response = await fetch(`/api/admin/candidates/${id}/activity`);

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Impossible de charger l'activité du candidat.");
    }

    return (await response.json()) as {
      notes: DrawerNote[];
      historyItems: DrawerHistoryItem[];
    };
  };

  const syncCandidate = async (id: string) => {
    const data = await loadCandidate(id);

    setCandidate((current: any) => {
      if (current && current.currentStep !== data.currentStep) {
        window.setTimeout(() => router.refresh(), 0);
      }

      return data;
    });

    return data;
  };

  const syncCandidateActivity = async (id: string) => {
    setActivityLoading(true);

    try {
      const data = await loadCandidateActivity(id);
      setActivityNotes(data.notes ?? []);
      setActivityHistoryItems(data.historyItems ?? []);
      return data;
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    if (!candidateId) return;

    let isActive = true;
    setLoading(true);
    setError("");

    syncCandidate(candidateId)
      .then(() => {
        if (!isActive) return;
      })
      .catch((err: Error) => {
        if (isActive) setError(err.message);
      })
      .finally(() => {
        if (isActive) setLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [candidateId]);

  useEffect(() => {
    if (!candidateId) return;

    let isActive = true;
    setActivityLoading(true);

    loadCandidateActivity(candidateId)
      .then((data) => {
        if (!isActive) return;
        setActivityNotes(data.notes ?? []);
        setActivityHistoryItems(data.historyItems ?? []);
      })
      .catch(() => {
        if (!isActive) return;
        setActivityNotes([]);
        setActivityHistoryItems([]);
      })
      .finally(() => {
        if (isActive) setActivityLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [candidateId]);

  useEffect(() => {
    if (!candidateId) {
      setCandidate(null);
      setError("");
      setStepPickerOpen(false);
      setActivityNotes([]);
      setActivityHistoryItems([]);
    }
  }, [candidateId]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(new Date());
    }, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!contractModalOpen) return;

    if (trainingAppointment) {
      setTrainingStartDate(format(new Date(trainingAppointment.startDatetime), "yyyy-MM-dd"));
      setTrainingEndDate(format(new Date(trainingAppointment.endDatetime), "yyyy-MM-dd"));
    } else {
      setTrainingStartDate("");
      setTrainingEndDate("");
    }
  }, [contractModalOpen, trainingAppointment]);

  useEffect(() => {
    let cancelled = false;

    async function loadContractTemplates() {
      if (!contractModalOpen) return;

      setContractTemplateLoading(true);
      try {
        const response = await fetch("/api/admin/contract-template");
        if (!response.ok) {
          throw new Error("Impossible de charger les modèles de contrat.");
        }
        const data = (await response.json()) as ContractTemplatePayload;
        if (!cancelled) {
          setContractTemplateData(data);
        }
      } catch {
        if (!cancelled) {
          setContractTemplateData(null);
        }
      } finally {
        if (!cancelled) {
          setContractTemplateLoading(false);
        }
      }
    }

    void loadContractTemplates();

    return () => {
      cancelled = true;
    };
  }, [contractModalOpen]);

  const currentStepLabel = candidate ? STEP_LABELS[candidate.currentStep - 1] ?? `Étape ${candidate.currentStep}` : "";
  const currentStepTheme = candidate ? getStepTheme(candidate.currentStep) : getStepTheme(1);
  const profilePhoto = candidate?.documents?.find((document: any) => document.type === "photo_profil");
  const candidateLocationLabel = candidate?.projectZone?.trim() || candidate?.city || "";
  const applicationFormData = useMemo(() => {
    const latestFormEvent = candidate?.eventLogs?.find((log: any) => log.actionType === "CANDIDATE_APPLICATION_UPDATED");
    const raw = latestFormEvent?.detailsJson && typeof latestFormEvent.detailsJson === "object" ? (latestFormEvent.detailsJson as any).formData : {};

    return {
      firstname: candidate?.user?.firstname ?? "",
      lastname: candidate?.user?.lastname ?? "",
      email: candidate?.user?.email ?? "",
      phone: candidate?.user?.phone ?? raw?.phone ?? "",
      address: candidate?.address ?? raw?.address ?? "",
      city: candidate?.city ?? raw?.city ?? "",
      zipcode: candidate?.zipcode ?? raw?.zipcode ?? "",
      birthDate: candidate?.birthDate ?? raw?.birthDate ?? "",
      birthPlace: raw?.birthPlace ?? "",
      familySituation: candidate?.familySituation ?? raw?.familySituation ?? "",
      childrenCount: candidate?.childrenCount ?? raw?.childrenCount ?? "",
      profession: candidate?.profession ?? raw?.profession ?? "",
      professionalSituation: candidate?.professionalSituation ?? raw?.professionalSituation ?? "",
      projectZone: candidate?.projectZone ?? raw?.projectZone ?? "",
      projectZipcode: raw?.projectZipcode ?? "",
      projectDelay: candidate?.projectDelay ?? raw?.projectDelay ?? "",
      personalContribution: candidate?.personalContribution ?? raw?.personalContribution ?? "",
      motivation: candidate?.motivation ?? raw?.motivation ?? "",
      entrepreneurshipExperience: candidate?.entrepreneurshipExperience ?? raw?.entrepreneurshipExperience ?? "",
      notes: candidate?.applicationNotes ?? raw?.notes ?? ""
    };
  }, [candidate]);
  const candidateDisplayPhone = candidate?.user?.phone || applicationFormData.phone || "";
  const hasProfilePhoto = Boolean(profilePhoto?.fileUrl);
  const hasCv = Boolean(candidate?.documents?.find((document: any) => document.type === "cv"));
  const hasDiscoveryFeedback = Boolean(
    candidate?.eventLogs?.find((log: any) => log.actionType === "DISCOVERY_FEEDBACK_SUBMITTED")
  );
  const discoveryFeedbackData = useMemo(() => {
    const latestFeedbackEvent = candidate?.eventLogs?.find(
      (log: any) => log.actionType === "DISCOVERY_FEEDBACK_SUBMITTED"
    );
    const raw =
      latestFeedbackEvent?.detailsJson && typeof latestFeedbackEvent.detailsJson === "object"
        ? ((latestFeedbackEvent.detailsJson as any).formData ?? {})
        : {};

    return {
      firstname: raw.firstname ?? candidate?.user?.firstname ?? "",
      lastname: raw.lastname ?? candidate?.user?.lastname ?? "",
      discoveryDate: raw.discoveryDate ?? "",
      discoveryFeedback: raw.discoveryFeedback ?? "",
      improvementPoints: raw.improvementPoints ?? "",
      continueJourney: raw.continueJourney ?? "",
      stopReason: raw.stopReason ?? ""
    };
  }, [candidate]);
  const isApplicationComplete =
    REQUIRED_APPLICATION_DRAWER_KEYS.every((key) => applicationFormData[key].trim().length > 0) && hasProfilePhoto && hasCv;
  const latestDipEnvelope = candidate?.docusignEnvelopes?.find((envelope: any) => envelope.stepNumber === 5) ?? null;
  const contractReservationFiles = useMemo(
    () =>
      candidate?.documents
        ?.filter((entry: any) => entry.type === "contrat_reservation_zone")
        .sort((a: any, b: any) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()) ?? [],
    [candidate]
  );
  const definitiveContractFiles = useMemo(
    () =>
      candidate?.documents
        ?.filter((entry: any) => entry.type === "contrat_definitif")
        .sort((a: any, b: any) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()) ?? [],
    [candidate]
  );
  const hasAnyContract = contractReservationFiles.length > 0 || definitiveContractFiles.length > 0;
  const hasDefinitiveContract = definitiveContractFiles.length > 0;
  const dipLegalDelay = useMemo(() => {
    if (!candidate || candidate.currentStep !== 5 || latestDipEnvelope?.status !== "COMPLETED" || !latestDipEnvelope?.updatedAt) {
      return null;
    }

    const signedAt = new Date(latestDipEnvelope.updatedAt);
    const deadline = addDays(signedAt, 20);
    const remainingDays = Math.max(0, differenceInCalendarDays(deadline, now));

    return {
      label: `J-${remainingDays} jours`,
      deadlineLabel: `Fin de délai DIP le ${format(deadline, "dd/MM/yyyy", { locale: fr })}`
    };
  }, [candidate, latestDipEnvelope, now]);
  const documentRows = useMemo(() => {
    if (!candidate) return [];

    return DOCUMENT_LABELS.map((item) => {
      const documents = candidate.documents
        .filter((entry: any) => entry.type === item.type)
        .sort((a: any, b: any) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

      const dipEnvelopeStatus = item.type === "dip" ? latestDipEnvelope?.status ?? null : null;
      const isDipSent = dipEnvelopeStatus === "SENT" || dipEnvelopeStatus === "DELIVERED" || dipEnvelopeStatus === "CREATED";
      const isDipSigned = dipEnvelopeStatus === "COMPLETED";
      const isDipPending = item.type === "dip" && candidate.currentStep === 5 && !isDipSent && !isDipSigned;

      return {
        ...item,
        exists:
          item.type === "dip"
            ? isDipSigned || documents.length > 0 || Boolean(dipEnvelopeStatus)
            : item.type === "questionnaire"
            ? isApplicationComplete
              : item.type === "retour_journee_decouverte"
                ? hasDiscoveryFeedback
                : item.type === "contrat_reservation_zone" || item.type === "contrat_definitif"
                  ? false
                  : documents.length > 0,
        dipState: item.type === "dip" ? (isDipSigned ? "signed" : isDipSent ? "sent" : isDipPending ? "pending" : "default") : "default",
        displayLabel:
          item.type === "dip"
            ? isDipSigned
              ? "DIP"
              : isDipSent
                ? "DIP envoyé"
                : isDipPending
                  ? "DIP à envoyer"
                  : item.label
            : item.label,
        secondaryLabel: "",
        badgeLabel: item.type === "dip" && isDipSigned ? dipLegalDelay?.label ?? "" : "",
        files: documents.map((document: any) => ({
          id: document.id as string,
          fileUrl: (document.fileUrl as string | null | undefined) ?? null,
          fileName: document.fileName as string
        }))
      };
    });
  }, [candidate, dipLegalDelay, hasDiscoveryFeedback, isApplicationComplete, latestDipEnvelope]);

  const visibleDocumentStep = useMemo(() => {
    if (!candidate) return 1;

    const currentStepHasDocuments = documentRows.some(
      (document) => (DOCUMENT_STEP_BY_TYPE[document.type] ?? 99) === candidate.currentStep
    );

    if (currentStepHasDocuments) {
      return candidate.currentStep;
    }

    const nextVisible = documentRows.find(
      (document) => (DOCUMENT_STEP_BY_TYPE[document.type] ?? 99) > candidate.currentStep
    );

    return nextVisible ? DOCUMENT_STEP_BY_TYPE[nextVisible.type] ?? candidate.currentStep : candidate.currentStep;
  }, [candidate, documentRows]);

  const currentDocumentRows = useMemo(
    () =>
      documentRows.filter((document) => {
        const stepNumber = DOCUMENT_STEP_BY_TYPE[document.type] ?? 99;
        return (
          document.type !== "contrat_reservation_zone" &&
          document.type !== "contrat_definitif" &&
          (document.exists || stepNumber <= visibleDocumentStep)
        );
      }),
    [documentRows, visibleDocumentStep]
  );

  const futureDocumentRows = useMemo(
    () =>
      documentRows.filter((document) => {
        const stepNumber = DOCUMENT_STEP_BY_TYPE[document.type] ?? 99;
        return (
          document.type !== "contrat_reservation_zone" &&
          document.type !== "contrat_definitif" &&
          !document.exists &&
          stepNumber > visibleDocumentStep
        );
      }),
    [documentRows, visibleDocumentStep]
  );

  const archivedDocumentRows = useMemo(
    () =>
      candidate?.currentStep >= 6
        ? currentDocumentRows.filter((document) =>
            ["questionnaire", "cv", "retour_journee_decouverte", "elm"].includes(document.type)
          )
        : [],
    [candidate?.currentStep, currentDocumentRows]
  );

  const primaryDocumentRows = useMemo(
    () =>
      archivedDocumentRows.length
        ? currentDocumentRows.filter(
            (document) => !["questionnaire", "cv", "retour_journee_decouverte", "elm"].includes(document.type)
          )
        : currentDocumentRows,
    [archivedDocumentRows.length, currentDocumentRows]
  );

  const handleStepChange = async (nextStep: number) => {
    if (!candidate || nextStep === candidate.currentStep) {
      setStepPickerOpen(false);
      return;
    }

    if (candidate.currentStep === 1 && nextStep === 2) {
      setStepPickerOpen(false);
      setInvitationModalOpen(true);
      return;
    }

    if (candidate.currentStep === 3 && nextStep === 4) {
      setStepPickerOpen(false);
      setDiscoveryInvitationModalOpen(true);
      return;
    }

    setIsSavingStep(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/candidates/${candidate.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ currentStep: nextStep })
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Impossible de mettre à jour l'étape.");
      }

      const data = (await response.json().catch(() => null)) as { mailWarning?: string } | null;

      const refreshedCandidate = await syncCandidate(candidate.id);
      setCandidate(refreshedCandidate);
      setStepPickerOpen(false);
      if (data?.mailWarning) {
        setError(data.mailWarning);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de mettre à jour l'étape.");
    } finally {
      setIsSavingStep(false);
    }
  };

  const handleInvitationStepConfirm = async ({
    sendEmail,
    subject,
    bodyText,
    attachments
  }: {
    sendEmail: boolean;
    subject?: string;
    bodyText?: string;
    attachments?: Array<{
      fileName: string;
      mimeType: string;
      fileUrl: string;
    }>;
  }) => {
    if (!candidate) {
      return;
    }

    setIsSavingStep(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/candidates/${candidate.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          currentStep: 2,
          sendInvitationEmail: sendEmail,
          skipInvitationEmail: !sendEmail,
          invitationEmail: sendEmail
            ? {
                subject,
                bodyText,
                attachments
              }
            : undefined
        })
      });

      const data = (await response.json().catch(() => null)) as { error?: string; mailWarning?: string } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Impossible de mettre à jour le candidat.");
      }

      const refreshedCandidate = await syncCandidate(candidate.id);
      setCandidate(refreshedCandidate);
      setInvitationModalOpen(false);

      if (data?.mailWarning) {
        setError(data.mailWarning);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de mettre à jour le candidat.");
      throw err;
    } finally {
      setIsSavingStep(false);
    }
  };

  const handleDiscoveryInvitationStepConfirm = async ({
    sendEmail,
    subject,
    bodyText,
    attachments
  }: {
    sendEmail: boolean;
    subject?: string;
    bodyText?: string;
    attachments?: Array<{
      fileName: string;
      mimeType: string;
      fileUrl: string;
    }>;
  }) => {
    if (!candidate) {
      return;
    }

    setIsSavingStep(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/candidates/${candidate.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          currentStep: 4,
          sendDiscoveryEmail: sendEmail,
          skipDiscoveryEmail: !sendEmail,
          discoveryEmail: sendEmail
            ? {
                subject,
                bodyText,
                attachments
              }
            : undefined
        })
      });

      const data = (await response.json().catch(() => null)) as { error?: string; mailWarning?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? "Impossible de mettre à jour le candidat.");
      }

      const refreshedCandidate = await syncCandidate(candidate.id);
      setCandidate(refreshedCandidate);
      setDiscoveryInvitationModalOpen(false);

      if (data?.mailWarning) {
        setError(data.mailWarning);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de mettre à jour le candidat.");
      throw err;
    } finally {
      setIsSavingStep(false);
    }
  };

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file || !candidate) {
      return;
    }

    setIsUploadingPhoto(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/admin/candidates/${candidate.id}/photo`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Impossible de modifier la photo.");
      }

      const refreshedCandidate = await syncCandidate(candidate.id);
      setCandidate(refreshedCandidate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de modifier la photo.");
    } finally {
      setIsUploadingPhoto(false);
      event.target.value = "";
    }
  };

  const handleApplicationFormSaved = async () => {
    if (!candidate) return;

    const refreshedCandidate = await syncCandidate(candidate.id);
    setCandidate(refreshedCandidate);
    setApplicationFormOpen(false);
  };

  const handleDocumentUpload = async (type: string, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file || !candidate) {
      return;
    }

    setUploadingDocumentType(type);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", type);

      const response = await fetch(`/api/admin/candidates/${candidate.id}/documents`, {
        method: "POST",
        body: formData
      });

      const data = (await response.json().catch(() => null)) as { error?: string; warning?: string } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Impossible de télécharger le document.");
      }

      const refreshedCandidate = await syncCandidate(candidate.id);
      setCandidate(refreshedCandidate);
      if (data?.warning) {
        setError(data.warning);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de télécharger le document.");
    } finally {
      setUploadingDocumentType(null);
      event.target.value = "";
    }
  };

  const handleOpenDocument = async (document: DrawerDocumentFile) => {
    let fileUrl = document.fileUrl ?? null;

    if (!fileUrl && candidate?.id && document.id) {
      const response = await fetch(
        `/api/admin/candidates/${candidate.id}/documents?documentId=${encodeURIComponent(document.id)}`
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Impossible d’ouvrir ce document.");
      }

      const data = (await response.json()) as { fileUrl?: string | null };
      fileUrl = data.fileUrl ?? null;
    }

    if (!fileUrl) {
      return;
    }

    if (fileUrl.startsWith("data:")) {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      return;
    }

    window.open(fileUrl, "_blank", "noopener,noreferrer");
  };

  const handleDeleteDocument = async (documentId: string) => {
    if (!candidate) {
      return;
    }

    const confirmed = window.confirm("Voulez-vous vraiment supprimer ce fichier ?");
    if (!confirmed) {
      return;
    }

    setDeletingDocumentId(documentId);
    setError("");

    try {
      const response = await fetch(`/api/admin/candidates/${candidate.id}/documents`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ documentId })
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Impossible de supprimer le document.");
      }

      const refreshedCandidate = await syncCandidate(candidate.id);
      setCandidate(refreshedCandidate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de supprimer le document.");
    } finally {
      setDeletingDocumentId(null);
    }
  };

  const handleCommentSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!candidate || !commentDraft.trim()) {
      return;
    }

    setIsSavingComment(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/candidates/${candidate.id}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ noteText: commentDraft.trim() })
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Impossible d'ajouter le commentaire.");
      }

      await syncCandidateActivity(candidate.id);
      setCommentDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'ajouter le commentaire.");
    } finally {
      setIsSavingComment(false);
    }
  };

  const handleStartEditNote = (note: any) => {
    setEditingNoteId(note.id);
    setEditingNoteText(note.noteText);
  };

  const handleCancelEditNote = () => {
    setEditingNoteId(null);
    setEditingNoteText("");
  };

  const handleSaveEditedNote = async (noteId: string) => {
    if (!candidate || !editingNoteText.trim()) {
      return;
    }

    setSavingNoteId(noteId);
    setError("");

    try {
      const response = await fetch(`/api/admin/candidates/${candidate.id}/notes`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ noteId, noteText: editingNoteText.trim() })
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Impossible de modifier le commentaire.");
      }

      await syncCandidateActivity(candidate.id);
      handleCancelEditNote();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de modifier le commentaire.");
    } finally {
      setSavingNoteId(null);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!candidate) {
      return;
    }

    const confirmed = window.confirm("Voulez-vous vraiment supprimer ce commentaire ?");
    if (!confirmed) {
      return;
    }

    setDeletingNoteId(noteId);
    setError("");

    try {
      const response = await fetch(`/api/admin/candidates/${candidate.id}/notes`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ noteId })
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Impossible de supprimer le commentaire.");
      }

      await syncCandidateActivity(candidate.id);
      if (editingNoteId === noteId) {
        handleCancelEditNote();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de supprimer le commentaire.");
    } finally {
      setDeletingNoteId(noteId);
      setDeletingNoteId(null);
    }
  };

  const handleArchiveCandidate = async () => {
    if (!candidate) {
      return;
    }

    const confirmed = window.confirm("Voulez-vous vraiment archiver ce candidat ?");
    if (!confirmed) {
      return;
    }

    setIsArchivingCandidate(true);
    setError("");

    try {
      const response = await fetch("/api/admin/candidates/archive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ candidateIds: [candidate.id] })
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Impossible d'archiver le candidat.");
      }

      onClose();
      window.location.href = "/admin/candidates";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'archiver le candidat.");
    } finally {
      setIsArchivingCandidate(false);
    }
  };

  const handleDiscoveryFollowupTest = async () => {
    if (!candidate) {
      return;
    }

    setIsTestingDiscoveryFollowup(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/candidates/${candidate.id}/discovery-followup-test`, {
        method: "POST"
      });

      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? "Impossible de déclencher le test après journée découverte.");
      }

      const refreshedCandidate = await syncCandidate(candidate.id);
      setCandidate(refreshedCandidate);
      window.alert("Workflow après journée découverte déclenché.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Impossible de déclencher le test après journée découverte."
      );
    } finally {
      setIsTestingDiscoveryFollowup(false);
    }
  };

  if (!candidateId) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[2000]">
      {invitationModalOpen ? (
        <ApplicationInvitationModal
          templateSlug="candidate-application-invitation"
          title="Dossier de candidature"
          onClose={() => {
            if (!isSavingStep) {
              setInvitationModalOpen(false);
            }
          }}
          onConfirm={handleInvitationStepConfirm}
        />
      ) : null}
      {discoveryInvitationModalOpen ? (
        <ApplicationInvitationModal
          templateSlug="candidate-discovery-invitation"
          title="Journée découverte"
          onClose={() => {
            if (!isSavingStep) {
              setDiscoveryInvitationModalOpen(false);
            }
          }}
          onConfirm={handleDiscoveryInvitationStepConfirm}
        />
      ) : null}
      <button type="button" aria-label="Fermer le panneau candidat" className="absolute inset-0 bg-slate-950/16 backdrop-blur-[2px]" onClick={onClose} />
      <input ref={photoInputRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
      {DOCUMENT_LABELS.map((document) => (
        <input
          key={document.type}
          ref={(node) => {
            documentInputRefs.current[document.type] = node;
          }}
          type="file"
          className="hidden"
          onChange={(event) => handleDocumentUpload(document.type, event)}
        />
      ))}
      <aside className="absolute right-0 top-0 h-screen w-[min(460px,calc(100vw-1rem))] overflow-y-auto rounded-tl-[2rem] border-l border-slate-200 bg-white/96 p-5 shadow-2xl backdrop-blur-xl">
        <div className="relative z-40 mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => setPhotoModalOpen(true)}
              className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-[#3b97c9] transition hover:scale-[1.03]"
              aria-label="Agrandir la photo du candidat"
            >
              {profilePhoto?.fileUrl ? (
                <img src={profilePhoto.fileUrl} alt={candidate ? `Photo de ${candidate.user.firstname}` : "Photo candidat"} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-[0.16em] text-white/85">Photo</span>
              )}
            </button>
            <div>
              {candidate ? (
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#007cbd]">
                  <span>Candidat</span>
                  <div className="group relative">
                    <span className="cursor-default">{candidateLocationLabel}</span>
                    <div className="pointer-events-none absolute left-0 top-full z-[140] hidden w-[240px] pt-3 group-hover:block">
                      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl">
                        <div className="h-[180px] overflow-hidden rounded-2xl">
                          <CandidateMiniMap latitude={candidate.latitude} longitude={candidate.longitude} cityLabel={candidateLocationLabel} zoom={2.8} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setApplicationFormOpen(true)}
                className="text-left"
              >
                <h2 className="text-2xl font-bold leading-tight text-slate-950 transition hover:text-[#007cbd]">
                  {candidate ? `${candidate.user.firstname} ${candidate.user.lastname}` : "Chargement..."}
                </h2>
              </button>
              {candidate ? (
                <p className="mt-1 text-sm leading-snug text-slate-500">
                  {candidate.user.email}
                  <br />
                  {candidateDisplayPhone ? formatPhoneNumber(candidateDisplayPhone) : "Téléphone non renseigné"}
                </p>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl text-slate-700 shadow-sm hover:bg-slate-50"
            >
              ×
            </button>
          </div>
        </div>

        {loading ? <p className="text-sm text-slate-500">Chargement du candidat...</p> : null}
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        {candidate ? (
          <div className="space-y-4">
            <div className="relative z-20">
              <button
                type="button"
                onClick={() => setStepPickerOpen((current) => !current)}
                className="w-full text-left"
                disabled={isSavingStep}
              >
                <Card className={`${currentStepTheme.solid} px-4 py-2.5 text-center text-white transition`}>
                  <p className="text-lg font-bold leading-tight">
                    {candidate.currentStep}. {currentStepLabel}
                  </p>
                </Card>
              </button>

              {stepPickerOpen ? (
                <Card className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 p-2.5 shadow-2xl">
                  <div className="space-y-1">
                    {STEP_LABELS.map((label, index) => {
                      const stepNumber = index + 1;
                      const isActive = stepNumber === candidate.currentStep;
                      const stepTheme = getStepTheme(stepNumber);

                      return (
                        <button
                          key={stepNumber}
                          type="button"
                          onClick={() => handleStepChange(stepNumber)}
                          disabled={isSavingStep}
                          className={`flex w-full items-center rounded-xl border px-2.5 py-2 text-left text-[13px] font-semibold leading-tight transition ${
                            isActive
                              ? `${stepTheme.soft}`
                              : `${stepTheme.soft} opacity-90 hover:opacity-100`
                          }`}
                        >
                          <span className={`mr-2.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${stepTheme.badge}`}>
                            {stepNumber}
                          </span>
                          <span>{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </Card>
              ) : null}
            </div>

            {candidate.currentStep === 5 && latestDipEnvelope?.status === "COMPLETED" ? (
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleSimulateDipFinished()}
                  disabled={isSimulatingDipFinished}
                  className="h-9 rounded-2xl border-amber-200 bg-amber-50 px-4 text-[12px] font-semibold text-amber-800 hover:bg-amber-100"
                >
                  {isSimulatingDipFinished ? "Simulation..." : "DIP fini"}
                </Button>
              </div>
            ) : null}

            <Card className="p-3">
              <p className="text-base font-bold text-slate-950">Documents</p>
              <div className="mt-2.5 space-y-1">
                {archivedDocumentRows.length ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowPastDocuments((current) => !current)}
                      className="flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                    >
                      <span className="text-base leading-none">{showPastDocuments ? "⌃" : "⌄"}</span>
                    </button>

                    {showPastDocuments ? (
                      <div className="space-y-1">
                        {archivedDocumentRows.map((document) => (
                          <div
                            key={document.type}
                            className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2.5 py-1"
                          >
                            <div className="flex min-w-0 flex-1 items-start gap-2">
                              <span className="text-sm text-emerald-600">✓</span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-medium leading-tight text-slate-950">{document.displayLabel}</p>
                                {document.files.length ? (
                                  <div className="mt-0.5 space-y-0">
                                    {document.files.map((file: { id: string; fileUrl: string; fileName: string }) => (
                                      <button
                                        key={file.id}
                                        type="button"
                                        onClick={() => void handleOpenDocument(file)}
                                        className="block text-left text-[10px] leading-tight text-slate-500 transition hover:font-semibold hover:text-slate-700"
                                      >
                                        {file.fileName}
                                      </button>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}

                {primaryDocumentRows.map((document) => (
                  <div
                    key={document.type}
                    className={`flex items-center justify-between gap-2 rounded-2xl border px-2.5 py-1 ${
                      document.type === "dip" && (document as any).dipState !== "signed" && (document as any).dipState !== "default"
                        ? "border-rose-200 bg-rose-50/70"
                        : document.exists
                          ? "border-emerald-200 bg-emerald-50/70"
                          : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-2">
                      <span
                        className={`text-sm ${
                          document.type === "dip" && (document as any).dipState !== "signed" && (document as any).dipState !== "default"
                            ? "text-rose-500"
                            : document.exists
                              ? "text-emerald-600"
                              : "text-slate-300"
                        }`}
                      >
                        {document.type === "dip" && (document as any).dipState === "sent"
                          ? ""
                          : document.type === "dip" && (document as any).dipState !== "signed" && (document as any).dipState !== "default"
                            ? "○"
                          : document.exists
                            ? "✓"
                            : "○"}
                      </span>
                      <div className="min-w-0 flex-1">
                        {document.type === "questionnaire" ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (document.exists) {
                                setApplicationPreviewOpen(true);
                              }
                            }}
                            disabled={!document.exists}
                            className={`text-left text-[11px] leading-tight transition ${document.exists ? "font-medium text-slate-950 hover:font-bold" : "cursor-not-allowed text-slate-500"}`}
                          >
                            {document.label}
                          </button>
                        ) : document.type === "retour_journee_decouverte" ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (document.exists) {
                                setDiscoveryFeedbackPreviewOpen(true);
                              }
                            }}
                            disabled={!document.exists}
                            className={`text-left text-[11px] leading-tight transition ${
                              document.exists
                                ? "font-medium text-slate-950 hover:font-bold"
                                : "cursor-not-allowed text-slate-500"
                            }`}
                          >
                            {document.displayLabel}
                          </button>
                        ) : document.type === "dip" && (document as any).dipState === "pending" ? (
                          <button
                            type="button"
                            onClick={() => void openDipPreparationModal()}
                            className="text-left text-[11px] font-semibold leading-tight text-rose-600 transition hover:text-rose-700 hover:underline"
                          >
                            {document.displayLabel}
                          </button>
                        ) : document.type === "dip" && ((document as any).dipState === "sent" || (document as any).dipState === "signed") ? (
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <p className={`text-[11px] font-semibold leading-tight ${(document as any).dipState === "signed" ? "text-slate-950" : "text-rose-600"}`}>
                              {document.displayLabel}
                            </p>
                      {(document as any).badgeLabel ? (
                        <span className="text-[10px] font-semibold leading-tight text-rose-600">
                          {(document as any).badgeLabel}
                        </span>
                      ) : null}
                          </div>
                        ) : (document.type === "contrat_reservation_zone" || document.type === "contrat_definitif") &&
                          candidate.currentStep >= 7 ? (
                          <button
                            type="button"
                            onClick={() => documentInputRefs.current[document.type]?.click()}
                            className={`text-left text-[11px] leading-tight transition hover:underline ${
                              document.exists ? "font-medium text-slate-950 hover:text-slate-700" : "font-semibold text-rose-600 hover:text-rose-700"
                            }`}
                          >
                            {document.displayLabel}
                          </button>
                        ) : (
                          <p
                            className={`text-[11px] leading-tight ${
                              document.exists ? "font-medium text-slate-950" : "text-slate-500"
                            }`}
                          >
                            {document.displayLabel}
                          </p>
                        )}
                        {(document as any).secondaryLabel ? (
                          <p className="mt-0.5 text-[10px] leading-tight text-slate-500">
                            {(document as any).secondaryLabel}
                          </p>
                        ) : null}
                        {document.type !== "questionnaire" && document.files.length ? (
                          <div className="mt-0.5 space-y-0">
                            {document.files.map((file: { id: string; fileUrl: string; fileName: string }) => (
                              <div key={file.id} className="flex items-start gap-1.5">
                                {document.type !== "dip" &&
                                !(
                                  (document.type === "contrat_reservation_zone" ||
                                    document.type === "contrat_definitif") &&
                                  /signé/i.test(file.fileName)
                                ) ? (
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteDocument(file.id)}
                                    disabled={deletingDocumentId === file.id}
                                    className="mt-0.5 text-xs leading-none text-slate-400 transition hover:text-rose-500 disabled:opacity-50"
                                    aria-label={`Supprimer ${file.fileName}`}
                                    title="Supprimer ce fichier"
                                  >
                                    ×
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => void handleOpenDocument(file)}
                                  className="block text-left text-[10px] leading-tight text-slate-500 transition hover:font-semibold hover:text-slate-700"
                                >
                                  {file.fileName}
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {document.type === "dip" && (document as any).dipState === "sent" ? (
                      <button
                        type="button"
                        onClick={() => void handleRelaunchDipSignature()}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg text-rose-500 transition hover:bg-rose-100 hover:text-rose-700"
                        title="Relancer la signature de réception du DIP"
                        aria-label="Relancer la signature de réception du DIP"
                      >
                        ↻
                      </button>
                    ) : null}
                  </div>
                ))}

                {candidate.currentStep >= 8 ? (
                  <div
                    className={`flex items-center justify-between gap-2 rounded-2xl px-2.5 py-1 ${
                      hasDefinitiveContract
                        ? "border border-emerald-300 bg-emerald-50"
                        : hasAnyContract
                          ? "border border-slate-200 bg-slate-50"
                          : "border border-rose-200 bg-rose-50"
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-2">
                      <span
                        className={`text-sm ${
                          hasDefinitiveContract
                            ? "text-emerald-600"
                            : hasAnyContract
                              ? "text-slate-300"
                              : "text-rose-500"
                        }`}
                      >
                        {hasDefinitiveContract ? "✓" : "○"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => setContractModalOpen(true)}
                          className={`text-left text-[11px] leading-tight transition hover:underline ${
                            hasDefinitiveContract
                              ? "font-medium text-slate-950 hover:text-slate-700"
                              : hasAnyContract
                                ? "font-medium text-slate-950 hover:text-slate-700"
                                : "font-semibold text-rose-600 hover:text-rose-700"
                          }`}
                        >
                          {hasAnyContract ? "Contrat" : "Contrat à envoyer"}
                        </button>
                        {!hasAnyContract ? (
                          <p className="mt-0.5 text-[10px] leading-tight text-rose-500">
                            Téléchargez un modèle, complétez-le sur votre ordinateur puis envoyez-le manuellement via DocuSign.
                          </p>
                        ) : null}
                        {contractReservationFiles.length || definitiveContractFiles.length ? (
                          <div className="mt-0.5 space-y-0">
                            {[...contractReservationFiles, ...definitiveContractFiles].map((file: any) => (
                              <div key={file.id} className="flex items-start gap-1.5">
                                {!/signé/i.test(file.fileName) ? (
                                  <button
                                    type="button"
                                    onClick={() => void handleDeleteDocument(file.id)}
                                    disabled={deletingDocumentId === file.id}
                                    className="mt-0.5 text-xs leading-none text-slate-400 transition hover:text-rose-500 disabled:opacity-50"
                                    aria-label={`Supprimer ${file.fileName}`}
                                    title="Supprimer ce fichier"
                                  >
                                    ×
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() => void handleOpenDocument(file)}
                                  className="block text-left text-[10px] leading-tight text-slate-500 transition hover:font-semibold hover:text-slate-700"
                                >
                                  {file.fileName}
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}

                {candidate.currentStep >= 8 && hasAnyContract ? (
                  <div
                    className={`flex items-center justify-between gap-2 rounded-2xl px-2.5 py-1 ${
                      trainingAppointment
                        ? "border border-emerald-300 bg-emerald-50"
                        : "border border-rose-200 bg-rose-50"
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-2">
                      <span className={`text-sm ${trainingAppointment ? "text-emerald-600" : "text-rose-500"}`}>
                        {trainingAppointment ? "✓" : "○"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => setContractModalOpen(true)}
                          className={`text-left text-[11px] leading-tight transition hover:underline ${
                            trainingAppointment
                              ? "font-medium text-slate-950 hover:text-slate-700"
                              : "font-semibold text-rose-600 hover:text-rose-700"
                          }`}
                        >
                          {trainingAppointment ? "Dates de formation" : "Dates de formation à définir"}
                        </button>
                        {trainingAppointment ? (
                          <p className="mt-0.5 text-[10px] leading-tight text-slate-500">
                            Du {format(new Date(trainingAppointment.startDatetime), "dd/MM/yyyy")} au{" "}
                            {format(new Date(trainingAppointment.endDatetime), "dd/MM/yyyy")}
                          </p>
                        ) : (
                          <p className="mt-0.5 text-[10px] leading-tight text-rose-500">
                            À définir après réception d’un contrat signé
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}

                {candidate.currentStep >= 6 && !candidate.localProjects?.length ? (
                  <div
                    className={`flex items-center justify-between gap-2 rounded-2xl px-2.5 py-1 ${
                      candidate.currentStep >= 7
                        ? "border border-rose-200 bg-rose-50"
                        : "border border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-2">
                      <span className={`text-sm ${candidate.currentStep >= 7 ? "text-rose-500" : "text-slate-300"}`}>○</span>
                      <div className="min-w-0 flex-1">
                        <p className={`text-[11px] leading-tight ${candidate.currentStep >= 7 ? "font-semibold text-rose-600" : "text-slate-500"}`}>Local</p>
                        <p className={`mt-0.5 text-[10px] leading-tight ${candidate.currentStep >= 7 ? "font-semibold text-rose-500" : "text-slate-400"}`}>
                          {candidate.currentStep >= 7 ? "Obligatoire à cette étape" : "Projet de local attendu à cette étape"}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {candidate.currentStep >= 6 && candidate.localProjects?.length ? (
                  <div className="space-y-1">
                    {candidate.localProjects.map((project: any) => (
                      <div
                        key={project.id}
                        className={`rounded-2xl px-2.5 py-1.5 ${
                          project.status === "VALIDATED"
                            ? "border border-emerald-300 bg-emerald-50"
                            : "border border-slate-200 bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 flex-1 items-start gap-2">
                          <span
                            className={`text-sm ${
                              project.status === "VALIDATED" ? "text-emerald-600" : "text-slate-300"
                            }`}
                          >
                            {project.status === "VALIDATED" ? "✓" : "○"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-[11px] font-medium leading-tight text-slate-950">
                                {[project.address, project.zipcode, project.city].filter(Boolean).join(", ")}
                              </p>
                            </div>
                            <p className="mt-0.5 text-[10px] leading-tight text-slate-500">
                              {(() => {
                                let monthlyRentHt = "";
                                let monthlyChargesHt = "";

                                if (project.notesCandidate) {
                                  try {
                                    const parsed = JSON.parse(project.notesCandidate);
                                    monthlyRentHt = parsed?.monthlyRentHt ?? "";
                                    monthlyChargesHt = parsed?.monthlyChargesHt ?? "";
                                  } catch {}
                                }

                                return `Loyer HT : ${monthlyRentHt || "—"}€ Charges HT : ${monthlyChargesHt || "—"}€`;
                              })()}
                            </p>
                            {project.files?.length ? (
                              <div className="mt-0.5 space-y-0">
                                {project.files.map((file: { id: string; fileType: string }) => {
                                  const [kind, ...nameParts] = String(file.fileType || "").split("::");
                                  const fileName =
                                    nameParts.join("::") ||
                                    (kind === "plan" ? "Plan du local" : "Photo du local");

                                  return (
                                    <button
                                      key={file.id}
                                      type="button"
                                      onClick={() =>
                                        void handleOpenDocument({
                                          id: file.id,
                                          fileName,
                                          fileUrl: `/api/admin/candidates/${candidate.id}/local-projects/${project.id}/files/${file.id}`
                                        })
                                      }
                                      className="block text-left text-[10px] leading-tight text-slate-500 transition hover:font-semibold hover:text-slate-700"
                                    >
                                      {fileName}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <p className="mt-0.5 text-[10px] leading-tight text-slate-400">
                                Aucun fichier téléversé
                              </p>
                            )}
                          </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            {project.status !== "VALIDATED" ? (
                              <button
                                type="button"
                                onClick={() => void handleValidateLocalProject(project.id)}
                                disabled={processingLocalProjectId === project.id}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-sm text-sky-600 transition hover:bg-sky-100 hover:text-sky-700 disabled:opacity-50"
                                title="Valider ce projet de local"
                                aria-label="Valider ce projet de local"
                              >
                                ✓
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => void handleInvalidateLocalProject(project.id)}
                              disabled={processingLocalProjectId === project.id}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-sm text-rose-600 transition hover:bg-rose-100 hover:text-rose-700 disabled:opacity-50"
                              title="Invalider ce projet de local"
                              aria-label="Invalider ce projet de local"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {futureDocumentRows.length ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowFutureDocuments((current) => !current)}
                      className="flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                    >
                      <span className="text-base leading-none">{showFutureDocuments ? "⌃" : "⌄"}</span>
                    </button>

                    {showFutureDocuments ? (
                      <div className="space-y-1">
                        {futureDocumentRows.map((document) => (
                          <div
                            key={document.type}
                            className="flex items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-2.5 py-1"
                          >
                            <div className="flex min-w-0 flex-1 items-start gap-2">
                              <span className="text-sm text-slate-300">○</span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] leading-tight text-slate-500">{document.displayLabel}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            </Card>

            <Card className="overflow-hidden p-0">
              <div className="border-b border-slate-200 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-slate-700">Tous les commentaires</p>
                  <span className="text-xs text-slate-400">{activityNotes.length}</span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-500 text-[11px] font-semibold text-white">
                    {candidate.user.firstname?.slice(0, 1)?.toUpperCase() ?? "C"}
                  </span>
                  <span>Suit ce dossier.</span>
                </div>
              </div>

              <div className="max-h-[280px] min-h-[220px] overflow-y-auto px-4 py-3">
                <div className="space-y-4">
                  {activityLoading ? (
                    <p className="text-[12px] text-slate-400">Chargement des commentaires...</p>
                  ) : activityNotes.length ? (
                    activityNotes.map((note: any) => (
                      <div key={note.id} className="flex items-start gap-3">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-500 text-[11px] font-semibold text-white">
                          {note.author.firstname?.slice(0, 1)?.toUpperCase() ?? "A"}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[12px] font-medium text-slate-700">
                                {note.author.firstname} {note.author.lastname}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <p className="text-[11px] text-slate-400">
                                {new Intl.RelativeTimeFormat("fr", { numeric: "auto" }).format(
                                  -Math.max(0, Math.round((Date.now() - new Date(note.createdAt).getTime()) / (1000 * 60 * 60 * 24))),
                                  "day"
                                )}
                              </p>
                              <button
                                type="button"
                                onClick={() => handleStartEditNote(note)}
                                className="text-[14px] text-slate-500 transition hover:text-slate-800"
                                aria-label="Modifier le commentaire"
                                title="Modifier"
                              >
                                ✎
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteNote(note.id)}
                                disabled={deletingNoteId === note.id}
                                className="text-[14px] text-slate-500 transition hover:text-rose-500 disabled:opacity-50"
                                aria-label="Supprimer le commentaire"
                                title="Supprimer"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                          {editingNoteId === note.id ? (
                            <div className="mt-2 space-y-2">
                              <textarea
                                value={editingNoteText}
                                onChange={(event) => setEditingNoteText(event.target.value)}
                                rows={3}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none transition focus:border-[#007cbd] focus:ring-2 focus:ring-[#007cbd]/10"
                              />
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={handleCancelEditNote}
                                  className="inline-flex h-8 items-center justify-center rounded-xl border border-slate-200 px-3 text-[12px] text-slate-600 transition hover:bg-slate-50"
                                >
                                  Annuler
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleSaveEditedNote(note.id)}
                                  disabled={savingNoteId === note.id || !editingNoteText.trim()}
                                  className="inline-flex h-8 items-center justify-center rounded-xl bg-[#007cbd] px-3 text-[12px] font-medium text-white transition hover:bg-[#006ba3] disabled:opacity-50"
                                >
                                  {savingNoteId === note.id ? "..." : "Enregistrer"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p
                              className={`mt-1 whitespace-pre-line text-[13px] leading-relaxed ${
                                isAlertNote(note.noteText ?? "") ? "font-medium text-rose-600" : "text-slate-800"
                              }`}
                            >
                              {note.noteText}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-[12px] text-slate-400">Aucun commentaire pour le moment.</p>
                  )}
                </div>
              </div>

              <form onSubmit={handleCommentSubmit} className="border-t border-slate-200 p-3">
                <div className="flex items-center gap-2">
                  <input
                    value={commentDraft}
                    onChange={(event) => setCommentDraft(event.target.value)}
                    placeholder="Laisser un commentaire"
                    className="h-10 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#007cbd] focus:ring-2 focus:ring-[#007cbd]/10"
                  />
                  <Button type="submit" disabled={isSavingComment || !commentDraft.trim()} className="h-10 px-4 text-[12px]">
                    {isSavingComment ? "..." : "OK"}
                  </Button>
                </div>
              </form>
            </Card>

            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/45 px-4 py-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-500">Historique</p>
                <span className="text-[10px] text-slate-400">{activityHistoryItems.length}</span>
              </div>

              <div className="max-h-[220px] min-h-[140px] overflow-y-auto pr-1">
                <div className="space-y-0">
                  {activityLoading ? (
                    <p className="text-[10px] text-slate-400">Chargement de l'historique...</p>
                  ) : activityHistoryItems.length ? (
                    activityHistoryItems.map((item: any) => (
                      <div key={item.id} className="grid grid-cols-[12px_1fr_auto] items-start gap-2 border-l border-slate-200 py-2 pl-2">
                        <span className="mt-1 inline-flex h-2.5 w-2.5 -translate-x-[9px] rounded-sm bg-slate-400" />
                        <div className="min-w-0">
                          <p className="text-[10px] leading-4 text-slate-600">{item.description}</p>
                        </div>
                        <span className="shrink-0 text-[10px] leading-4 text-slate-400">{formatHistoryDate(item.date)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-[10px] text-slate-400">Aucune action importante pour le moment.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => void handleDiscoveryFollowupTest()}
                disabled={isTestingDiscoveryFollowup}
                className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                {isTestingDiscoveryFollowup ? "Test..." : "Journée découverte faite"}
              </button>
              <button
                type="button"
                onClick={() => void handleArchiveCandidate()}
                disabled={isArchivingCandidate}
                className="inline-flex h-10 items-center justify-center rounded-2xl bg-rose-600 px-4 text-[12px] font-semibold text-white transition hover:bg-rose-700 disabled:opacity-50"
              >
                {isArchivingCandidate ? "Archivage..." : "Archiver"}
              </button>
            </div>
          </div>
        ) : null}
      </aside>
      {photoModalOpen ? (
        <div className="absolute inset-0 z-[2100] flex items-center justify-center p-6">
          <button
            type="button"
            aria-label="Fermer l'aperçu photo"
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
            onClick={() => setPhotoModalOpen(false)}
          />
          <div className="relative z-[2101] w-full max-w-3xl">
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-lg text-slate-700 shadow-lg hover:bg-white"
              aria-label="Importer une nouvelle photo"
              disabled={isUploadingPhoto}
            >
              ✎
            </button>
            <button
              type="button"
              onClick={() => setPhotoModalOpen(false)}
              className="absolute right-4 top-20 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-xl text-slate-700 shadow-lg hover:bg-white"
              aria-label="Fermer la photo"
            >
              ×
            </button>
            <div className="overflow-hidden rounded-[2rem] bg-white shadow-2xl">
              {profilePhoto?.fileUrl ? (
                <img src={profilePhoto.fileUrl} alt={candidate ? `Photo de ${candidate.user.firstname}` : "Photo candidat"} className="max-h-[80vh] w-full object-contain bg-slate-100" />
              ) : (
                <div className="flex h-[60vh] items-center justify-center bg-slate-100 text-sm font-medium text-slate-500">
                  Aucune photo pour le moment
                </div>
              )}
            </div>
            {isUploadingPhoto ? <p className="mt-3 text-center text-sm font-medium text-white">Import de la photo...</p> : null}
          </div>
        </div>
      ) : null}
      {applicationFormOpen && candidate ? (
        <ApplicationFormModal candidate={candidate} initialValues={applicationFormData} onClose={() => setApplicationFormOpen(false)} onSaved={handleApplicationFormSaved} />
      ) : null}
      {applicationPreviewOpen && candidate ? (
        <ApplicationPreviewModal
          candidate={candidate}
          values={applicationFormData}
          onClose={() => setApplicationPreviewOpen(false)}
        />
      ) : null}
      {discoveryFeedbackPreviewOpen && candidate ? (
        <DiscoveryFeedbackPreviewModal
          candidate={candidate}
          values={discoveryFeedbackData}
          onClose={() => setDiscoveryFeedbackPreviewOpen(false)}
        />
      ) : null}
      {dipPreparationOpen ? (
        <div className="absolute inset-0 z-[2200] flex items-center justify-center p-6">
          <button
            type="button"
            aria-label="Fermer la préparation du DIP"
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            onClick={() => setDipPreparationOpen(false)}
          />
          <div className="relative z-[2201] flex max-h-[76vh] w-full max-w-[1080px] flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <h2 className="text-[20px] font-semibold text-slate-950">
                  {candidate
                    ? `DIP à envoyer - ${`${candidate.user.firstname} ${candidate.user.lastname}`.trim()}${
                        candidate.projectZone?.trim() ? ` - ${candidate.projectZone.trim()}` : ""
                      }`
                    : "DIP à envoyer"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDipPreparationOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-700 hover:bg-slate-200"
              >
                ×
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 px-5 py-5">
              {dipPreparationLoading ? (
                <p className="text-sm text-slate-500">Chargement de la préparation du DIP…</p>
              ) : dipPreparationError ? (
                <p className="text-sm text-rose-600">{dipPreparationError}</p>
              ) : dipPreparationData ? (
                <DipPreparationPanel
                  candidateId={dipPreparationData.candidate.id}
                  candidateName={`${dipPreparationData.candidate.firstname} ${dipPreparationData.candidate.lastname}`.trim()}
                  projectZone={dipPreparationData.candidate.projectZone}
                  frozenAt={dipPreparationData.frozenAt}
                  sentEnvelopeId={dipPreparationData.sentEnvelopeId}
                  version={dipPreparationData.version}
                  docusignTemplateId={dipPreparationData.docusignTemplateId}
                  docusignTemplateRoleName={dipPreparationData.docusignTemplateRoleName}
                  mainDipDocument={dipPreparationData.mainDipDocument}
                  templateAnnexes={dipPreparationData.templateAnnexes}
                  elmFiles={dipPreparationData.elmFiles}
                />
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {contractModalOpen && candidate ? (
        <div className="absolute inset-0 z-[2200] flex items-center justify-center p-6">
          <button
            type="button"
            aria-label="Fermer la gestion du contrat"
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            onClick={() => setContractModalOpen(false)}
          />
          <div className="relative z-[2201] w-full max-w-2xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-[#007cbd]">Contrat et formation</p>
                <h2 className="mt-2 text-[20px] font-semibold text-slate-950">Contrat à envoyer</h2>
              </div>
              <button
                type="button"
                onClick={() => setContractModalOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-700 hover:bg-slate-200"
              >
                ×
              </button>
            </div>
            <div className="space-y-4 bg-slate-50 px-6 py-5">
              <p className="text-[13px] leading-6 text-slate-600">
                Téléchargez le modèle souhaité, complétez-le sur votre ordinateur, envoyez-le vous-même via DocuSign, puis réuploadez ici le contrat signé.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[13px] font-semibold text-slate-950">Modèle de réservation de zone</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Téléchargez le PDF central configuré dans le workflow.
                  </p>
                  <div className="mt-3">
                    {contractTemplateLoading ? (
                      <p className="text-[11px] text-slate-400">Chargement…</p>
                    ) : contractTemplateData?.reservationTemplate ? (
                      <a
                        href={contractTemplateData.reservationTemplate.fileUrl}
                        download={contractTemplateData.reservationTemplate.fileName}
                        className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 transition hover:border-slate-300"
                      >
                        Télécharger le modèle
                      </a>
                    ) : (
                      <p className="text-[11px] text-rose-500">Aucun modèle configuré dans le workflow.</p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[13px] font-semibold text-slate-950">Modèle de contrat définitif</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    Téléchargez le PDF central configuré dans le workflow.
                  </p>
                  <div className="mt-3">
                    {contractTemplateLoading ? (
                      <p className="text-[11px] text-slate-400">Chargement…</p>
                    ) : contractTemplateData?.definitiveTemplate ? (
                      <a
                        href={contractTemplateData.definitiveTemplate.fileUrl}
                        download={contractTemplateData.definitiveTemplate.fileName}
                        className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 transition hover:border-slate-300"
                      >
                        Télécharger le modèle
                      </a>
                    ) : (
                      <p className="text-[11px] text-rose-500">Aucun modèle configuré dans le workflow.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-semibold text-slate-950">Contrat de réservation signé</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">Réuploadez ici le document signé après l’envoi manuel.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => documentInputRefs.current.contrat_reservation_zone?.click()}
                      className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 transition hover:border-slate-300"
                    >
                      {contractReservationFiles.length ? "Remplacer" : "Téléverser"}
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[13px] font-semibold text-slate-950">Contrat définitif signé</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">Ce document valide la ligne Contrat et sert de référence légale.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => documentInputRefs.current.contrat_definitif?.click()}
                      className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 transition hover:border-slate-300"
                    >
                      {definitiveContractFiles.length ? "Remplacer" : "Téléverser"}
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="text-[13px] font-semibold text-slate-950">Dates de formation</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Dès qu’un contrat signé existe et que les dates sont enregistrées, le candidat passe automatiquement à l’étape Devis menuisier.
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1">
                        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                          Début
                        </span>
                        <input
                          type="date"
                          value={trainingStartDate}
                          onChange={(event) => setTrainingStartDate(event.target.value)}
                          className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-[#007cbd] focus:ring-2 focus:ring-[#007cbd]/10"
                        />
                      </label>
                      <label className="space-y-1">
                        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-500">
                          Fin
                        </span>
                        <input
                          type="date"
                          value={trainingEndDate}
                          onChange={(event) => setTrainingEndDate(event.target.value)}
                          className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-[13px] text-slate-800 outline-none transition focus:border-[#007cbd] focus:ring-2 focus:ring-[#007cbd]/10"
                        />
                      </label>
                    </div>

                    {!hasAnyContract ? (
                      <p className="text-[11px] text-rose-500">
                        Ajoutez d’abord un contrat signé pour enregistrer la formation.
                      </p>
                    ) : null}

                    <div className="flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => void handleSaveTrainingDates()}
                        disabled={!hasAnyContract || !trainingStartDate || !trainingEndDate || isSavingTrainingDates}
                        className="inline-flex h-10 items-center justify-center rounded-full bg-[#007cbd] px-4 text-[12px] font-semibold text-white transition hover:bg-[#006ba3] disabled:opacity-50"
                      >
                        {isSavingTrainingDates ? "Enregistrement..." : trainingAppointment ? "Mettre à jour les dates" : "Enregistrer les dates"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ApplicationFormModal({
  candidate,
  initialValues,
  onClose,
  onSaved
}: {
  candidate: any;
  initialValues: Record<string, string>;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [photoName, setPhotoName] = useState("");
  const [cvName, setCvName] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setIsSaving(true);
    setMessage("");

    try {
      const response = await fetch(`/api/admin/candidates/${candidate.id}/application-form`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Impossible d'enregistrer le dossier.");
      }

      setMessage("Dossier enregistré.");
      window.setTimeout(() => {
        void onSaved();
      }, 180);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible d'enregistrer le dossier.");
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
  }

  return (
    <div className="absolute inset-0 z-[2200] flex items-center justify-center p-6">
      <button type="button" aria-label="Fermer le dossier de candidature" className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-[2201] flex h-[min(88vh,920px)] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[#007cbd]">Dossier de candidature</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">
              {candidate.user.firstname} {candidate.user.lastname}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-700 hover:bg-slate-200">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-6">
            <section className="space-y-4">
              <h4 className="text-lg font-bold text-slate-950">Coordonnées</h4>
              <div className="space-y-4">
                <FormField label="Prénom" name="firstname" defaultValue={initialValues.firstname} />
                <FormField label="Nom" name="lastname" defaultValue={initialValues.lastname} />
                <FormField label="Email" name="email" defaultValue={initialValues.email} />
                <FormField label="Téléphone" name="phone" defaultValue={initialValues.phone} />
                <FormField label="Date de naissance" name="birthDate" defaultValue={initialValues.birthDate} type="date" />
                <FormField label="Lieu de naissance" name="birthPlace" defaultValue={initialValues.birthPlace} />
                <FormField label="Adresse" name="address" defaultValue={initialValues.address} />
                <FormField label="Ville" name="city" defaultValue={initialValues.city} />
                <FormField label="Code postal" name="zipcode" defaultValue={initialValues.zipcode} />
              </div>
            </section>

            <section className="space-y-4">
              <h4 className="text-lg font-bold text-slate-950">Situation personnelle</h4>
              <div className="space-y-4">
                <FormField label="Situation familiale" name="familySituation" defaultValue={initialValues.familySituation} />
                <FormField label="Nombre d'enfants" name="childrenCount" defaultValue={initialValues.childrenCount} />
              </div>
            </section>

            <section className="space-y-4">
              <h4 className="text-lg font-bold text-slate-950">Projet franchise</h4>
              <div className="space-y-4">
                <FormField label="Profession actuelle" name="profession" defaultValue={initialValues.profession} />
                <FormField label="Situation professionnelle" name="professionalSituation" defaultValue={initialValues.professionalSituation} />
                <FormField label="Ville d'implantation du projet" name="projectZone" defaultValue={initialValues.projectZone} />
                <FormField label="Code postal d'implantation du projet" name="projectZipcode" defaultValue={initialValues.projectZipcode} />
                <FormField label="Délai du projet" name="projectDelay" defaultValue={initialValues.projectDelay} />
                <FormField label="Apport personnel" name="personalContribution" defaultValue={initialValues.personalContribution} />
                <FormField label="Expérience entrepreneuriale" name="entrepreneurshipExperience" defaultValue={initialValues.entrepreneurshipExperience} />
                <TextAreaField label="Motivation" name="motivation" defaultValue={initialValues.motivation} rows={5} />
                <TextAreaField label="Notes complémentaires" name="notes" defaultValue={initialValues.notes} rows={5} />
              </div>
            </section>

            <section className="space-y-4">
              <h4 className="text-lg font-bold text-slate-950">Uploads</h4>
              <div className="space-y-4">
                <UploadField label="Photo" name="photo" filename={photoName} helper="Met à jour la photo de profil du candidat" onChange={(event) => setPhotoName(event.target.files?.[0]?.name ?? "")} />
                <UploadField label="CV" name="cv" filename={cvName} helper="Ajoute ou remplace le CV dans les documents à disposition" onChange={(event) => setCvName(event.target.files?.[0]?.name ?? "")} />
              </div>
            </section>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-slate-200 bg-white px-6 py-5">
            {message ? <p className="text-sm text-rose-600">{message}</p> : <span />}
            <div className="flex items-center gap-3">
              <Button type="button" variant="ghost" onClick={onClose}>
                Fermer
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormField({
  label,
  name,
  defaultValue,
  type = "text",
  className
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#007cbd] focus:ring-2 focus:ring-[#007cbd]/15"
      />
    </label>
  );
}

function TextAreaField({
  label,
  name,
  defaultValue,
  rows,
  className
}: {
  label: string;
  name: string;
  defaultValue: string;
  rows: number;
  className?: string;
}) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={rows}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#007cbd] focus:ring-2 focus:ring-[#007cbd]/15"
      />
    </label>
  );
}

function UploadField({
  label,
  name,
  helper,
  filename,
  onChange
}: {
  label: string;
  name: string;
  helper: string;
  filename: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label>
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4">
        <input name={name} type="file" onChange={onChange} className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-xl file:border-0 file:bg-[#007cbd] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white" />
        <p className="mt-2 text-xs text-slate-500">{filename || helper}</p>
      </div>
    </label>
  );
}

function ApplicationPreviewModal({
  candidate,
  values,
  onClose
}: {
  candidate: any;
  values: Record<string, string>;
  onClose: () => void;
}) {
  const rows = [
    ["Prénom", values.firstname],
    ["Nom", values.lastname],
    ["Email", values.email],
    ["Téléphone", values.phone ? formatPhoneNumber(values.phone) : ""],
    ["Date de naissance", values.birthDate],
    ["Lieu de naissance", values.birthPlace],
    ["Adresse", values.address],
    ["Ville", values.city],
    ["Code postal", values.zipcode],
    ["Situation familiale", values.familySituation],
    ["Nombre d'enfants", values.childrenCount],
    ["Profession actuelle", values.profession],
    ["Situation professionnelle", values.professionalSituation],
    ["Ville d'implantation du projet", values.projectZone],
    ["Code postal d'implantation du projet", values.projectZipcode],
    ["Délai du projet", values.projectDelay],
    ["Apport personnel", values.personalContribution],
    ["Expérience entrepreneuriale", values.entrepreneurshipExperience],
    ["Motivation", values.motivation],
    ["Notes complémentaires", values.notes]
  ];

  return (
    <div className="absolute inset-0 z-[2200] flex items-center justify-center p-6">
      <button type="button" aria-label="Fermer l'aperçu du dossier" className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-[2201] flex h-[min(88vh,920px)] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[#007cbd]">Dossier de candidature</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">
              {candidate.user.firstname} {candidate.user.lastname}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-700 hover:bg-slate-200">
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-4">
            {rows.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{label}</p>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-900">{value || "Non renseigné"}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DiscoveryFeedbackPreviewModal({
  candidate,
  values,
  onClose
}: {
  candidate: any;
  values: Record<string, string>;
  onClose: () => void;
}) {
  const rows = [
    ["Prénom", values.firstname],
    ["Nom", values.lastname],
    ["Date de la journée découverte", values.discoveryDate],
    ["Qu'avez-vous pensé de cette Journée Découverte ?", values.discoveryFeedback],
    ["Avez-vous identifié des points d'amélioration ?", values.improvementPoints],
    [
      "Souhaitez vous continuer le parcours de candidature ?",
      values.continueJourney
        ? values.continueJourney.charAt(0).toUpperCase() + values.continueJourney.slice(1)
        : ""
    ],
    ["Pourquoi souhaitez vous arrêter le parcours de candidature ?", values.stopReason]
  ];

  return (
    <div className="absolute inset-0 z-[2200] flex items-center justify-center p-6">
      <button
        type="button"
        aria-label="Fermer l'aperçu du retour journée découverte"
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-[2201] flex h-[min(88vh,920px)] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-[#007cbd]">Retour journée découverte</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">
              {candidate.user.firstname} {candidate.user.lastname}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-700 hover:bg-slate-200"
          >
            ×
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-4">
            {rows
              .filter(([label, value]) => label !== "Pourquoi souhaitez vous arrêter le parcours de candidature ?" || value)
              .map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{label}</p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-900">
                    {value || "Non renseigné"}
                  </p>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}
