"use client";

import { ChangeEvent, FormEvent, useState } from "react";

type DiscoveryFeedbackValues = {
  firstname: string;
  lastname: string;
  discoveryDate: string;
  discoveryFeedback: string;
  improvementPoints: string;
  continueJourney: string;
  stopReason: string;
};

export function DiscoveryFeedbackPublicForm({
  token,
  initialValues,
  brandLogoDataUrl,
  brandName,
  candidateSpaceUrl
}: {
  token: string;
  initialValues: DiscoveryFeedbackValues;
  brandLogoDataUrl?: string;
  brandName?: string;
  candidateSpaceUrl?: string;
}) {
  const [continueJourney, setContinueJourney] = useState(initialValues.continueJourney);
  const [stopReason, setStopReason] = useState(initialValues.stopReason);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    if (continueJourney !== "non") {
      formData.set("stopReason", "");
    }

    setIsSaving(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/public/discovery-feedback/${token}`, {
        method: "POST",
        body: formData
      });

      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? "Impossible d'enregistrer votre retour.");
      }

      setSuccess(true);
      setMessage("Votre réponse a bien été reçue. Pour la retrouver, rendez vous dans votre espace candidat.");
    } catch (error) {
      setSuccess(false);
      setMessage(error instanceof Error ? error.message : "Impossible d'enregistrer votre retour.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-white px-4 py-10">
      <div className="mx-auto w-full max-w-3xl rounded-[2rem] border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-200 px-6 py-5">
          {brandLogoDataUrl ? (
            <img src={brandLogoDataUrl} alt={brandName || "Enseigne"} className="h-9 w-auto object-contain" />
          ) : (
            <img src="/atome3d-logo.svg" alt={brandName || "Atome3D"} className="h-9 w-auto" />
          )}
        </div>
        {success ? (
          <div className="space-y-5 px-6 py-8">
            <p className="text-base font-medium text-slate-900">
              Votre réponse a bien été reçue. Pour la retrouver, rendez vous dans votre espace candidat.
            </p>
            {candidateSpaceUrl ? (
              <a
                href={candidateSpaceUrl}
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-900 bg-white px-6 text-[13px] font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                Aller à mon espace candidat
              </a>
            ) : null}
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-8 px-6 py-6">
          <section className="grid gap-4 md:grid-cols-2">
            <PublicField label="Prénom" name="firstname" defaultValue={initialValues.firstname} required />
            <PublicField label="Nom" name="lastname" defaultValue={initialValues.lastname} required />
            <div className="md:col-span-2">
              <PublicField label="Date de la journée découverte" name="discoveryDate" type="date" defaultValue={initialValues.discoveryDate} required />
            </div>
          </section>

          <section className="space-y-4">
            <PublicTextArea label="Qu'avez-vous pensé de cette Journée Découverte ?" name="discoveryFeedback" defaultValue={initialValues.discoveryFeedback} rows={5} required />
            <PublicTextArea label="Avez-vous identifié des points d'amélioration ?" name="improvementPoints" defaultValue={initialValues.improvementPoints} rows={5} required />
            <label className="block">
              <span className="mb-1 block text-[13px] font-medium text-slate-700">
                Souhaitez vous continuer le parcours de candidature ?<RequiredMark />
              </span>
              <select
                name="continueJourney"
                value={continueJourney}
                onChange={(event) => setContinueJourney(event.target.value)}
                required
                className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] text-slate-900 outline-none transition focus:border-[#007cbd] focus:ring-2 focus:ring-[#007cbd]/15"
              >
                <option value="">Choisir</option>
                <option value="oui">Oui</option>
                <option value="non">Non</option>
              </select>
            </label>

            {continueJourney === "non" ? (
              <PublicTextArea
                label="Pourquoi souhaitez vous arrêter le parcours de candidature ?"
                name="stopReason"
                value={stopReason}
                onChange={(event) => setStopReason(event.target.value)}
                defaultValue=""
                rows={4}
                required
              />
            ) : (
              <input type="hidden" name="stopReason" value="" readOnly />
            )}
          </section>

          <div className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-slate-200 bg-white py-4">
            <div className="min-h-[20px] text-[13px]">
              {message ? <p className={success ? "text-emerald-600" : "text-rose-600"}>{message}</p> : null}
            </div>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#007cbd] px-6 text-[13px] font-semibold text-white transition hover:bg-[#006ba3] disabled:opacity-50"
            >
              {isSaving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </form>
        )}
      </div>
    </main>
  );
}

function RequiredMark() {
  return <span className="ml-1 text-[13px] font-semibold text-rose-600">*</span>;
}

function PublicField({
  label,
  name,
  defaultValue,
  type = "text",
  required = false
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label>
      <span className="mb-1 block text-[13px] font-medium text-slate-700">
        {label}
        {required ? <RequiredMark /> : null}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] text-slate-900 outline-none transition focus:border-[#007cbd] focus:ring-2 focus:ring-[#007cbd]/15"
      />
    </label>
  );
}

function PublicTextArea({
  label,
  name,
  defaultValue,
  value,
  onChange,
  rows,
  required = false
}: {
  label: string;
  name: string;
  defaultValue?: string;
  value?: string;
  onChange?: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  rows: number;
  required?: boolean;
}) {
  return (
    <label>
      <span className="mb-1 block text-[13px] font-medium text-slate-700">
        {label}
        {required ? <RequiredMark /> : null}
      </span>
      <textarea
        name={name}
        defaultValue={value === undefined ? defaultValue : undefined}
        value={value}
        onChange={onChange}
        rows={rows}
        required={required}
        className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] text-slate-900 outline-none transition focus:border-[#007cbd] focus:ring-2 focus:ring-[#007cbd]/15"
      />
    </label>
  );
}
