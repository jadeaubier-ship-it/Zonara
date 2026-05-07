"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CandidatePreviewDrawer } from "@/components/admin/candidate-preview-drawer";
import { getStepTheme, STEP_LABELS } from "@/lib/utils/constants";
import { formatPhoneNumber } from "@/lib/utils/formatters";

type CandidateRow = {
  id: string;
  city: string;
  zipcode?: string | null;
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
  const [message, setMessage] = useState("");
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
      setSavingStepCandidateId(null);
      router.refresh();
    });
  }

  return (
    <>
      <CandidatePreviewDrawer candidateId={openedCandidateId} onClose={() => setOpenedCandidateId(null)} />
      <Card className="overflow-visible bg-white/82 p-0 backdrop-blur-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
          <div />
          <div className="flex items-center gap-3">
            {message ? <p className="text-xs text-slate-500">{message}</p> : null}
            {selectedIds.length ? (
              <Button type="button" variant="ghost" onClick={archiveSelection} disabled={isPending} className="px-3 py-2 text-xs">
                Archiver la sélection
              </Button>
            ) : null}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[12px] leading-tight">
          <thead className="bg-slate-50 text-left text-[11px] font-medium uppercase tracking-[0.02em] text-slate-500">
            <tr>
              <th className="w-10 px-2 py-2">
                <span className="sr-only">Sélection</span>
              </th>
              <th className="px-2 py-2">Nom Prénom</th>
              <th className="px-2 py-2 whitespace-nowrap">Date création</th>
              <th className="px-2 py-2">Étape dossier</th>
              <th className="px-2 py-2">Email</th>
              <th className="px-2 py-2 whitespace-nowrap">Téléphone</th>
              <th className="px-2 py-2 whitespace-nowrap">Ville</th>
              <th className="px-2 py-2 whitespace-nowrap">Source</th>
              <th className="w-28 px-2 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {showCreateRow ? (
              <tr className="border-t border-slate-100 bg-slate-50/60">
                <td className="px-2 py-1.5 align-middle text-[11px] text-slate-400">+</td>
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
            {candidates.map((candidate) => {
              const stepTheme = getStepTheme(candidate.currentStep);

              return (
              <tr
                key={candidate.id}
                className="cursor-pointer border-t border-slate-100 hover:bg-slate-50"
                onClick={() => setOpenedCandidateId(candidate.id)}
              >
                <td className="px-2 py-1.5 align-middle">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(candidate.id)}
                    onChange={() => toggleCandidate(candidate.id)}
                    onClick={(event) => event.stopPropagation()}
                    className="h-3.5 w-3.5 rounded border-slate-300"
                  />
                </td>
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
                      setStepPickerCandidateId((current) => (current === candidate.id ? null : candidate.id));
                    }}
                    className="text-left"
                    disabled={savingStepCandidateId === candidate.id}
                  >
                    <Badge className={stepTheme.soft}>
                      {STEP_LABELS[candidate.currentStep - 1] ?? `Étape ${candidate.currentStep}`}
                    </Badge>
                  </button>
                  {stepPickerCandidateId === candidate.id ? (
                    <Card className="absolute left-2 top-[calc(100%+0.35rem)] z-20 min-w-[240px] p-2 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                      <div className="space-y-1">
                        {STEP_LABELS.map((label, index) => {
                          const stepNumber = index + 1;
                          const optionTheme = getStepTheme(stepNumber);

                          return (
                            <button
                              key={stepNumber}
                              type="button"
                              onClick={() => changeCandidateStep(candidate.id, stepNumber)}
                              disabled={savingStepCandidateId === candidate.id}
                              className={`flex w-full items-center rounded-xl border px-2.5 py-2 text-left text-[12px] font-semibold leading-tight transition ${optionTheme.soft}`}
                            >
                              <span className={`mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${optionTheme.badge}`}>
                                {stepNumber}
                              </span>
                              <span>{label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </Card>
                  ) : null}
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
                  {candidate.city}
                  {candidate.zipcode ? ` (${candidate.zipcode})` : ""}
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
