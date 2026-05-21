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
  files: Array<{
    id: string;
    fileName: string;
    fileUrl: string;
    mimeType: string | null;
  }>;
};

function cloneDocuments(documents: CandidatePortalDocument[]) {
  return documents.map((document) => ({
    ...document,
    files: [...document.files]
  }));
}

export function CandidatePortalDocumentsCard({
  token,
  currentStep,
  visibleDocumentStep,
  initialDocuments
}: {
  token: string;
  currentStep: number;
  visibleDocumentStep: number;
  initialDocuments: CandidatePortalDocument[];
}) {
  const [documents, setDocuments] = useState(() => cloneDocuments(initialDocuments));
  const [showFutureDocuments, setShowFutureDocuments] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const currentDocumentRows = useMemo(
    () =>
      documents.filter((document) => document.exists || document.visibleFromStep <= visibleDocumentStep),
    [documents, visibleDocumentStep]
  );

  const futureDocumentRows = useMemo(
    () =>
      documents.filter((document) => !document.exists && document.visibleFromStep > visibleDocumentStep),
    [documents, visibleDocumentStep]
  );

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
              ? [data.document!, ...document.files]
              : [data.document!];

          return {
            ...document,
            exists: true,
            href: nextFiles[0]?.fileUrl ?? null,
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
          const uploadAllowed = document.candidateCanUpload && currentStep >= document.visibleFromStep;
          const currentStatusLabel = document.isRequiredNow ? "Obligatoire" : "Facultatif";

          return (
            <div
              key={document.key}
              className={`rounded-2xl border px-3.5 py-2 text-[12px] ${
                document.exists ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <span className={document.exists ? "text-emerald-600" : "text-slate-300"}>
                      {document.exists ? "✓" : "○"}
                    </span>
                    <p className={`font-medium ${document.exists ? "text-slate-950" : "text-slate-600"}`}>{document.label}</p>
                  </div>

                  {document.exists ? (
                    <div className="mt-1 space-y-1">
                      {document.files.map((file) => (
                        <a
                          key={file.id}
                          href={file.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="block text-[10px] text-slate-500 transition hover:text-[#007cbd]"
                        >
                          {file.fileName}
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-1 text-[10px] text-slate-400">{currentStatusLabel} à cette étape</p>
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
                        {uploadingKey === document.key
                          ? "Envoi..."
                          : document.exists
                            ? document.key === "plans_local" || document.key === "photos_local"
                              ? "Ajouter"
                              : "Remplacer"
                            : "Téléverser"}
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
