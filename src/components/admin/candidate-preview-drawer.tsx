"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CandidateMiniMap } from "@/components/maps/candidate-mini-map";
import { getStepTheme, STEP_LABELS } from "@/lib/utils/constants";
import { formatPhoneNumber } from "@/lib/utils/formatters";

type CandidatePreviewDrawerProps = {
  candidateId: string | null;
  onClose: () => void;
};

const DOCUMENT_LABELS: Array<{ type: string; label: string }> = [
  { type: "questionnaire", label: "Formulaire de candidature" },
  { type: "cv", label: "CV" },
  { type: "retour_journee_decouverte", label: "Retour de la journée découverte" },
  { type: "elm", label: "ELM" },
  { type: "dip", label: "DIP" },
  { type: "plans_local", label: "Plan du local" },
  { type: "kbis", label: "KBIS" },
  { type: "statuts", label: "Statuts de l'entreprise" },
  { type: "carte_identite", label: "Carte d'identité" }
];

export function CandidatePreviewDrawer({ candidateId, onClose }: CandidatePreviewDrawerProps) {
  const [candidate, setCandidate] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [stepPickerOpen, setStepPickerOpen] = useState(false);
  const [isSavingStep, setIsSavingStep] = useState(false);
  const [applicationFormOpen, setApplicationFormOpen] = useState(false);
  const [applicationPreviewOpen, setApplicationPreviewOpen] = useState(false);
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadingDocumentType, setUploadingDocumentType] = useState<string | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const documentInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const loadCandidate = async (id: string) => {
    const response = await fetch(`/api/admin/candidates/${id}`);

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Impossible de charger le candidat.");
    }

    return response.json();
  };

  useEffect(() => {
    if (!candidateId) return;

    let isActive = true;
    setLoading(true);
    setError("");

    loadCandidate(candidateId)
      .then((data) => {
        if (isActive) setCandidate(data);
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
    if (!candidateId) {
      setCandidate(null);
      setError("");
      setStepPickerOpen(false);
    }
  }, [candidateId]);

  const currentStepLabel = candidate ? STEP_LABELS[candidate.currentStep - 1] ?? `Étape ${candidate.currentStep}` : "";
  const currentStepTheme = candidate ? getStepTheme(candidate.currentStep) : getStepTheme(1);
  const profilePhoto = candidate?.documents?.find((document: any) => document.type === "photo_profil");
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
      familySituation: candidate?.familySituation ?? raw?.familySituation ?? "",
      childrenCount: candidate?.childrenCount ?? raw?.childrenCount ?? "",
      profession: candidate?.profession ?? raw?.profession ?? "",
      professionalSituation: candidate?.professionalSituation ?? raw?.professionalSituation ?? "",
      projectZone: candidate?.projectZone ?? raw?.projectZone ?? "",
      projectDelay: candidate?.projectDelay ?? raw?.projectDelay ?? "",
      personalContribution: candidate?.personalContribution ?? raw?.personalContribution ?? "",
      motivation: candidate?.motivation ?? raw?.motivation ?? "",
      entrepreneurshipExperience: candidate?.entrepreneurshipExperience ?? raw?.entrepreneurshipExperience ?? "",
      notes: candidate?.applicationNotes ?? raw?.notes ?? ""
    };
  }, [candidate]);
  const hasProfilePhoto = Boolean(profilePhoto?.fileUrl);
  const hasCv = Boolean(candidate?.documents?.find((document: any) => document.type === "cv")?.fileUrl);
  const isApplicationComplete =
    Object.values(applicationFormData).every((value) => value.trim().length > 0) && hasProfilePhoto && hasCv;
  const documentRows = useMemo(() => {
    if (!candidate) return [];

    return DOCUMENT_LABELS.map((item) => {
      const documents = candidate.documents
        .filter((entry: any) => entry.type === item.type)
        .sort((a: any, b: any) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

      return {
        ...item,
        exists: item.type === "questionnaire" ? isApplicationComplete : documents.length > 0,
        files: documents.map((document: any) => ({
          id: document.id as string,
          fileUrl: document.fileUrl as string,
          fileName: document.fileName as string
        }))
      };
    });
  }, [candidate, isApplicationComplete]);

  const handleStepChange = async (nextStep: number) => {
    if (!candidate || nextStep === candidate.currentStep) {
      setStepPickerOpen(false);
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

      const refreshedCandidate = await loadCandidate(candidate.id);
      setCandidate(refreshedCandidate);
      setStepPickerOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de mettre à jour l'étape.");
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

      const refreshedCandidate = await loadCandidate(candidate.id);
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

    const refreshedCandidate = await loadCandidate(candidate.id);
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

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Impossible de télécharger le document.");
      }

      const refreshedCandidate = await loadCandidate(candidate.id);
      setCandidate(refreshedCandidate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de télécharger le document.");
    } finally {
      setUploadingDocumentType(null);
      event.target.value = "";
    }
  };

  const handleOpenDocument = async (document: { fileUrl?: string; fileName?: string }) => {
    if (!document.fileUrl) {
      return;
    }

    if (document.fileUrl.startsWith("data:")) {
      const response = await fetch(document.fileUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      return;
    }

    window.open(document.fileUrl, "_blank", "noopener,noreferrer");
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

      const refreshedCandidate = await loadCandidate(candidate.id);
      setCandidate(refreshedCandidate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de supprimer le document.");
    } finally {
      setDeletingDocumentId(null);
    }
  };

  if (!candidateId) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[2000]">
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
      <aside className="absolute right-0 top-0 h-screen w-[min(520px,calc(100vw-1rem))] overflow-y-auto rounded-l-[2rem] border-l border-slate-200 bg-white/96 p-5 shadow-2xl backdrop-blur-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
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
                    <span className="cursor-default">{candidate.city}</span>
                    <div className="pointer-events-none absolute left-0 top-full z-20 hidden w-[240px] pt-3 group-hover:block">
                      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl">
                        <div className="h-[180px] overflow-hidden rounded-2xl">
                          <CandidateMiniMap latitude={candidate.latitude} longitude={candidate.longitude} zoom={2.8} />
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
                  {candidate.user.phone ? formatPhoneNumber(candidate.user.phone) : "Téléphone non renseigné"}
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

            <Card className="p-4">
              <p className="text-lg font-bold text-slate-950">Documents</p>
              <div className="mt-4 space-y-2">
                {documentRows.map((document) => (
                  <div
                    key={document.type}
                    className={`flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 ${
                      document.exists ? "border-emerald-200 bg-emerald-50/70" : "border-slate-200 bg-slate-50"
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-2">
                      <span className={`text-base ${document.exists ? "text-emerald-600" : "text-slate-300"}`}>{document.exists ? "✓" : "○"}</span>
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
                            className={`text-left text-sm transition ${document.exists ? "font-medium text-slate-950 hover:font-bold" : "cursor-not-allowed text-slate-500"}`}
                          >
                            {document.label}
                          </button>
                        ) : (
                          <p className={`text-sm ${document.exists ? "font-medium text-slate-950" : "text-slate-500"}`}>{document.label}</p>
                        )}
                        {document.type !== "questionnaire" && document.files.length ? (
                          <div className="mt-1 space-y-1">
                            {document.files.map((file) => (
                              <div key={file.id} className="flex items-start gap-1.5">
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
                                <button
                                  type="button"
                                  onClick={() => void handleOpenDocument(file)}
                                  className="block text-left text-xs text-slate-500 transition hover:font-semibold hover:text-slate-700"
                                >
                                  {file.fileName}
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    {document.type === "questionnaire" ? null : (
                      <button
                        type="button"
                        onClick={() => documentInputRefs.current[document.type]?.click()}
                        disabled={uploadingDocumentType === document.type}
                        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 shadow-sm hover:bg-slate-200 hover:text-slate-700 disabled:cursor-wait disabled:opacity-60"
                        aria-label={`Télécharger ${document.label}`}
                        title={`Télécharger ${document.label}`}
                      >
                        {uploadingDocumentType === document.type ? "…" : <Download className="h-4 w-4" strokeWidth={2.2} />}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <p className="text-lg font-bold text-slate-950">Commentaires</p>
              <div className="mt-4 space-y-3">
                {candidate.notes.length ? (
                  candidate.notes.map((note: any) => (
                    <div key={note.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.12em] text-slate-400">
                        {note.author.firstname} {note.author.lastname}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-slate-700">{note.noteText}</p>
                    </div>
                  ))
                ) : null}
              </div>
            </Card>
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
                <FormField label="Zone de projet" name="projectZone" defaultValue={initialValues.projectZone} />
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
    ["Adresse", values.address],
    ["Ville", values.city],
    ["Code postal", values.zipcode],
    ["Situation familiale", values.familySituation],
    ["Nombre d'enfants", values.childrenCount],
    ["Profession actuelle", values.profession],
    ["Situation professionnelle", values.professionalSituation],
    ["Zone de projet", values.projectZone],
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
