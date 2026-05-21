"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { formatPhoneNumber } from "@/lib/utils/formatters";

async function fileToDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Lecture de l'image impossible."));
      }
    };
    reader.onerror = () => reject(new Error("Lecture de l'image impossible."));
    reader.readAsDataURL(file);
  });
}

async function compressImage(file: File, maxSize = 320) {
  const dataUrl = await fileToDataUrl(file);

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const nextImage = new window.Image();
    nextImage.onload = () => resolve(nextImage);
    nextImage.onerror = () => reject(new Error("Chargement de l'image impossible."));
    nextImage.src = dataUrl;
  });

  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Préparation de l'image impossible.");
  }

  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.84);
}

function formatEditablePhone(phone: string) {
  const cleaned = phone.replace(/[^\d+]/g, "");
  if (!cleaned) return "";
  if (cleaned.startsWith("+")) {
    const country = cleaned.slice(0, 3);
    const rest = cleaned.slice(3).replace(/(\d{2})(?=\d)/g, "$1 ").trim();
    return `${country} ${rest}`.trim();
  }
  return cleaned.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}

export function CandidatePortalProfileForm({
  token,
  initialFirstname,
  initialLastname,
  initialEmail,
  initialPhone,
  initialPhotoDataUrl
}: {
  token: string;
  initialFirstname: string;
  initialLastname: string;
  initialEmail: string;
  initialPhone: string;
  initialPhotoDataUrl: string;
}) {
  const [firstname, setFirstname] = useState(initialFirstname);
  const [lastname, setLastname] = useState(initialLastname);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [photoDataUrl, setPhotoDataUrl] = useState(initialPhotoDataUrl);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);

    try {
      const compressed = await compressImage(file, 320);
      setPhotoDataUrl(compressed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de préparer la photo.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setIsSaving(true);

    try {
      const response = await fetch(`/api/public/candidate-space/${token}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstname,
          lastname,
          email,
          phone,
          photoDataUrl
        })
      });

      const data = (await response.json().catch(() => null)) as
        | {
            firstname?: string;
            lastname?: string;
            email?: string;
            phone?: string;
            photoDataUrl?: string;
            error?: string;
          }
        | null;

      if (!response.ok || !data?.email || !data?.firstname || !data?.lastname) {
        throw new Error(data?.error ?? "Impossible d'enregistrer votre profil.");
      }

      setFirstname(data.firstname);
      setLastname(data.lastname);
      setEmail(data.email);
      setPhone(data.phone ?? "");
      setPhotoDataUrl(data.photoDataUrl ?? "");
      setMessage("Votre profil a bien été enregistré.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer votre profil.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form id="profil" onSubmit={handleSubmit} className="space-y-5 scroll-mt-20">
      <div className="flex items-start gap-4">
        <label className="flex h-24 w-24 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 transition hover:border-slate-300">
          {photoDataUrl ? (
            <img src={photoDataUrl} alt={`${firstname} ${lastname}`} className="h-full w-full object-cover" />
          ) : (
            <span className="text-[10px] text-slate-400">Ajouter une photo</span>
          )}
          <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        </label>

        <div className="space-y-1 text-[12px] text-slate-500">
          <p className="text-[16px] font-semibold uppercase tracking-[0.14em] text-slate-950">
            {firstname} {lastname}
          </p>
          <p>{email}</p>
          <p>{phone ? formatPhoneNumber(phone) : "Téléphone non renseigné"}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Prénom</span>
          <input
            value={firstname}
            onChange={(event) => setFirstname(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#007cbd]"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Nom</span>
          <input
            value={lastname}
            onChange={(event) => setLastname(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#007cbd]"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Mail</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#007cbd]"
          />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Téléphone</span>
          <input
            value={phone}
            onChange={(event) => setPhone(formatEditablePhone(event.target.value))}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#007cbd]"
          />
        </label>
      </div>

      <div className="flex items-center justify-between gap-4">
        <div className="text-sm">
          {error ? <p className="text-rose-600">{error}</p> : null}
          {!error && message ? <p className="text-emerald-600">{message}</p> : null}
        </div>
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center justify-center rounded-2xl bg-[#007cbd] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#00679d] disabled:opacity-60"
        >
          {isSaving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
