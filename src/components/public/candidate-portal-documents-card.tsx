"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";

type CandidatePortalDocument = {
  key: string;
  label: string;
  visibleFromStep: number;
  requiredFromStep: number;
  candidateCanUpload: boolean;
  isRequiredNow: boolean;
  isVisibleNow: boolean;
  exists: boolean;
  href: string | null;
  fileName: string;
  badgeLabel?: string;
  secondaryLabel?: string;
  files: Array<{
    id: string;
    fileName: string;
    href: string;
    mimeType: string | null;
  }>;
};

function cloneDocuments(documents: CandidatePortalDocument[]) {
  return documents.map((document) => ({
    ...document,
    files: [...document.files]
  }));
}

const ALWAYS_COLLAPSED_KEYS = new Set([
  "contrat_reservation_zone",
  "plan_3d_local",
  "devis_menuisier",
  "devis_menuisier_signe"
]);

export function CandidatePortalDocumentsCard({
  token,
  currentStep,
  visibleDocumentStep,
  initialDocuments,
  hasValidatedLocalProject,
  hasSubmittedLocalProject
}: {
  token: string;
  currentStep: number;
  visibleDocumentStep: number;
  initialDocuments: CandidatePortalDocument[];
  hasValidatedLocalProject: boolean;
  hasSubmittedLocalProject: boolean;
}) {
  const [documents, setDocuments] = useState(() => cloneDocuments(initialDocuments));
  const [showFutureDocuments, setShowFutureDocuments] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const currentDocumentRows = useMemo(
    () =>
      documents.filter(
        (document) =>
          !ALWAYS_COLLAPSED_KEYS.has(document.key) &&
          (document.exists || document.visibleFromStep <= visibleDocumentStep)
      ),
    [documents, visibleDocumentStep]
  );

  const futureDocumentRows = useMemo(
    () =>
      documents.filter(
        (document) =>
          ALWAYS_COLLAPSED_KEYS.has(document.key) ||
          (!document.exists && document.visibleFromStep > visibleDocumentStep)
      ),
    [documents, visibleDocumentStep]
  );

  const shouldShowLocalPlaceholder = currentStep >= 6 && !hasValidatedLocalProject && !hasSubmittedLocalProject;
  const isLocalRequiredNow = currentStep >= 7;

  async function handleUpload(documentKey: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadingKey(documentKey);
    setError(null);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("type", documentKey);
      formData.append("file", file);

      const response = await fetch(`/api/public/candidate-space/${token}/documents`, {
        method: "POST",
        body: formData
      });

      const data = (await response.json().catch(() => null)) as
        | {
            error?: string;
            document?: {
              id: string;
              type: string;
              fileName: string;
              fileUrl: string;
              mimeType: string | null;
            };
          }
        | null;

      if (!response.ok || !data?.document) {
        throw new Error(data?.error ?? "Impossible de téléverser ce document.");
      }

      setDocuments((current) =>
        current.map((document) => {
          if (document.key !== documentKey) return document;

            const nextFiles =
              documentKey === "plans_local" || documentKey === "photos_local"
              ? [
                  {
                    ...data.document!,
                    href: `/api/public/candidate-space/${token}/documents/${data.document!.id}`
                  },
                  ...document.files
                ]
              : [
                  {
                    ...data.document!,
                    href: `/api/public/candidate-space/${token}/documents/${data.document!.id}`
                  }
                ];

          return {
            ...document,
            exists: true,
            href: nextFiles[0]?.href ?? null,
            fileName: nextFiles[0]?.fileName ?? "",
            files: nextFiles
          };
        })
      );

      setMessage("Document enregistré.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de téléverser ce document.");
    } finally {
      setUploadingKey(null);
    }
  }

  return (
    <Card className="space-y-3 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[16px] font-bold text-slate-950">Mes documents</h2>
        <button
          type="button"
          onClick={() => setShowFutureDocuments((current) => !current)}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
          aria-label={showFutureDocuments ? "Masquer les documents à venir" : "Afficher les documents à venir"}
        >
          <span className="text-base leading-none">{showFutureDocuments ? "⌃" : "⌄"}</span>
        </button>
      </div>

      {error ? <p className="text-[12px] text-rose-600">{error}</p> : null}
      {!error && message ? <p className="text-[12px] text-emerald-600">{message}</p> : null}

      <div className="space-y-1.5">
        {currentDocumentRows.map((document) => {
          const uploadAllowed =
            document.candidateCanUpload && currentStep >= document.visibleFromStep && !document.exists;
          const currentStatusLabel = document.isRequiredNow ? "Obligatoire" : "Facultatif";
          const isRequiredMissing = !document.exists && document.isRequiredNow;

          return (
            <div
              key={document.key}
              className={`rounded-2xl border px-3.5 py-2 text-[12px] ${
                document.exists
                  ? "border-emerald-200 bg-emerald-50"
                  : isRequiredMissing
                    ? "border-rose-200 bg-rose-50"
                    : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <span
                      className={
                        document.exists ? "text-emerald-600" : isRequiredMissing ? "text-rose-500" : "text-slate-300"
                      }
                    >
                      {document.exists ? "✓" : "○"}
                    </span>
                    <p
                      className={`font-medium ${
                        document.exists
                          ? "text-slate-950"
                          : isRequiredMissing
                            ? "font-semibold text-rose-600"
                            : "text-slate-600"
                      }`}
                    >
                      {document.label}
                    </p>
                    {document.badgeLabel ? (
                      <span className="text-[10px] font-semibold leading-tight text-rose-600">{document.badgeLabel}</span>
                    ) : null}
                  </div>

                  {document.exists ? (
                    <div className="mt-1 space-y-1">
                      {document.secondaryLabel ? (
                        <p className="text-[10px] text-slate-500">{document.secondaryLabel}</p>
                      ) : null}
                      {document.files.map((file) => (
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
                  ) : (
                    <p className={`mt-1 text-[10px] ${isRequiredMissing ? "font-semibold text-rose-500" : "text-slate-400"}`}>
                      {currentStatusLabel} à cette étape
                    </p>
                  )}
                </div>

                <div className="shrink-0">
                  {uploadAllowed ? (
                    <>
                      <button
                        type="button"
                        onClick={() => inputRefs.current[document.key]?.click()}
                        disabled={uploadingKey === document.key}
                        className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 transition hover:border-slate-300 disabled:opacity-60"
                      >
                        {uploadingKey === document.key ? "Envoi..." : "Téléverser"}
                      </button>
                      <input
                        ref={(node) => {
                          inputRefs.current[document.key] = node;
                        }}
                        type="file"
                        accept="application/pdf,image/*"
                        className="hidden"
                        onChange={(event) => handleUpload(document.key, event)}
                      />
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}

        {shouldShowLocalPlaceholder ? (
          <div
            className={`rounded-2xl border px-3.5 py-2 text-[12px] ${
              hasValidatedLocalProject
                ? "border-emerald-200 bg-emerald-50"
                : isLocalRequiredNow
                  ? "border-rose-200 bg-rose-50"
                  : "border-slate-200 bg-slate-50"
            }`}
          >
            <div className="flex items-start gap-3">
              <span
                className={
                  hasValidatedLocalProject ? "text-emerald-600" : isLocalRequiredNow ? "text-rose-500" : "text-slate-300"
                }
              >
                {hasValidatedLocalProject ? "✓" : "○"}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`font-medium ${
                    hasValidatedLocalProject
                      ? "text-slate-950"
                      : isLocalRequiredNow
                        ? "font-semibold text-rose-600"
                        : "text-slate-600"
                  }`}
                >
                  Local
                </p>
                <p className={`mt-1 text-[10px] ${isLocalRequiredNow ? "font-semibold text-rose-500" : "text-slate-400"}`}>
                  {hasValidatedLocalProject
                    ? "Projet de local validé"
                    : hasSubmittedLocalProject
                      ? "Projet de local en cours d'étude"
                      : isLocalRequiredNow
                        ? "Obligatoire à cette étape"
                        : "Projet de local attendu à cette étape"}
                </p>
              </div>
            </div>
          </div>
        ) : null}

        {futureDocumentRows.length ? (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowFutureDocuments((current) => !current)}
              className="flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-400 transition hover:border-slate-300 hover:text-slate-600"
            >
              <span className="text-base leading-none">{showFutureDocuments ? "⌃" : "⌄"}</span>
            </button>
          </div>
        ) : null}

        {showFutureDocuments
          ? futureDocumentRows.map((document) => (
              <div
                key={document.key}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-[12px] text-slate-500"
              >
                <div className="flex items-center gap-3">
                  <span className="text-slate-300">○</span>
                  <div className="min-w-0">
                    <p>{document.label}</p>
                    <p className="mt-0.5 text-[10px] text-slate-400">Attendu plus tard dans le parcours</p>
                  </div>
                </div>
              </div>
            ))
          : null}
      </div>
    </Card>
  );
}
