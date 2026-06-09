"use client";

import { ChangeEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WorkflowBoard } from "@/components/admin/workflow-board";
import { formatPhoneNumber } from "@/lib/utils/formatters";

type UserProfile = {
  firstname: string;
  lastname: string;
  professionalEmail: string;
  professionalPhone: string;
  professionalRole: string;
  photoDataUrl: string;
};

type WorkflowSection = {
  title: string;
  items: Array<{
    label: string;
    done: boolean;
    templateSlug?: string;
    previewHref?: string;
  }>;
};

type Props = {
  initialBrandName: string;
  initialSenderEmail: string;
  initialBrandLogoDataUrl: string;
  initialSuperAdminUserId: string;
  initialSuperAdminName: string;
  initialSuperAdminEmail: string;
  initialMappingManagerFirstname: string;
  initialMappingManagerLastname: string;
  initialMappingManagerEmail: string;
  initialMappingManagerPhone: string;
  initialMappingPortalToken: string;
  initialUserProfile?: UserProfile;
  currentUserId: string;
  initialGoogleCalendar: {
    configured: boolean;
    connected: boolean;
    calendarEmail: string;
    status?: string;
    detail?: string;
  };
  workflowSections: WorkflowSection[];
};

const EMPTY_PROFILE: UserProfile = {
  firstname: "",
  lastname: "",
  professionalEmail: "",
  professionalPhone: "",
  professionalRole: "",
  photoDataUrl: ""
};

function formatEditablePhone(phone: string) {
  const cleaned = phone.replace(/[^\d+]/g, "");

  if (!cleaned) {
    return "";
  }

  if (cleaned.startsWith("+")) {
    const country = cleaned.slice(0, 3);
    const rest = cleaned.slice(3).replace(/(\d{2})(?=\d)/g, "$1 ").trim();
    return `${country} ${rest}`.trim();
  }

  return cleaned.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
}

