"use client";

import { ChangeEvent, useEffect, useState } from "react";

type EmailAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  uploadedAt: string;
  fileUrl?: string;
};

type EmailTemplatePayload = {
  slug: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  isActive: boolean;
  brandName: string;
  signaturePreview: string;
  signatureProfile: {
    firstname: string;
    lastname: string;
    professionalEmail: string;
    professionalPhone: string;
    professionalRole: string;
    photoDataUrl: string;
  };
  attachments: EmailAttachment[];
};

export function ApplicationInvitationModal({
  templateSlug = "candidate-application-invitation",
  title = "Dossier de candidature",
  onClose,
  onConfirm
}: {
  templateSlug?: string;
  title?: string;
  onClose: () => void;
  onConfirm: (params: {
    sendEmail: boolean;
    subject?: string;
    bodyText?: string;
    attachments?: Array<{
      fileName: string;
      mimeType: string;
      fileUrl: string;
    }>;
  }) => Promise<void>;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [template, setTemplate] = useState<EmailTemplatePayload | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTemplate() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/admin/email-templates/${templateSlug}`);
        if (!response.ok) {
          throw new Error("Impossible de charger le mail.");
        }
        const data = (await response.json()) as EmailTemplatePayload;
        if (!cancelled) {
          setTemplate(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Impossible de charger le mail.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadTemplate();
    return () => {
      cancelled = true;
    };
  }, [templateSlug]);

  async function handleUploadAttachment(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const fileUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") {
            resolve(reader.result);
          } else {
            reject(new Error("Impossible de lire la pièce jointe."));
          }
        };
        reader.onerror = () => reject(new Error("Impossible de lire la pièce jointe."));
        reader.readAsDataURL(file);
      });

      setTemplate((current) =>
        current
          ? {
              ...current,
              attachments: [
                ...current.attachments,
                {
                  id: `local-${crypto.randomUUID()}`,
                  fileName: file.name,
                  mimeType: file.type,
                  uploadedAt: new Date().toISOString(),
                  fileUrl
                }
              ]
            }
          : current
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'ajouter la pièce jointe.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteAttachment(attachmentId: string) {
    const confirmed = window.confirm("Supprimer cette pièce jointe ?");
    if (!confirmed) return;

    setTemplate((current) =>
      current
        ? {
            ...current,
            attachments: current.attachments.filter((attachment) => attachment.id !== attachmentId)
          }
        : current
    );
  }

  async function handleContinue(sendEmail: boolean) {
    setSaving(true);
    setError(null);
    try {
      await onConfirm({
        sendEmail,
        subject: template?.subject,
        bodyText: template?.bodyText,
        attachments: template?.attachments.map((attachment) => ({
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          fileUrl: attachment.fileUrl || ""
        }))
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de poursuivre.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/45 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#007cbd]">Validation de mail</p>
            <h2 className="text-xl font-semibold text-slate-950">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-500 transition hover:bg-slate-200 hover:text-slate-900"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="px-6 py-8 text-sm text-slate-500">Chargement du modèle…</div>
        ) : template ? (
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="text-[13px] font-medium text-slate-700">Objet du mail</span>
                <input
                  value={template.subject}
                  onChange={(event) =>
                    setTemplate((current) => (current ? { ...current, subject: event.target.value } : current))
                  }
                  className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-[13px] text-slate-900 outline-none transition focus:border-[#007cbd]"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-[13px] font-medium text-slate-700">Corps du mail</span>
                <textarea
                  value={template.bodyText}
                  onChange={(event) =>
                    setTemplate((current) => (current ? { ...current, bodyText: event.target.value } : current))
                  }
                  className="min-h-[180px] w-full rounded-2xl border border-slate-200 px-4 py-3 text-[13px] leading-5 text-slate-900 outline-none transition focus:border-[#007cbd]"
                />
              </label>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <label className="inline-flex cursor-pointer items-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 transition hover:border-slate-950 hover:text-slate-950">
                  {uploading ? "Ajout..." : "Ajouter une pièce jointe"}
                  <input type="file" className="hidden" onChange={handleUploadAttachment} />
                </label>

                <div className="mt-3 space-y-2">
                  {template.attachments.length ? (
                    template.attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-slate-900">{attachment.fileName}</p>
                          <p className="text-[11px] text-slate-500">{attachment.mimeType || "Fichier joint"}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void handleDeleteAttachment(attachment.id)}
                          className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-slate-500 transition hover:bg-slate-100 hover:text-rose-600"
                        >
                          Supprimer
                        </button>
                      </div>
                    ))
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="px-6 py-10 text-sm text-rose-600">{error ?? "Template introuvable."}</div>
        )}

        <div className="flex items-end justify-between gap-4 border-t border-slate-200 px-6 py-4">
          <p className={`text-sm ${error ? "text-rose-600" : "text-slate-500"}`}>{error ?? ""}</p>
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => void handleContinue(true)}
              disabled={saving || !template}
              className="min-w-[170px] rounded-2xl bg-[#007cbd] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#00679d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Envoi..." : "Envoyer"}
            </button>
            <button
              type="button"
              onClick={() => void handleContinue(false)}
              disabled={saving || !template}
              className="text-[12px] font-medium text-slate-500 underline underline-offset-4 transition hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Ne pas envoyer d'email
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
