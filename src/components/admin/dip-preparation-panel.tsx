"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

type AttachmentFile = {
  id: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  uploadedAt: string;
};

type DipPreparationPanelProps = {
  candidateId: string;
  candidateName: string;
  projectZone: string;
  frozenAt: string | null;
  sentEnvelopeId: string | null;
  version: string;
  docusignTemplateId: string;
  docusignTemplateRoleName: string;
  mainDipDocument: AttachmentFile | null;
  templateAnnexes: AttachmentFile[];
  elmFiles: AttachmentFile[];
};

function buildElmDisplayName(projectZone: string, index: number) {
  const suffix = projectZone.trim().length ? ` - ${projectZone.trim()}` : "";
  return index === 0
    ? `Annexe 09 - Etat Local de marché${suffix}.pdf`
    : `Annexe 09 - Etat Local de marché${suffix} (${index + 1}).pdf`;
}

function extractAnnexOrder(fileName: string) {
  const match = fileName.match(/annexe\s*0?(\d{1,2})/i) || fileName.match(/\b0?(\d{1,2})\b/);
  if (!match) return 999;
  return Number(match[1]);
}

export function DipPreparationPanel({
  candidateId,
  candidateName,
  projectZone,
  frozenAt,
  sentEnvelopeId,
  version,
  docusignTemplateId,
  docusignTemplateRoleName,
  mainDipDocument,
  templateAnnexes,
  elmFiles
}: DipPreparationPanelProps) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const hasBeenSent = Boolean(sentEnvelopeId);
  const isFrozen = Boolean(frozenAt);

  const orderedAttachments = useMemo(() => {
    const annexes = [...templateAnnexes].sort((a, b) => {
      const orderDiff = extractAnnexOrder(a.fileName) - extractAnnexOrder(b.fileName);
      return orderDiff === 0 ? a.fileName.localeCompare(b.fileName, "fr") : orderDiff;
    });

    const elmEntries = elmFiles.map((file, index) => ({
      ...file,
      fileName: buildElmDisplayName(projectZone, index)
    }));

    const beforeElm = annexes.filter((file) => extractAnnexOrder(file.fileName) < 9);
    const afterElm = annexes.filter((file) => extractAnnexOrder(file.fileName) >= 9);

    return [...beforeElm, ...elmEntries, ...afterElm];
  }, [elmFiles, projectZone, templateAnnexes]);

  const readiness = {
    template: Boolean(docusignTemplateId.trim() && docusignTemplateRoleName.trim()),
    dip: Boolean(mainDipDocument),
    attachments: orderedAttachments.length > 0
  };

  const readyToSend = readiness.template && readiness.dip && elmFiles.length > 0;

  async function handleOpenAttachment(fileUrl: string) {
    if (!fileUrl) return;

    if (fileUrl.startsWith("data:")) {
      const response = await fetch(fileUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
      return;
    }

    window.open(fileUrl, "_blank", "noopener,noreferrer");
  }

  async function handleFreezeAndSend() {
    setSending(true);
    setMessage("");

    try {
      if (!readyToSend) {
        throw new Error("Le modèle DocuSign, le DIP principal et l’ELM doivent être présents avant l’envoi.");
      }

      if (!isFrozen) {
        const freezeResponse = await fetch(`/api/admin/candidates/${candidateId}/dip`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version, freeze: true })
        });
        const freezeData = (await freezeResponse.json().catch(() => null)) as { error?: string } | null;
        if (!freezeResponse.ok) {
          throw new Error(freezeData?.error ?? "Impossible de figer la préparation du DIP.");
        }
      }

      const response = await fetch("/api/docusign/send-envelope", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId })
      });

      const data = (await response.json().catch(() => null)) as { error?: string; envelopeId?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? "Impossible d'envoyer le DIP via DocuSign.");
      }

      setMessage(data?.envelopeId ? `DIP envoyé via DocuSign. Enveloppe : ${data.envelopeId}` : "DIP envoyé via DocuSign.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Impossible d'envoyer le DIP via DocuSign.");
    } finally {
      setSending(false);
    }
  }

  function renderStatusPill(ready: boolean, labelReady: string, labelMissing: string) {
    return ready ? (
      <span className="inline-flex h-10 items-center justify-center rounded-2xl bg-emerald-500 px-4 text-[12px] font-semibold text-white">
        {labelReady}
      </span>
    ) : (
      <span className="inline-flex h-10 items-center justify-center rounded-2xl bg-[#007cbd] px-4 text-[12px] font-semibold text-white">
        {labelMissing}
      </span>
    );
  }

  return (
    <div className="space-y-4">
      {isFrozen || message ? (
        <div className="rounded-[1.6rem] border border-slate-200 bg-white px-5 py-4 shadow-sm">
          {isFrozen ? <p className="text-sm font-medium text-emerald-600">Le DIP définitif a déjà été figé.</p> : null}
          {hasBeenSent && sentEnvelopeId ? (
            <p className={isFrozen ? "mt-2 text-sm text-slate-500" : "text-sm text-slate-500"}>
              DIP envoyé via DocuSign. Enveloppe : {sentEnvelopeId}
            </p>
          ) : null}
          {message ? <p className={isFrozen ? "mt-2 text-sm text-slate-500" : "text-sm text-slate-500"}>{message}</p> : null}
        </div>
      ) : null}

      <div className="rounded-[2.1rem] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 rounded-[1.6rem] border border-slate-200 bg-white px-5 py-4">
            <div>
              <p className="text-base font-semibold text-slate-900">Modèle DocuSign d’accusé de réception</p>
              <p className="mt-1 text-[12px] text-slate-500">
                {docusignTemplateId ? `Template ${docusignTemplateId}` : "Aucun template DocuSign renseigné"}
              </p>
              {docusignTemplateRoleName ? (
                <p className="mt-1 text-[12px] text-slate-500">Rôle signataire : {docusignTemplateRoleName}</p>
              ) : null}
            </div>
            {renderStatusPill(readiness.template, "Prêt", "À configurer")}
          </div>

          <div className="flex items-center justify-between gap-4 rounded-[1.6rem] border border-slate-200 bg-white px-5 py-4">
            <div className="min-w-0">
              <p className="text-base font-semibold text-slate-900">DIP principal PDF</p>
              {mainDipDocument ? (
                <button
                  type="button"
                  onClick={() => void handleOpenAttachment(mainDipDocument.fileUrl)}
                  className="mt-1 block truncate text-left text-[12px] text-slate-500 hover:text-[#007cbd]"
                >
                  {mainDipDocument.fileName}
                </button>
              ) : (
                <p className="mt-1 text-[12px] text-slate-500">Aucun DIP principal uploadé dans le workflow.</p>
              )}
            </div>
            {renderStatusPill(readiness.dip, "Prêt", "À uploader")}
          </div>

          <div className="rounded-[1.6rem] border border-slate-200 bg-white px-5 py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-base font-semibold text-slate-900">Annexes et ELM joints à l’envoi</p>
                <p className="mt-1 text-[12px] text-slate-500">
                  L’ordre sera : accusé DocuSign, DIP principal, annexes PDF puis ELM du candidat.
                </p>
              </div>
              {renderStatusPill(elmFiles.length > 0, "ELM prêt", "ELM attendu")}
            </div>

            <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
              {orderedAttachments.length ? (
                orderedAttachments.map((file) => (
                  <div key={file.id} className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => void handleOpenAttachment(file.fileUrl)}
                      className="block truncate text-left text-[12px] font-medium text-slate-900 hover:text-[#007cbd]"
                    >
                      {file.fileName}
                    </button>
                  </div>
                ))
              ) : (
                <div className="px-4 py-3 text-[11px] text-slate-400">Aucune annexe ni ELM à joindre pour l’instant.</div>
              )}
            </div>
          </div>
        </div>

        {readyToSend && !hasBeenSent ? (
          <div className="mt-8 flex justify-end">
            <Button
              onClick={() => void handleFreezeAndSend()}
              disabled={sending || saving}
              className="h-12 rounded-2xl bg-[#007cbd] px-8 text-[14px] font-semibold text-white hover:bg-[#006ba3]"
            >
              {sending ? "Envoi DocuSign..." : `Envoyer le DIP à ${candidateName}`}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