export function SettingsPanel({
  initialBrandName,
  initialSenderEmail,
  initialBrandLogoDataUrl,
  initialSuperAdminUserId,
  initialSuperAdminName,
  initialSuperAdminEmail,
  initialMappingManagerFirstname,
  initialMappingManagerLastname,
  initialMappingManagerEmail,
  initialMappingManagerPhone,
  initialMappingPortalToken,
  initialUserProfile,
  currentUserId,
  initialGoogleCalendar,
  workflowSections
}: Props) {
  const router = useRouter();
  const safeInitialProfile = initialUserProfile ?? EMPTY_PROFILE;
  const initialSnapshot = useMemo(
    () => ({
      brandName: initialBrandName,
      senderEmail: initialSenderEmail,
      brandLogoDataUrl: initialBrandLogoDataUrl,
      superAdminName: initialSuperAdminName,
      superAdminEmail: initialSuperAdminEmail,
      mappingManagerFirstname: initialMappingManagerFirstname,
      mappingManagerLastname: initialMappingManagerLastname,
      mappingManagerEmail: initialMappingManagerEmail,
      mappingManagerPhone: initialMappingManagerPhone,
      profile: safeInitialProfile
    }),
    [
      initialBrandName,
      initialSenderEmail,
      initialBrandLogoDataUrl,
      initialSuperAdminName,
      initialSuperAdminEmail,
      initialMappingManagerFirstname,
      initialMappingManagerLastname,
      initialMappingManagerEmail,
      initialMappingManagerPhone,
      safeInitialProfile
    ]
  );
  const [brandName, setBrandName] = useState(initialBrandName);
  const [senderEmail, setSenderEmail] = useState(initialSenderEmail);
  const [brandLogoDataUrl, setBrandLogoDataUrl] = useState(initialBrandLogoDataUrl);
  const [superAdminName, setSuperAdminName] = useState(initialSuperAdminName);
  const [superAdminEmail, setSuperAdminEmail] = useState(initialSuperAdminEmail);
  const [mappingManagerFirstname, setMappingManagerFirstname] = useState(initialMappingManagerFirstname);
  const [mappingManagerLastname, setMappingManagerLastname] = useState(initialMappingManagerLastname);
  const [mappingManagerEmail, setMappingManagerEmail] = useState(initialMappingManagerEmail);
  const [mappingManagerPhone, setMappingManagerPhone] = useState(initialMappingManagerPhone);
  const [profile, setProfile] = useState<UserProfile>(safeInitialProfile);
  const [newPassword, setNewPassword] = useState("");
  const [savedSnapshot, setSavedSnapshot] = useState(initialSnapshot);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profilePhotoModalOpen, setProfilePhotoModalOpen] = useState(false);
  const [brandLogoModalOpen, setBrandLogoModalOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [brandEditorOpen, setBrandEditorOpen] = useState(false);
  const [mappingEditorOpen, setMappingEditorOpen] = useState(false);
  const isSuperAdmin = currentUserId === initialSuperAdminUserId;

  async function compressImage(file: File, maxSize = 220) {
    const dataUrl = await new Promise<string>((resolve, reject) => {
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
    return canvas.toDataURL("image/jpeg", 0.82);
  }

  async function persistSettings() {
    setIsSaving(true);
    setError(null);
    setMessage(null);

    const profileChanged =
      JSON.stringify(profile) !== JSON.stringify(savedSnapshot.profile) || Boolean(newPassword.trim());

    const payload: {
      brandName: string;
      senderEmail: string;
      brandLogoDataUrl: string;
      superAdminName: string;
      superAdminEmail: string;
      mappingManagerFirstname: string;
      mappingManagerLastname: string;
      mappingManagerEmail: string;
      mappingManagerPhone: string;
      currentUserProfile?: UserProfile & { newPassword?: string };
    } = {
      brandName,
      senderEmail,
      brandLogoDataUrl,
      superAdminName,
      superAdminEmail,
      mappingManagerFirstname,
      mappingManagerLastname,
      mappingManagerEmail,
      mappingManagerPhone
    };

    if (profileChanged) {
      payload.currentUserProfile = {
        ...profile,
        newPassword
      };
    }

    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = (await response.json().catch(() => null)) as
        | {
            brandName?: string;
            senderEmail?: string;
            brandLogoDataUrl?: string;
            superAdminUserId?: string;
            superAdminName?: string;
            superAdminEmail?: string;
            mappingManagerFirstname?: string;
            mappingManagerLastname?: string;
            mappingManagerEmail?: string;
            mappingManagerPhone?: string;
            currentUserProfile?: UserProfile;
            error?: string;
          }
        | null;

      if (!response.ok || !data?.brandName || !data?.senderEmail || !data?.currentUserProfile) {
        throw new Error(data?.error ?? "Impossible d'enregistrer les paramètres.");
      }

      setBrandName(data.brandName);
      setSenderEmail(data.senderEmail);
      setBrandLogoDataUrl(data.brandLogoDataUrl ?? "");
      setSuperAdminName(data.superAdminName ?? "");
      setSuperAdminEmail(data.superAdminEmail ?? "");
      setMappingManagerFirstname(data.mappingManagerFirstname ?? "");
      setMappingManagerLastname(data.mappingManagerLastname ?? "");
      setMappingManagerEmail(data.mappingManagerEmail ?? "");
      setMappingManagerPhone(data.mappingManagerPhone ?? "");
      setProfile(data.currentUserProfile);
      setNewPassword("");
      setSavedSnapshot({
        brandName: data.brandName,
        senderEmail: data.senderEmail,
        brandLogoDataUrl: data.brandLogoDataUrl ?? "",
        superAdminName: data.superAdminName ?? "",
        superAdminEmail: data.superAdminEmail ?? "",
        mappingManagerFirstname: data.mappingManagerFirstname ?? "",
        mappingManagerLastname: data.mappingManagerLastname ?? "",
        mappingManagerEmail: data.mappingManagerEmail ?? "",
        mappingManagerPhone: data.mappingManagerPhone ?? "",
        profile: data.currentUserProfile
      });
      setMessage("Modifications enregistrées.");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer les paramètres.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleProfilePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    try {
      const compressed = await compressImage(file, 220);
      setProfile((current) => ({ ...current, photoDataUrl: compressed }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de préparer la photo.");
    }
  }

  async function handleBrandLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    try {
      const compressed = await compressImage(file, 420);
      setBrandLogoDataUrl(compressed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de préparer le logo.");
    }
  }

  const profileDisplayName = useMemo(
    () => `${profile.firstname} ${profile.lastname}`.trim() || "Votre profil",
    [profile.firstname, profile.lastname]
  );
  const mappingManagerDisplayName = useMemo(
    () => `${mappingManagerFirstname} ${mappingManagerLastname}`.trim() || "Responsable mapping",
    [mappingManagerFirstname, mappingManagerLastname]
  );

  const isDirty =
    brandName !== savedSnapshot.brandName ||
    senderEmail !== savedSnapshot.senderEmail ||
    brandLogoDataUrl !== savedSnapshot.brandLogoDataUrl ||
    superAdminName !== savedSnapshot.superAdminName ||
    superAdminEmail !== savedSnapshot.superAdminEmail ||
    mappingManagerFirstname !== savedSnapshot.mappingManagerFirstname ||
    mappingManagerLastname !== savedSnapshot.mappingManagerLastname ||
    mappingManagerEmail !== savedSnapshot.mappingManagerEmail ||
    mappingManagerPhone !== savedSnapshot.mappingManagerPhone ||
    JSON.stringify(profile) !== JSON.stringify(savedSnapshot.profile) ||
    Boolean(newPassword.trim());

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#007cbd]">Paramètres</p>
          <h1 className="text-2xl font-semibold text-slate-950">Pilotage de l’enseigne</h1>
          <div className="text-sm">
            {error ? <p className="text-rose-600">{error}</p> : null}
            {!error && (isSaving || message) ? <p className={isSaving ? "text-slate-500" : "text-emerald-600"}>{isSaving ? "Enregistrement..." : message}</p> : null}
          </div>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-950">Votre profil</h2>
        </div>

        <div className="flex flex-col gap-5 lg:flex-row">
          <div className="flex w-full max-w-[11rem] flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => setProfilePhotoModalOpen(true)}
              className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 transition hover:border-slate-400"
              aria-label="Ouvrir la photo du profil"
            >
              {profile.photoDataUrl ? (
                <img src={profile.photoDataUrl} alt="Photo de profil" className="h-full w-full object-cover" />
              ) : (
                <span className="px-4 text-center text-xs text-slate-400">Ajouter une photo</span>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setProfileEditorOpen(true)}
            className="flex-1 rounded-3xl border border-slate-200 bg-slate-50/60 p-5 text-left transition hover:border-slate-300"
          >
            <div className="space-y-1">
              <p className="text-lg font-semibold uppercase tracking-[0.14em] text-slate-950">{profileDisplayName}</p>
              <p className="text-sm italic text-slate-500">{profile.professionalRole || "Rôle"}</p>
              <p className="text-sm text-[#007cbd]">{profile.professionalEmail || "mail@entreprise.com"}</p>
              <p className="text-sm text-slate-500">••••••••••</p>
              <p className="text-sm text-slate-600">
                {profile.professionalPhone ? formatPhoneNumber(profile.professionalPhone) : "Téléphone professionnel"}
              </p>
            </div>
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-950">Enseigne</h2>
        </div>

        <div className="flex flex-col gap-5 lg:flex-row">
          <div className="flex w-full max-w-[11rem] flex-col items-center gap-3">
            <button
              type="button"
              onClick={() => setBrandLogoModalOpen(true)}
              className="flex h-36 w-36 items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 transition hover:border-slate-400"
              aria-label="Ouvrir le logo de l’enseigne"
            >
              {brandLogoDataUrl ? (
                <img src={brandLogoDataUrl} alt="Logo enseigne" className="h-full w-full object-contain bg-white p-3" />
              ) : (
                <span className="px-4 text-center text-xs text-slate-400">Télécharger le logo</span>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              if (isSuperAdmin) setBrandEditorOpen(true);
            }}
            className={`flex-1 rounded-3xl border border-slate-200 bg-slate-50/60 p-5 text-left transition ${isSuperAdmin ? "hover:border-slate-300" : "cursor-not-allowed opacity-85"}`}
          >
            <p className="text-lg font-semibold uppercase tracking-[0.14em] text-slate-950">{brandName || "Enseigne"}</p>
            <p className="mt-2 text-sm text-[#007cbd]">{senderEmail || "Adresse d’envoi générique"}</p>
            <p className="mt-2 text-sm text-slate-600">
              Super admin : {superAdminName || "Non renseigné"}
              <br />
              {superAdminEmail || "Mail du super admin"}
            </p>
            {!isSuperAdmin ? <p className="mt-3 text-xs text-slate-400">Modifiable uniquement par le super admin.</p> : null}
          </button>
        </div>

        <div className="mt-5 rounded-3xl border border-slate-200 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold text-slate-950">Google Calendar</h3>
              <p className="text-sm text-slate-500">
                {initialGoogleCalendar.connected
                  ? `Connecté à ${initialGoogleCalendar.calendarEmail}`
                  : `Connectez ${senderEmail || initialGoogleCalendar.calendarEmail} pour lire les réservations.`}
              </p>
            </div>

            <a
              href="/api/google/connect"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-900 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
            >
              {initialGoogleCalendar.connected ? "Reconnecter Google Calendar" : "Connecter Google Calendar"}
            </a>
          </div>
          {renderGoogleCalendarMessage(initialGoogleCalendar)}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-soft">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-950">Responsable mapping</h2>
        </div>

        <button
          type="button"
          onClick={() => setMappingEditorOpen(true)}
          className="w-full rounded-3xl border border-slate-200 bg-slate-50/60 p-5 text-left transition hover:border-slate-300"
        >
          <p className="text-lg font-semibold uppercase tracking-[0.14em] text-slate-950">{mappingManagerDisplayName}</p>
          <p className="mt-2 text-sm text-[#007cbd]">{mappingManagerEmail || "mail@entreprise.com"}</p>
          <p className="mt-1 text-sm text-slate-600">
            {mappingManagerPhone ? formatPhoneNumber(mappingManagerPhone) : "Téléphone du responsable mapping"}
          </p>
        </button>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-500">Portail mapping</p>
          <a href={`/mapping/${initialMappingPortalToken}`} target="_blank" rel="noreferrer" className="mt-1 block text-sm text-[#007cbd] underline underline-offset-4">
            Ouvrir le portail mapping sécurisé
          </a>
        </div>
      </section>

      <WorkflowBoard sections={workflowSections.map((section) => ({ ...section, items: [...section.items] }))} />

      <div className="flex items-center justify-between gap-4">
        <Link
          href="/admin/candidates/archived"
          className="inline-flex items-center justify-center rounded-2xl border border-slate-900 bg-white px-5 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
        >
          Voir les candidats archivés
        </Link>
        {isDirty ? (
          <button
            type="button"
            onClick={async () => {
              const saved = await persistSettings();
              if (saved) router.refresh();
            }}
            disabled={isSaving}
            className="inline-flex items-center justify-center rounded-2xl bg-[#007cbd] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#00679d] disabled:opacity-60"
          >
            {isSaving ? "Enregistrement..." : "Enregistrer"}
          </button>
        ) : null}
      </div>

      {profilePhotoModalOpen ? (
        <ImageModal
          title="Photo de profil"
          image={profile.photoDataUrl}
          emptyLabel="Aucune photo pour le moment"
          buttonLabel="Télécharger une autre photo"
          onClose={() => setProfilePhotoModalOpen(false)}
          onChange={handleProfilePhotoChange}
        />
      ) : null}

      {brandLogoModalOpen ? (
        <ImageModal
          title="Logo de l’enseigne"
          image={brandLogoDataUrl}
          emptyLabel="Aucun logo pour le moment"
          buttonLabel="Télécharger un autre logo"
          contain
          onClose={() => setBrandLogoModalOpen(false)}
          onChange={handleBrandLogoChange}
        />
      ) : null}

      {profileEditorOpen ? (
        <EditModal title="Votre profil" onClose={() => setProfileEditorOpen(false)}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Prénom" value={profile.firstname} onChange={(value) => setProfile((current) => ({ ...current, firstname: value }))} />
              <Field label="Nom" value={profile.lastname} onChange={(value) => setProfile((current) => ({ ...current, lastname: value }))} />
            <Field
              label="Mail pro"
              value={profile.professionalEmail}
              onChange={(value) => setProfile((current) => ({ ...current, professionalEmail: value }))}
            />
            <Field
              label="Téléphone pro"
              value={profile.professionalPhone}
              onChange={(value) =>
                setProfile((current) => ({ ...current, professionalPhone: formatEditablePhone(value) }))
              }
            />
              <div className="md:col-span-2">
                <Field
                  label="Rôle"
                  value={profile.professionalRole}
                  onChange={(value) => setProfile((current) => ({ ...current, professionalRole: value }))}
                />
              </div>
              <div className="md:col-span-2">
                <PasswordField
                  label="Mot de passe"
                  value={newPassword}
                  onChange={setNewPassword}
                  placeholder="Laisser vide pour ne pas changer"
                />
              </div>
            </div>
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={async (event) => {
                event.preventDefault();
                event.stopPropagation();
                const saved = await persistSettings();
                if (saved) {
                  setProfileEditorOpen(false);
                }
              }}
              disabled={isSaving}
              className="inline-flex items-center justify-center rounded-2xl bg-[#007cbd] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#00679d] disabled:opacity-60"
            >
              {isSaving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </EditModal>
      ) : null}

      {brandEditorOpen ? (
        <EditModal title="Enseigne" onClose={() => setBrandEditorOpen(false)}>
            <div className="grid gap-4">
              <Field label="Nom de l’enseigne" value={brandName} onChange={setBrandName} />
              <Field
                label="Adresse générique / signature Atome3D"
                value={senderEmail}
                onChange={setSenderEmail}
              />
              <Field label="Nom du super admin" value={superAdminName} onChange={setSuperAdminName} />
              <Field label="Mail du super admin" value={superAdminEmail} onChange={setSuperAdminEmail} />
            </div>
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={async (event) => {
                event.preventDefault();
                event.stopPropagation();
                const saved = await persistSettings();
                if (saved) {
                  setBrandEditorOpen(false);
                  window.setTimeout(() => router.refresh(), 0);
                }
              }}
              disabled={isSaving}
              className="inline-flex items-center justify-center rounded-2xl bg-[#007cbd] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#00679d] disabled:opacity-60"
            >
              {isSaving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </EditModal>
      ) : null}

      {mappingEditorOpen ? (
        <EditModal title="Responsable mapping" onClose={() => setMappingEditorOpen(false)}>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Prénom" value={mappingManagerFirstname} onChange={setMappingManagerFirstname} />
            <Field label="Nom" value={mappingManagerLastname} onChange={setMappingManagerLastname} />
            <Field label="Mail" value={mappingManagerEmail} onChange={setMappingManagerEmail} />
            <Field
              label="Téléphone"
              value={mappingManagerPhone}
              onChange={(value) => setMappingManagerPhone(formatEditablePhone(value))}
            />
          </div>
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={async (event) => {
                event.preventDefault();
                event.stopPropagation();
                const saved = await persistSettings();
                if (saved) {
                  setMappingEditorOpen(false);
                }
              }}
              disabled={isSaving}
              className="inline-flex items-center justify-center rounded-2xl bg-[#007cbd] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#00679d] disabled:opacity-60"
            >
              {isSaving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
        </EditModal>
      ) : null}
    </div>
  );
}

function renderGoogleCalendarMessage(initialGoogleCalendar: Props["initialGoogleCalendar"]) {
  if (initialGoogleCalendar.status === "connected") {
    return <p className="mt-4 text-sm text-emerald-600">Google Calendar est maintenant connecté à {initialGoogleCalendar.calendarEmail}.</p>;
  }

  if (initialGoogleCalendar.status === "wrong-account") {
    return (
      <p className="mt-4 text-sm text-rose-600">
        Le mauvais compte Google a été connecté.
        {initialGoogleCalendar.detail ? ` Compte reçu : ${initialGoogleCalendar.detail}.` : ""}
      </p>
    );
  }

  if (
    initialGoogleCalendar.status === "failed" ||
    initialGoogleCalendar.status === "invalid-state" ||
    initialGoogleCalendar.status === "missing-refresh-token" ||
    initialGoogleCalendar.status === "missing-config" ||
    initialGoogleCalendar.status === "error"
  ) {
    return <p className="mt-4 text-sm text-rose-600">La connexion Google Calendar a échoué. {initialGoogleCalendar.detail ?? ""}</p>;
  }

  return null;
}

function Field({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#007cbd]"
      />
    </label>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type="password"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#007cbd]"
      />
    </label>
  );
}

function ImageModal({
  title,
  image,
  emptyLabel,
  buttonLabel,
  contain = false,
  onClose,
  onChange
}: {
  title: string;
  image: string;
  emptyLabel: string;
  buttonLabel: string;
  contain?: boolean;
  onClose: () => void;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/55 p-4" onClick={onClose}>
      <div className="relative w-full max-w-md rounded-[28px] bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
          aria-label={`Fermer ${title}`}
        >
          ×
        </button>

        <div className="flex flex-col items-center gap-4 pt-6">
          <div className="flex h-72 w-full items-center justify-center overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
            {image ? (
              <img src={image} alt={title} className={`h-full w-full ${contain ? "object-contain bg-white p-4" : "object-cover"}`} />
            ) : (
              <span className="px-4 text-center text-sm text-slate-400">{emptyLabel}</span>
            )}
          </div>

          <label className="inline-flex cursor-pointer items-center justify-center rounded-2xl border border-slate-900 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50">
            {buttonLabel}
            <input type="file" accept="image/*" className="hidden" onChange={onChange} />
          </label>
        </div>
      </div>
    </div>
  );
}

function EditModal({
  title,
  onClose,
  children
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-950/55 p-4" onClick={onClose}>
      <div className="relative w-full max-w-3xl rounded-[28px] bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
          aria-label={`Fermer ${title}`}
        >
          ×
        </button>
        <div className="space-y-5 pt-2">
          <h3 className="text-2xl font-semibold text-slate-950">{title}</h3>
          {children}
        </div>
      </div>
    </div>
  );
}
