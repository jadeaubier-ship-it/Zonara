"use client";

import { ChangeEvent, useRef, useState } from "react";
import { Card } from "@/components/ui/card";

type LocalProjectFile = {
  id: string;
  kind: string;
  fileName: string;
  href: string;
};

type LocalProject = {
  id: string;
  address: string;
  city: string;
  zipcode: string;
  surfaceM2: number;
  monthlyRentHt?: string;
  monthlyChargesHt?: string;
  status: string;
  files: LocalProjectFile[];
};

export function CandidatePortalLocalProjectsCard({
  token,
  currentStep,
  initialProjects
}: {
  token: string;
  currentStep: number;
  initialProjects: LocalProject[];
}) {
  const [projects, setProjects] = useState(initialProjects);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [street, setStreet] = useState("");
  const [zipcode, setZipcode] = useState("");
  const [city, setCity] = useState("");
  const [monthlyRentHt, setMonthlyRentHt] = useState("");
  const [monthlyChargesHt, setMonthlyChargesHt] = useState("");
  const plansInputRef = useRef<HTMLInputElement | null>(null);
  const photosInputRef = useRef<HTMLInputElement | null>(null);
  const [plans, setPlans] = useState<File[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);

  if (currentStep < 6) {
    return null;
  }

  function formatProjectAddress(project: LocalProject) {
    return [project.address, project.zipcode, project.city].filter(Boolean).join(", ").replace(", ,", ",");
  }

  async function handleCreateProject() {
    if (!street.trim() || !zipcode.trim() || !city.trim()) {
      setError("Le nom de rue, le code postal et la ville sont obligatoires.");
      return;
    }

    if (!monthlyRentHt.trim() || !monthlyChargesHt.trim()) {
      setError("Le loyer mensuel HT et les charges mensuelles HT sont obligatoires.");
      return;
    }

    if (!plans.length || !photos.length) {
      setError("Vous devez joindre au moins un plan et une photo pour créer ce projet.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("address", street.trim());
      formData.append("zipcode", zipcode.trim());
      formData.append("city", city.trim());
      formData.append("monthlyRentHt", monthlyRentHt.trim());
      formData.append("monthlyChargesHt", monthlyChargesHt.trim());
      plans.forEach((file) => formData.append("plans", file));
      photos.forEach((file) => formData.append("photos", file));

      const response = await fetch(`/api/public/candidate-space/${token}/local-projects`, {
        method: "POST",
        body: formData
      });

      const data = (await response.json().catch(() => null)) as
        | {
            error?: string;
            project?: LocalProject;
          }
        | null;

      if (!response.ok || !data?.project) {
        throw new Error(data?.error ?? "Impossible de créer ce projet de local.");
      }

      setProjects((current) => [data.project!, ...current]);
      setStreet("");
      setZipcode("");
      setCity("");
      setMonthlyRentHt("");
      setMonthlyChargesHt("");
      setPlans([]);
      setPhotos([]);
      if (plansInputRef.current) plansInputRef.current.value = "";
      if (photosInputRef.current) photosInputRef.current.value = "";
      setCreating(false);
      setMessage("Projet de local enregistré.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de créer ce projet de local.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[16px] font-bold text-slate-950">Local</h2>
        </div>
      </div>

      {error ? <p className="text-[12px] text-rose-600">{error}</p> : null}
      {!error && message ? <p className="text-[12px] text-emerald-600">{message}</p> : null}

      {creating ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Nom de rue</label>
              <input
                value={street}
                onChange={(event) => setStreet(event.target.value)}
                placeholder="12 rue de l'Europe"
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none transition focus:border-[#007cbd]"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Code postal
                </label>
                <input
                  value={zipcode}
                  onChange={(event) => setZipcode(event.target.value)}
                  placeholder="64100"
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none transition focus:border-[#007cbd]"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Ville</label>
                <input
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="Bayonne"
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none transition focus:border-[#007cbd]"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Loyer mensuel HT
                </label>
                <input
                  value={monthlyRentHt}
                  onChange={(event) => setMonthlyRentHt(event.target.value)}
                  placeholder="2500"
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none transition focus:border-[#007cbd]"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Charges mensuelles HT
                </label>
                <input
                  value={monthlyChargesHt}
                  onChange={(event) => setMonthlyChargesHt(event.target.value)}
                  placeholder="350"
                  className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-800 outline-none transition focus:border-[#007cbd]"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Plans
                </label>
                <input
                  ref={plansInputRef}
                  type="file"
                  multiple
                  accept="application/pdf,image/*"
                  className="mt-1 block w-full text-[12px] text-slate-600"
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setPlans(Array.from(event.target.files ?? []))
                  }
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  Photos
                </label>
                <input
                  ref={photosInputRef}
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  className="mt-1 block w-full text-[12px] text-slate-600"
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setPhotos(Array.from(event.target.files ?? []))
                  }
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setStreet("");
                  setZipcode("");
                  setCity("");
                  setMonthlyRentHt("");
                  setMonthlyChargesHt("");
                  setPlans([]);
                  setPhotos([]);
                }}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 transition hover:border-slate-300"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => void handleCreateProject()}
                disabled={saving}
                className="inline-flex items-center justify-center rounded-full bg-[#007cbd] px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-[#00679f] disabled:opacity-60"
              >
                {saving ? "Enregistrement..." : "Créer le projet"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        {projects.length ? (
          projects.map((project) => (
            <div
              key={project.id}
              className={`rounded-2xl px-3.5 py-3 ${
                project.status === "VALIDATED"
                  ? "border border-emerald-300 bg-emerald-50"
                  : "border border-slate-200 bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                  <span
                    className={`text-sm ${
                      project.status === "VALIDATED" ? "text-emerald-600" : "text-slate-300"
                    }`}
                  >
                    {project.status === "VALIDATED" ? "✓" : "○"}
                  </span>
                  <p className="text-[12px] font-semibold text-slate-950">{formatProjectAddress(project)}</p>
                </div>
              </div>
              <p className="mt-0.5 text-[10px] text-slate-500">
                Loyer HT : {project.monthlyRentHt || "—"}€ Charges HT : {project.monthlyChargesHt || "—"}€
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500">
                {project.files.length ? `${project.files.length} fichier(s)` : "Aucun fichier joint pour le moment"}
              </p>
              {project.files.length ? (
                <div className="mt-2 space-y-1">
                  {project.files.map((file) => (
                    <a
                      key={file.id}
                      href={file.href}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-[10px] text-slate-500 transition hover:text-[#007cbd]"
                    >
                      {file.fileName}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <p className="text-[12px] text-slate-400">Aucun projet de local enregistré pour le moment.</p>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            setCreating((current) => !current);
            setError(null);
            setMessage(null);
          }}
          className="inline-flex items-center justify-center rounded-full bg-[#007cbd] px-3.5 py-2 text-[11px] font-medium text-white transition hover:bg-[#00679f]"
        >
          + Nouveau projet
        </button>
      </div>
    </Card>
  );
}
