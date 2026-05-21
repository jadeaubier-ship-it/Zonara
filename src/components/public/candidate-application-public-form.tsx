"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

type Props = {
  token: string;
  candidateName: string;
  initialValues: Record<string, string>;
  brandLogoDataUrl?: string;
  brandName?: string;
  previewMode?: boolean;
  hasPhoto?: boolean;
  hasCv?: boolean;
};

export function CandidateApplicationPublicForm({
  token,
  candidateName,
  initialValues,
  brandLogoDataUrl,
  brandName,
  previewMode = false,
  hasPhoto = false,
  hasCv = false
}: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [bookingUrl, setBookingUrl] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState("");
  const [cvName, setCvName] = useState("");
  const [photoAlreadyPresent, setPhotoAlreadyPresent] = useState(hasPhoto);
  const [cvAlreadyPresent, setCvAlreadyPresent] = useState(hasCv);
  const [entrepreneurshipExperienceText, setEntrepreneurshipExperienceText] = useState(initialValues.entrepreneurshipExperience);
  const [hasEntrepreneurshipExperience, setHasEntrepreneurshipExperience] = useState(
    initialValues.entrepreneurshipExperience.trim().length > 0 && initialValues.entrepreneurshipExperience.trim().toLowerCase() !== "non"
  );

  useEffect(() => {
    if (!success || !bookingUrl || previewMode) {
      return;
    }

    const timeout = window.setTimeout(() => {
      window.location.href = bookingUrl;
    }, 2200);

    return () => window.clearTimeout(timeout);
  }, [success, bookingUrl, previewMode]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>, type: "photo" | "cv") {
    const file = event.target.files?.[0];

    if (!file) {
      if (type === "photo") {
        setPhotoName("");
      } else {
        setCvName("");
      }
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setMessage(`Le fichier ${file.name} dépasse ${MAX_FILE_SIZE_MB} Mo.`);
      setSuccess(false);
      event.target.value = "";
      if (type === "photo") {
        setPhotoName("");
      } else {
        setCvName("");
      }
      return;
    }

    setMessage("");
    if (type === "photo") {
      setPhotoName(file.name);
      setPhotoAlreadyPresent(true);
    } else {
      setCvName(file.name);
      setCvAlreadyPresent(true);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (previewMode) {
      setSuccess(true);
      setMessage("Aperçu du dossier candidat : les informations sont modifiables dans la version réelle envoyée au candidat.");
      return;
    }

    const form = event.currentTarget;
    if (!form.reportValidity()) {
      setSuccess(false);
      setMessage("Merci de remplir tous les champs obligatoires.");
      return;
    }

    const formData = new FormData(form);
    const photo = formData.get("photo");
    const cv = formData.get("cv");
    const hasPhotoForValidation = photoAlreadyPresent || (photo instanceof File && photo.size > 0);
    const hasCvForValidation = cvAlreadyPresent || (cv instanceof File && cv.size > 0);

    if (!hasPhotoForValidation || !hasCvForValidation) {
      setSuccess(false);
      setMessage("La photo et le CV sont obligatoires pour valider le dossier.");
      return;
    }

    setIsSaving(true);
    setMessage("");
    setSuccess(false);
    setBookingUrl(null);

    try {
      const response = await fetch(`/api/public/application/${token}`, {
        method: "POST",
        body: formData
      });

      const data = (await response.json().catch(() => null)) as { error?: string; advancedToVisio?: boolean; bookingUrl?: string | null } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Impossible d'enregistrer le dossier.");
      }

      setSuccess(true);
      setMessage(
        "Merci, votre dossier est complet. Vous allez être redirigé vers la réservation de votre visio. Au cas où, on vous a aussi envoyé un mail avec le lien de réservation de la visio."
      );
      setBookingUrl(data?.bookingUrl ?? null);
      setPhotoAlreadyPresent(true);
      setCvAlreadyPresent(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible d'enregistrer le dossier.");
      setSuccess(false);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-white px-5 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="border-b border-slate-200 pb-5">
          <div className="flex justify-center">
            {brandLogoDataUrl ? (
              <img
                src={brandLogoDataUrl}
                alt={brandName || "Enseigne"}
                className="h-auto max-h-10 w-auto max-w-[164px] object-contain"
              />
            ) : (
              <Image src="/atome3d-logo.svg" alt={brandName || "Atome3D"} width={164} height={24} className="h-auto w-[164px]" priority />
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 py-6">
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-950">Coordonnées</h2>
            <div className="space-y-3">
              <PublicField label="Prénom" name="firstname" defaultValue={initialValues.firstname} required />
              <PublicField label="Nom" name="lastname" defaultValue={initialValues.lastname} required />
              <PublicField label="Email" name="email" defaultValue={initialValues.email} required type="email" />
              <PublicField label="Téléphone" name="phone" defaultValue={initialValues.phone} required />
              <PublicField label="Date de naissance" name="birthDate" defaultValue={initialValues.birthDate} required type="date" />
              <PublicField label="Lieu de naissance" name="birthPlace" defaultValue={initialValues.birthPlace} />
              <PublicField label="Adresse" name="address" defaultValue={initialValues.address} required />
              <PublicField label="Ville" name="city" defaultValue={initialValues.city} required />
              <PublicField label="Code postal" name="zipcode" defaultValue={initialValues.zipcode} required />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-950">Situation personnelle</h2>
            <div className="space-y-3">
              <PublicField label="Situation familiale" name="familySituation" defaultValue={initialValues.familySituation} required />
              <PublicField label="Nombre d'enfants" name="childrenCount" defaultValue={initialValues.childrenCount} required />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-950">Projet de franchise</h2>
            <div className="space-y-3">
              <PublicField label="Profession actuelle" name="profession" defaultValue={initialValues.profession} required />
              <PublicField label="Situation professionnelle" name="professionalSituation" defaultValue={initialValues.professionalSituation} required />
              <PublicField
                label="Ville d'implantation du projet"
                name="projectZone"
                defaultValue={initialValues.projectZone}
                required
              />
              <PublicField
                label="Code postal d'implantation du projet"
                name="projectZipcode"
                defaultValue={initialValues.projectZipcode}
                required
              />
              <PublicField label="Délai du projet" name="projectDelay" defaultValue={initialValues.projectDelay} required />
              <PublicField label="Apport personnel" name="personalContribution" defaultValue={initialValues.personalContribution} required />
              <label>
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Expérience entrepreneuriale
                  <RequiredMark />
                </span>
                <select
                  value={hasEntrepreneurshipExperience ? "oui" : "non"}
                  onChange={(event) => {
                    const nextValue = event.target.value === "oui";
                    setHasEntrepreneurshipExperience(nextValue);
                    if (!nextValue) {
                      setEntrepreneurshipExperienceText("non");
                    } else if (entrepreneurshipExperienceText.trim().toLowerCase() === "non") {
                      setEntrepreneurshipExperienceText("");
                    }
                  }}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] text-slate-900 outline-none transition focus:border-[#007cbd] focus:ring-2 focus:ring-[#007cbd]/15"
                >
                  <option value="non">Non</option>
                  <option value="oui">Oui</option>
                </select>
              </label>
              {hasEntrepreneurshipExperience ? (
                <PublicTextArea
                  label="Racontez-nous"
                  name="entrepreneurshipExperience"
                  value={entrepreneurshipExperienceText}
                  onChange={(event) => setEntrepreneurshipExperienceText(event.target.value)}
                  rows={4}
                  required
                />
              ) : (
                <input type="hidden" name="entrepreneurshipExperience" value="non" readOnly />
              )}
              <PublicTextArea label="Motivation" name="motivation" defaultValue={initialValues.motivation} rows={5} required />
              <PublicTextArea label="Notes complémentaires" name="notes" defaultValue={initialValues.notes} rows={5} />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-bold text-slate-950">Pièces à joindre</h2>
            <div className="space-y-3">
              <PublicUploadField
                label="Photo"
                name="photo"
                filename={photoName}
                helper={photoAlreadyPresent ? "Une photo est déjà enregistrée" : "Ajoutez votre photo de profil"}
                required={!photoAlreadyPresent}
                alreadyPresent={photoAlreadyPresent}
                onChange={(event) => handleFileChange(event, "photo")}
              />
              <PublicUploadField
                label="CV"
                name="cv"
                filename={cvName}
                helper={cvAlreadyPresent ? "Un CV est déjà enregistré" : "Ajoutez votre CV"}
                required={!cvAlreadyPresent}
                alreadyPresent={cvAlreadyPresent}
                onChange={(event) => handleFileChange(event, "cv")}
              />
              <p className="text-xs leading-5 text-slate-500">Taille maximale par fichier : {MAX_FILE_SIZE_MB} Mo. Formats recommandés : PDF, JPG, PNG.</p>
            </div>
          </section>

          <div className="sticky bottom-0 flex items-center justify-between gap-4 border-t border-slate-200 bg-white py-4">
            <div className="min-h-[20px] text-[13px]">
              {message ? <p className={success ? "text-emerald-600" : "text-rose-600"}>{message}</p> : null}
            </div>
            <div className="flex items-center gap-3">
              {bookingUrl ? (
                <a
                  href={bookingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-black bg-white px-5 text-[13px] font-semibold text-black transition hover:bg-black hover:text-white"
                >
                  Réserver ma visio
                </a>
              ) : null}
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#007cbd] px-6 text-[13px] font-semibold text-white transition hover:bg-[#006ba3] disabled:opacity-50"
              >
                {previewMode ? "Aperçu du bouton Enregistrer" : isSaving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </form>
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
  defaultValue = "",
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

function PublicUploadField({
  label,
  name,
  helper,
  filename,
  alreadyPresent,
  required,
  onChange
}: {
  label: string;
  name: string;
  helper: string;
  filename: string;
  alreadyPresent: boolean;
  required: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <label>
      <span className="mb-1 block text-[13px] font-medium text-slate-700">
        {label}
        <RequiredMark />
      </span>
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-3.5 py-3">
        <input name={name} type="file" required={required} onChange={onChange} className="block w-full text-[13px] text-slate-700" />
        <p className="mt-2 text-[11px] text-slate-500">{filename || helper}</p>
        {alreadyPresent ? <p className="mt-1 text-[11px] font-medium text-emerald-600">Document déjà présent</p> : null}
      </div>
    </label>
  );
}
