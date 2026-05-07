"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function StepUploadCard({ candidateId, stepNumber }: { candidateId: string; stepNumber: number }) {
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const formData = new FormData(event.currentTarget);

    const response = await fetch("/api/candidate/upload", {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      setMessage("Impossible de préparer l'upload sécurisé.");
      return;
    }

    const data = await response.json();
    setMessage(`URL signée générée: ${data.signedUrl}`);
  }

  return (
    <Card className="space-y-4">
      <h3 className="text-xl font-bold">Déposer un document</h3>
      <form onSubmit={onSubmit} className="space-y-3">
        <input type="hidden" name="stepNumber" value={stepNumber} />
        <input type="hidden" name="candidateId" value={candidateId} />
        <input name="fileName" placeholder="Nom du document" />
        <input name="type" placeholder="Type" />
        <Button type="submit">Préparer l'upload sécurisé</Button>
      </form>
      {message ? <p className="text-sm text-slate-600">{message}</p> : null}
    </Card>
  );
}
