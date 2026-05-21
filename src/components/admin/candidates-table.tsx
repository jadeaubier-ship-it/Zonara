"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApplicationInvitationModal } from "@/components/admin/application-invitation-modal";
import { CandidatePreviewDrawer } from "@/components/admin/candidate-preview-drawer";
import { getStepTheme, STEP_LABELS } from "@/lib/utils/constants";
import { formatPhoneNumber } from "@/lib/utils/formatters";

const CandidateMiniMap = dynamic(() => import("@/components/maps/candidate-mini-map").then((mod) => mod.CandidateMiniMap), {
  ssr: false
});

type CandidateRow = {
  id: string;
  city: string;
  zipcode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  source?: string | null;
  createdAt: string | Date;
  currentStep: number;
  user: {
    firstname: string;
    lastname: string;
    email: string;
    phone?: string | null;
  };
};

const sourceVariant: Record<string, "red" | "blue" | "orange" | "green" | "slate"> = {
  "L'EXPRESS": "red",
  A3D: "blue",
  HelloWork: "orange",
  MAIL: "green"
};

export function CandidatesTable({
  candidates,
  showCreateRow = true
}: {
  candidates: CandidateRow[];
  showCreateRow?: boolean;
}) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openedCandidateId, setOpenedCandidateId] = useState<string | null>(null);
  const [stepPickerCandidateId, setStepPickerCandidateId] = useState<string | null>(null);
  const [savingStepCandidateId, setSavingStepCandidateId] = useState<string | null>(null);
  const [stepPickerPosition, setStepPickerPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const [invitationModalCandidateId, setInvitationModalCandidateId] = useState<string | null>(null);
  const [discoveryModalCandidateId, setDiscoveryModalCandidateId] = useState<string | null>(null);
  const [hoveredCityPreview, setHoveredCityPreview] = useState<{
    top: number;
    left: number;
    latitude: number;
    longitude: number;
    cityLabel: string;
  } | null>(null);
  const stepPickerRef = useRef<HTMLDivElement | null>(null);
  const cityPreviewTimeoutRef = useRef<number | null>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"createdAt" | "name" | "currentStep" | "email" | "phone" | "city" | "source">("createdAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [draft, setDraft] = useState({
    firstname: "",
    lastname: "",
    email: "",
    createdAt: new Date().toISOString().slice(0, 10),
    phone: "",
    city: "",
    zipcode: "",
    source: "L'EXPRESS"
  });
  const [isPending, startTransition] = useTransition();

  function toggleCandidate(candidateId: string) {
    setSelectedIds((current) =>
      current.includes(candidateId) ? current.filter((id) => id !== candidateId) : [...current, candidateId]
    );
  }

  function archiveSelection() {
    if (!selectedIds.length) {
      setMessage("Sélectionnez au moins un candidat.");
      return;
    }

    startTransition(async () => {
      setMessage("");
      const response = await fetch("/api/admin/candidates/archive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ candidateIds: selectedIds })
      });

      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setMessage(data?.error ?? "Impossible d'archiver les candidats.");
        return;
      }

      setSelectedIds([]);
      setMessage("Candidats archivés.");
      router.refresh();
    });
  }

  function createCandidate() {
    startTransition(async () => {
      setMessage("");
      const response = await fetch("/api/admin/candidates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(draft)
      });

      const data = (await response.json().catch(() => null)) as { error?: string | { fieldErrors?: Record<string, string[]> } } | null;

      if (!response.ok) {
        if (typeof data?.error === "string") {
          setMessage(data.error);
          return;
        }

        setMessage("Impossible de créer le candidat.");
        return;
      }

      setDraft({
        firstname: "",
        lastname: "",
        email: "",
        createdAt: new Date().toISOString().slice(0, 10),
        phone: "",
        city: "",
        zipcode: "",
        source: "L'EXPRESS"
      });
      setMessage("Candidat créé.");
      router.refresh();
    });
  }

  function changeCandidateStep(candidateId: string, nextStep: number) {
    const selectedCandidate = candidates.find((entry) => entry.id === candidateId);

    if (selectedCandidate?.currentStep === 1 && nextStep === 2) {
      setStepPickerCandidateId(null);
      setStepPickerPosition(null);
      setInvitationModalCandidateId(candidateId);
      return;
    }

    if (selectedCandidate?.currentStep === 3 && nextStep === 4) {
      setStepPickerCandidateId(null);
      setStepPickerPosition(null);
      setDiscoveryModalCandidateId(candidateId);
      return;
    }

    setSavingStepCandidateId(candidateId);
    setMessage("");

    startTransition(async () => {
      const response = await fetch(`/api/admin/candidates/${candidateId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ currentStep: nextStep })
      });

      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setMessage(data?.error ?? "Impossible de mettre à jour l'étape.");
        setSavingStepCandidateId(null);
        return;
      }

      setStepPickerCandidateId(null);
      setStepPickerPosition(null);
      setSavingStepCandidateId(null);
      router.refresh();
    });
  }

  function handleInvitationFlowChoice({
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
  }) {
    if (!invitationModalCandidateId) {
      return Promise.resolve();
    }

    const candidateId = invitationModalCandidateId;
    setSavingStepCandidateId(candidateId);
    setMessage("");

    return new Promise<void>((resolve, reject) => {
      startTransition(async () => {
        try {
          const response = await fetch(`/api/admin/candidates/${candidateId}`, {
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
            throw new Error(data?.error ?? "Impossible de mettre à jour l'étape.");
          }

          setInvitationModalCandidateId(null);
          setStepPickerCandidateId(null);
          setStepPickerPosition(null);
          setSavingStepCandidateId(null);

          if (data?.mailWarning) {
            setMessage(data.mailWarning);
          }

          router.refresh();
          resolve();
        } catch (error) {
          setSavingStepCandidateId(null);
          const message = error instanceof Error ? error.message : "Impossible de mettre à jour l'étape.";
          setMessage(message);
          reject(error);
        }
      });
    });
  }

  function handleDiscoveryFlowChoice({
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
  }) {
    if (!discoveryModalCandidateId) {
      return Promise.resolve();
    }

    const candidateId = discoveryModalCandidateId;
    setSavingStepCandidateId(candidateId);
    setMessage("");

    return new Promise<void>((resolve, reject) => {
      startTransition(async () => {
        try {
          const response = await fetch(`/api/admin/candidates/${candidateId}`, {
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
            throw new Error(data?.error ?? "Impossible de mettre à jour l'étape.");
          }

          setDiscoveryModalCandidateId(null);
          setStepPickerCandidateId(null);
          setStepPickerPosition(null);
          setSavingStepCandidateId(null);
          if (data?.mailWarning) {
            setMessage(data.mailWarning);
          }
          router.refresh();
          resolve();
        } catch (error) {
          setSavingStepCandidateId(null);
          const message = error instanceof Error ? error.message : "Impossible de mettre à jour l'étape.";
          setMessage(message);
          reject(error);
        }
      });
    });
  }

  useEffect(() => {
    function closePicker() {
      setStepPickerCandidateId(null);
      setStepPickerPosition(null);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closePicker();
      }
    }

    function handlePointerDown(event: MouseEvent) {
      if (stepPickerRef.current && !stepPickerRef.current.contains(event.target as Node)) {
        closePicker();
      }
    }

    if (stepPickerCandidateId) {
      window.addEventListener("keydown", handleEscape);
      window.addEventListener("mousedown", handlePointerDown);
      window.addEventListener("resize", closePicker);
      window.addEventListener("scroll", closePicker, true);
    }

    return () => {
      window.removeEventListener("keydown", handleEscape);
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("resize", closePicker);
      window.removeEventListener("scroll", closePicker, true);
    };
  }, [stepPickerCandidateId]);

  useEffect(() => {
    function closeCityPreview() {
      setHoveredCityPreview(null);
    }

    if (hoveredCityPreview) {
      window.addEventListener("resize", closeCityPreview);
      window.addEventListener("scroll", closeCityPreview, true);
    }

    return () => {
      window.removeEventListener("resize", closeCityPreview);
      window.removeEventListener("scroll", closeCityPreview, true);
    };
  }, [hoveredCityPreview]);

  function clearCityPreviewTimeout() {
    if (cityPreviewTimeoutRef.current) {
      window.clearTimeout(cityPreviewTimeoutRef.current);
      cityPreviewTimeoutRef.current = null;
    }
  }

  function scheduleCityPreviewClose() {
    clearCityPreviewTimeout();
    cityPreviewTimeoutRef.current = window.setTimeout(() => {
      setHoveredCityPreview(null);
    }, 120);
  }

  function toggleSort(nextSortBy: "createdAt" | "name" | "currentStep" | "email" | "phone" | "city" | "source") {
    if (sortBy === nextSortBy) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(nextSortBy);
    setSortDirection(nextSortBy === "createdAt" ? "desc" : "asc");
  }

  function renderSortArrow(column: "createdAt" | "name" | "currentStep" | "email" | "phone" | "city" | "source") {
    if (sortBy !== column) {
      return <span className="text-[10px] text-slate-300">↓</span>;
    }

    return <span className="text-[10px] text-slate-500">{sortDirection === "asc" ? "↑" : "↓"}</span>;
  }

  const normalizedSearch = search.trim().toLowerCase();
  const filteredCandidates = normalizedSearch
    ? candidates.filter((candidate) => {
        const haystack = [
          candidate.user.firstname,
          candidate.user.lastname,
          `${candidate.user.firstname} ${candidate.user.lastname}`,
          `${candidate.user.lastname} ${candidate.user.firstname}`,
          candidate.user.email,
          candidate.user.phone,
          formatPhoneNumber(candidate.user.phone)
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(normalizedSearch);
      })
    : candidates;

  const sortedCandidates = [...filteredCandidates].sort((leftCandidate, rightCandidate) => {
    const direction = sortDirection === "asc" ? 1 : -1;

    if (sortBy === "createdAt") {
      return (new Date(leftCandidate.createdAt).getTime() - new Date(rightCandidate.createdAt).getTime()) * direction;
    }

    if (sortBy === "currentStep") {
      return (leftCandidate.currentStep - rightCandidate.currentStep) * direction;
    }

    const leftValue =
      sortBy === "name"
        ? `${leftCandidate.user.firstname} ${leftCandidate.user.lastname}`.trim()
        : sortBy === "email"
          ? leftCandidate.user.email ?? ""
          : sortBy === "phone"
            ? leftCandidate.user.phone ?? ""
            : sortBy === "city"
              ? leftCandidate.city ?? ""
              : leftCandidate.source ?? "";

    const rightValue =
      sortBy === "name"
        ? `${rightCandidate.user.firstname} ${rightCandidate.user.lastname}`.trim()
        : sortBy === "email"
          ? rightCandidate.user.email ?? ""
          : sortBy === "phone"
            ? rightCandidate.user.phone ?? ""
            : sortBy === "city"
              ? rightCandidate.city ?? ""
              : rightCandidate.source ?? "";

    return leftValue.localeCompare(rightValue, "fr", { sensitivity: "base" }) * direction;
  });

  return (
    <>
      <CandidatePreviewDrawer candidateId={openedCandidateId} onClose={() => setOpenedCandidateId(null)} />
      {invitationModalCandidateId ? (
        <ApplicationInvitationModal
          templateSlug="candidate-application-invitation"
          title="Dossier de candidature"
          onClose={() => {
            if (!savingStepCandidateId) {
              setInvitationModalCandidateId(null);
            }
          }}
          onConfirm={handleInvitationFlowChoice}
        />
      ) : null}
      {discoveryModalCandidateId ? (
        <ApplicationInvitationModal
          templateSlug="candidate-discovery-invitation"
          title="Journée découverte"
          onClose={() => {
            if (!savingStepCandidateId) {
              setDiscoveryModalCandidateId(null);
            }
          }}
          onConfirm={handleDiscoveryFlowChoice}
        />
      ) : null}
      {stepPickerCandidateId && stepPickerPosition
        ? createPortal(
            <div
              ref={stepPickerRef}
              className="fixed z-50 rounded-3xl border border-slate-200 bg-white p-2 shadow-2xl"
              style={{
                top: stepPickerPosition.top,
                left: stepPickerPosition.left,
                width: Math.max(stepPickerPosition.width + 42, 170)
              }}
            >
              <div className="space-y-1">
                {STEP_LABELS.map((label, index) => {
                  const stepNumber = index + 1;
                  const optionTheme = getStepTheme(stepNumber);

                  return (
                    <button
                      key={stepNumber}
                      type="button"
                      onClick={() => changeCandidateStep(stepPickerCandidateId, stepNumber)}
                      disabled={savingStepCandidateId === stepPickerCandidateId}
                      className={`flex h-[22px] w-full items-center rounded-full border px-2 py-0 text-left text-[10px] font-semibold leading-tight transition ${optionTheme.soft}`}
                    >
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body
          )
        : null}
      {hoveredCityPreview
        ? createPortal(
            <div
              className="fixed z-40 w-[240px] pt-3"
              style={{
                top: hoveredCityPreview.top,
                left: hoveredCityPreview.left
              }}
              onMouseEnter={clearCityPreviewTimeout}
              onMouseLeave={scheduleCityPreviewClose}
            >
              <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-2xl">
                <div className="h-[180px] overflow-hidden rounded-2xl">
                  <CandidateMiniMap
                    latitude={hoveredCityPreview.latitude}
                    longitude={hoveredCityPreview.longitude}
                    cityLabel={hoveredCityPreview.cityLabel}
                    zoom={2.8}
                  />
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
      <Card className="overflow-visible bg-white/82 p-0 backdrop-blur-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
          <div />
          <div className="flex items-center gap-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher un candidat"
              className="h-8 w-[230px] rounded-lg border border-slate-200 bg-white px-3 text-[12px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-slate-300"
            />
            {message ? <p className="text-xs text-slate-500">{message}</p> : null}
            {selectedIds.length ? (
              <Button type="button" variant="ghost" onClick={archiveSelection} disabled={isPending} className="px-3 py-2 text-xs">
                Archiver la sélection
              </Button>
            ) : null}
          </div>
        </div>
        <div className="overflow-x-auto overflow-y-visible">
          <table className="min-w-full text-[12px] leading-tight">
          <thead className="bg-slate-50 text-left text-[11px] font-medium uppercase tracking-[0.02em] text-slate-500">
            <tr>
              <th className="px-2 py-2">
                <button type="button" onClick={() => toggleSort("name")} className="inline-flex items-center gap-1">
                  <span>Nom Prénom</span>
                  {renderSortArrow("name")}
                </button>
              </th>
              <th className="px-2 py-2 whitespace-nowrap">
                <button type="button" onClick={() => toggleSort("createdAt")} className="inline-flex items-center gap-1">
                  <span>Date création</span>
                  {renderSortArrow("createdAt")}
                </button>
              </th>
              <th className="px-2 py-2">
                <button type="button" onClick={() => toggleSort("currentStep")} className="inline-flex items-center gap-1">
                  <span>Étape dossier</span>
                  {renderSortArrow("currentStep")}
                </button>
              </th>
              <th className="px-2 py-2">
                <button type="button" onClick={() => toggleSort("email")} className="inline-flex items-center gap-1">
                  <span>Email</span>
                  {renderSortArrow("email")}
                </button>
              </th>
              <th className="px-2 py-2 whitespace-nowrap">
                <button type="button" onClick={() => toggleSort("phone")} className="inline-flex items-center gap-1">
                  <span>Téléphone</span>
                  {renderSortArrow("phone")}
                </button>
              </th>
              <th className="px-2 py-2 whitespace-nowrap">
                <button type="button" onClick={() => toggleSort("city")} className="inline-flex items-center gap-1">
                  <span>Ville</span>
                  {renderSortArrow("city")}
                </button>
              </th>
              <th className="px-2 py-2 whitespace-nowrap">
                <button type="button" onClick={() => toggleSort("source")} className="inline-flex items-center gap-1">
                  <span>Source</span>
                  {renderSortArrow("source")}
                </button>
              </th>
              <th className="w-28 px-2 py-2 text-right" />
            </tr>
          </thead>
          <tbody>
            {showCreateRow ? (
              <tr className="border-t border-slate-100 bg-slate-50/60">
                <td className="px-2 py-1.5 align-middle">
                  <div className="grid grid-cols-2 gap-1">
                    <input
                      value={draft.firstname}
                      onChange={(event) => setDraft((current) => ({ ...current, firstname: event.target.value }))}
                      placeholder="Prénom"
                      className="h-7 rounded-lg border border-slate-200 px-2 text-[12px]"
                    />
                    <input
                      value={draft.lastname}
                      onChange={(event) => setDraft((current) => ({ ...current, lastname: event.target.value }))}
                      placeholder="Nom"
                      className="h-7 rounded-lg border border-slate-200 px-2 text-[12px]"
                    />
                  </div>
                </td>
                <td className="px-2 py-1.5 align-middle whitespace-nowrap text-slate-400">
                  <input
                    type="date"
                    value={draft.createdAt}
                    onChange={(event) => setDraft((current) => ({ ...current, createdAt: event.target.value }))}
                    className="h-7 w-[132px] rounded-lg border border-slate-200 px-2 text-[12px] text-slate-700"
                  />
                </td>
                <td className="px-2 py-1.5 align-middle whitespace-nowrap">
                  <Badge className={getStepTheme(1).soft}>Prise de contact</Badge>
                </td>
                <td className="px-2 py-1.5 align-middle">
                  <input
                    value={draft.email}
                    onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
                    placeholder="Email"
                    className="h-7 w-full rounded-lg border border-slate-200 px-2 text-[12px]"
                  />
                </td>
                <td className="px-2 py-1.5 align-middle">
                  <input
                    value={draft.phone}
                    onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
                    placeholder="Téléphone"
                    className="h-7 w-full rounded-lg border border-slate-200 px-2 text-[12px]"
                  />
                </td>
                <td className="px-2 py-1.5 align-middle">
                  <div className="grid grid-cols-[minmax(0,1fr)_84px] gap-1">
                    <input
                      value={draft.city}
                      onChange={(event) => setDraft((current) => ({ ...current, city: event.target.value }))}
                      placeholder="Ville"
                      className="h-7 rounded-lg border border-slate-200 px-2 text-[12px]"
                    />
                    <input
                      value={draft.zipcode}
                      onChange={(event) => setDraft((current) => ({ ...current, zipcode: event.target.value }))}
                      placeholder="CP"
                      className="h-7 rounded-lg border border-slate-200 px-2 text-[12px]"
                    />
                  </div>
                </td>
                <td className="px-2 py-1.5 align-middle">
                  <select
                    value={draft.source}
                    onChange={(event) => setDraft((current) => ({ ...current, source: event.target.value }))}
                    className="h-7 w-full rounded-lg border border-slate-200 px-2 text-[12px]"
                  >
                    <option>L&apos;EXPRESS</option>
                    <option>A3D</option>
                    <option>HelloWork</option>
                    <option>MAIL</option>
                    <option>LinkedIn</option>
                    <option>Site web</option>
                    <option>Recommandation</option>
                    <option>Autre</option>
                  </select>
                </td>
                <td className="px-2 py-1.5 align-middle text-right">
                  <Button type="button" onClick={createCandidate} disabled={isPending} className="px-3 py-2 text-[11px]">
                    Valider
                  </Button>
                </td>
              </tr>
            ) : null}
            {sortedCandidates.map((candidate) => {
              const stepTheme = getStepTheme(candidate.currentStep);

              return (
              <tr
                key={candidate.id}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                onClick={() => setOpenedCandidateId(candidate.id)}
              >
                <td className="px-2 py-1.5 whitespace-nowrap font-medium">
                  <button type="button" onClick={() => setOpenedCandidateId(candidate.id)} className="text-slate-900">
                    {candidate.user.firstname} {candidate.user.lastname.toUpperCase()}
                  </button>
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap text-slate-600">
                  {format(new Date(candidate.createdAt), "dd/MM/yyyy", { locale: fr })}
                </td>
                <td className="relative px-2 py-1.5 whitespace-nowrap">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      const rect = event.currentTarget.getBoundingClientRect();
                      const nextId = stepPickerCandidateId === candidate.id ? null : candidate.id;

                      setStepPickerCandidateId(nextId);
                      setStepPickerPosition(
                        nextId
                          ? {
                              top: rect.bottom + 6,
                              left: rect.left,
                              width: rect.width
                            }
                          : null
                      );
                    }}
                    className="text-left"
                    disabled={savingStepCandidateId === candidate.id}
                  >
                    <Badge className={stepTheme.soft}>
                      {STEP_LABELS[candidate.currentStep - 1] ?? `Étape ${candidate.currentStep}`}
                    </Badge>
                  </button>
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap text-slate-700">
                  <a
                    href={`mailto:${candidate.user.email}`}
                    onClick={(event) => event.stopPropagation()}
                    className="underline-offset-2 hover:underline"
                  >
                    {candidate.user.email}
                  </a>
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap text-slate-700">
                  {candidate.user.phone ? formatPhoneNumber(candidate.user.phone) : "-"}
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap text-slate-700">
                  <div className="inline-block">
                    <span
                      className="cursor-default"
                      onMouseEnter={(event) => {
                        clearCityPreviewTimeout();
                        if (candidate.latitude && candidate.longitude) {
                          const rect = event.currentTarget.getBoundingClientRect();
                          setHoveredCityPreview({
                            top: rect.bottom,
                            left: rect.left,
                            latitude: candidate.latitude,
                            longitude: candidate.longitude,
                            cityLabel: candidate.city
                          });
                        }
                      }}
                      onMouseLeave={scheduleCityPreviewClose}
                    >
                      {candidate.city}
                      {candidate.zipcode ? ` (${candidate.zipcode})` : ""}
                    </span>
                  </div>
                </td>
                <td className="px-2 py-1.5 whitespace-nowrap">
                  <Badge variant={sourceVariant[candidate.source ?? ""] ?? "slate"}>{candidate.source ?? "Non renseignée"}</Badge>
                </td>
                <td className="px-2 py-1.5" />
              </tr>
              );
            })}
          </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
