"use client";

import { ChangeEvent, useRef, useState, useTransition } from "react";
import { Card } from "@/components/ui/card";

export function CandidatePhotoCard({
  candidateId,
  profilePhotoUrl,
  candidateName,
  archived
}: {
  candidateId: string;
  profilePhotoUrl?: string;
  candidateName: string;
  archived?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    startTransition(async () => {
      setMessage("");
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`/api/admin/candidates/${candidateId}/photo`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setMessage(data?.error ?? "Impossible de modifier la photo.");
        return;
      }

      window.location.reload();
    });
  }

  return (
    <Card className={`overflow-hidden p-0 ${archived ? "border-rose-200 bg-white/90" : ""}`}>
      <div className="relative h-full min-h-[14rem] overflow-hidden">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="absolute right-3 top-3 z-[500] inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-lg text-slate-700 shadow-sm hover:bg-white"
          aria-label="Modifier la photo du candidat"
          disabled={isPending}
        >
          ✎
        </button>
        <input ref={inputRef} type="file" accept="image/*" onChange={onFileChange} className="hidden" />
        {profilePhotoUrl ? (
          <img src={profilePhotoUrl} alt={`Photo de ${candidateName}`} className="h-full min-h-[14rem] w-full object-cover" />
        ) : (
          <div className="flex h-full min-h-[14rem] items-center justify-center bg-slate-50 text-sm text-slate-400">Importer une photo</div>
        )}
      </div>
      {message ? <p className="px-6 pb-6 pt-3 text-sm text-slate-600">{message}</p> : null}
    </Card>
  );
}
