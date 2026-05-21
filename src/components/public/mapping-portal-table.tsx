"use client";

import { ChangeEvent, useState, useTransition } from "react";

type MappingCandidate = {
  id: string;
  firstname: string;
  lastname: string;
  email: string;
  phone: string;
  discoveryDate: string;
  elmFiles: Array<{
    id: string;
    fileName: string;
  }>;
};

export function MappingPortalTable({
  token,
  initialCandidates
}: {
  token: string;
  initialCandidates: MappingCandidate[];
}) {
  const [candidates, setCandidates] = useState(initialCandidates);
  const [message, setMessage] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleUpload(candidateId: string, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadingId(candidateId);
    setMessage("");

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(`/api/public/mapping/${token}/elm/${candidateId}`, {
          method: "POST",
          body: formData
        });

        const data = (await response.json().catch(() => null)) as
          | {
              error?: string;
              document?: {
                id: string;
                fileName: string;
              };
            }
          | null;
        if (!response.ok) {
          throw new Error(data?.error ?? "Impossible d'uploader l'ELM.");
        }

        setCandidates((current) =>
          [...current]
            .map((candidate) =>
              candidate.id === candidateId && data?.document
                ? {
                    ...candidate,
                    elmFiles: [data.document, ...candidate.elmFiles]
                  }
                : candidate
            )
            .sort((left, right) => {
              const leftPending = left.elmFiles.length === 0 ? 0 : 1;
              const rightPending = right.elmFiles.length === 0 ? 0 : 1;
              if (leftPending !== rightPending) {
                return leftPending - rightPending;
              }

              return `${left.lastname} ${left.firstname}`.localeCompare(
                `${right.lastname} ${right.firstname}`,
                "fr"
              );
            })
        );
        setMessage("ELM uploadé.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Impossible d'uploader l'ELM.");
      } finally {
        setUploadingId(null);
      }
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="rounded-[2rem] border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[#007cbd]">Mapping</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">Candidats en attente d’ELM</h1>
          {message ? <p className="mt-2 text-sm text-slate-500">{message}</p> : null}
        </div>

        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-50 text-left text-[11px] uppercase tracking-[0.16em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Nom prénom</th>
                <th className="px-4 py-3">Mail</th>
                <th className="px-4 py-3">Téléphone</th>
                <th className="px-4 py-3">Journée découverte</th>
                <th className="px-4 py-3">ELM</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {candidates.length ? (
                candidates.map((candidate) => (
                  <tr key={candidate.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 text-[12px] font-medium text-slate-900 whitespace-nowrap">
                      {candidate.firstname} {candidate.lastname}
                    </td>
                    <td className="px-4 py-3 text-[12px] text-slate-700 whitespace-nowrap">{candidate.email}</td>
                    <td className="px-4 py-3 text-[12px] text-slate-700 whitespace-nowrap">{candidate.phone || "-"}</td>
                    <td className="px-4 py-3 text-[12px] text-slate-700 whitespace-nowrap">{candidate.discoveryDate}</td>
                    <td className="px-4 py-3 text-[12px] text-slate-700">
                      {candidate.elmFiles.length ? (
                        <div className="space-y-0.5">
                          {candidate.elmFiles.map((file) => (
                            <p key={file.id} className="max-w-[180px] truncate text-[11px] text-slate-500" title={file.fileName}>
                              {file.fileName}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">Aucun ELM</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <label
                        className={`inline-flex cursor-pointer items-center justify-center rounded-2xl px-3 py-1.5 text-[12px] font-medium leading-tight transition ${
                          candidate.elmFiles.length
                            ? "border border-[#007cbd] bg-[#007cbd] text-white hover:bg-[#006ba3]"
                            : "border border-slate-900 bg-white text-slate-900 hover:bg-slate-50"
                        }`}
                      >
                        {uploadingId === candidate.id
                          ? "Upload..."
                          : candidate.elmFiles.length
                            ? "Nouvel ELM"
                            : "Uploader l'ELM"}
                        <input type="file" className="hidden" onChange={(event) => handleUpload(candidate.id, event)} />
                      </label>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                    Aucun candidat en attente d’ELM.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
