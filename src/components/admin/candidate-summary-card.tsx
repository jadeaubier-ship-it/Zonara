"use client";

import { FormEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatPhoneNumber } from "@/lib/utils/formatters";

export function CandidateSummaryCard({
  candidate,
  archived
}: {
  candidate: {
    id: string;
    address?: string | null;
    city: string;
    zipcode?: string | null;
    documents: Array<{
      type: string;
      fileUrl: string;
    }>;
    user: {
      firstname: string;
      lastname: string;
      email: string;
      phone?: string | null;
    };
  };
  archived?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const questionnaireDocument = candidate.documents.find((document) => document.type === "questionnaire");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      setMessage("");
      const response = await fetch(`/api/admin/candidates/${candidate.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          firstname: formData.get("firstname"),
          lastname: formData.get("lastname"),
          email: formData.get("email"),
          phone: formData.get("phone"),
          address: formData.get("address"),
          city: formData.get("city"),
          zipcode: formData.get("zipcode")
        })
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setMessage(data?.error ?? "Impossible de mettre à jour le candidat.");
        return;
      }

      setMessage("Résumé candidat mis à jour.");
      setIsEditing(false);
      window.location.reload();
    });
  }

  return (
    <Card className={archived ? "border-rose-200 bg-white/90 p-4" : "p-4"}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsEditing((value) => !value)}
          className="absolute right-0 top-0 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-base text-slate-700 shadow-sm hover:bg-slate-50"
          aria-label="Modifier le résumé du candidat"
        >
          ✎
        </button>
        <form onSubmit={onSubmit} className="space-y-2.5 text-sm">
          <div className="pr-12">
            <p className="text-base font-bold text-slate-950">
              {candidate.user.firstname} {candidate.user.lastname}
            </p>
          </div>
          {isEditing ? (
            <>
              <Field label="Prénom" name="firstname" defaultValue={candidate.user.firstname} disabled={!isEditing} />
              <Field label="Nom" name="lastname" defaultValue={candidate.user.lastname} disabled={!isEditing} />
            </>
          ) : null}
          <Field label="Email" name="email" defaultValue={candidate.user.email} disabled={!isEditing} />
          <Field
            label="Téléphone"
            name="phone"
            defaultValue={isEditing ? candidate.user.phone ?? "" : formatPhoneNumber(candidate.user.phone)}
            disabled={!isEditing}
          />
          <div className={isEditing ? "space-y-3" : "space-y-0"}>
            <Field
              label="Adresse personnelle"
              name="address"
              defaultValue={candidate.address ?? ""}
              disabled={!isEditing}
            />
            <Field label="Ville" name="city" defaultValue={candidate.city} disabled={!isEditing} />
            <Field label="Code postal" name="zipcode" defaultValue={candidate.zipcode ?? ""} disabled={!isEditing} />
          </div>
          <div className="flex items-center justify-between">
            {message ? <p className="text-sm text-slate-600">{message}</p> : <span />}
            {isEditing ? (
              <Button type="submit" disabled={isPending}>
                Enregistrer
              </Button>
            ) : null}
          </div>
          <div className="pt-1">
            {questionnaireDocument ? (
              <a
                href={questionnaireDocument.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                Dossier de candidature
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-500"
              >
                Dossier de candidature
              </button>
            )}
          </div>
        </form>
      </div>
    </Card>
  );
}

function Field({
  label,
  name,
  defaultValue,
  disabled
}: {
  label: string;
  name: string;
  defaultValue: string;
  disabled: boolean;
}) {
  if (disabled) {
    return (
      <div>
        <p className="font-medium leading-tight text-slate-900">{defaultValue || "Non renseigné"}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-slate-400">{label}</p>
      <input
        name={name}
        defaultValue={defaultValue}
        disabled={disabled}
        className="mt-1"
      />
    </div>
  );
}
