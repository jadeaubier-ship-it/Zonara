"use client";

import { FormEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function FranchiseeSummaryCard({
  franchisee
}: {
  franchisee: {
    id: string;
    address?: string | null;
    city: string;
    user: {
      firstname: string;
      lastname: string;
      email: string;
      phone?: string | null;
    };
    kpis: Array<unknown>;
  };
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(async () => {
      setMessage("");
      const response = await fetch(`/api/admin/franchisees/${franchisee.id}`, {
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
          city: formData.get("city")
        })
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setMessage(data?.error ?? "Impossible de mettre à jour le franchisé.");
        return;
      }

      setMessage("Profil franchisé mis à jour.");
      setIsEditing(false);
    });
  }

  return (
    <Card className="relative space-y-4">
      <button
        type="button"
        onClick={() => setIsEditing((value) => !value)}
        className="absolute right-6 top-6 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-lg text-slate-700 shadow-sm hover:bg-slate-50"
        aria-label="Modifier le résumé du franchisé"
      >
        ✎
      </button>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm text-slate-400">Prénom</label>
            <input name="firstname" defaultValue={franchisee.user.firstname} disabled={!isEditing} />
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-400">Nom</label>
            <input name="lastname" defaultValue={franchisee.user.lastname} disabled={!isEditing} />
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-400">Email</label>
            <input name="email" defaultValue={franchisee.user.email} disabled={!isEditing} />
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-400">Téléphone</label>
            <input name="phone" defaultValue={franchisee.user.phone ?? ""} disabled={!isEditing} />
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-400">Adresse</label>
            <input name="address" defaultValue={franchisee.address ?? ""} disabled={!isEditing} />
          </div>
          <div>
            <label className="mb-2 block text-sm text-slate-400">Ville</label>
            <input name="city" defaultValue={franchisee.city} disabled={!isEditing} />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">{franchisee.kpis.length} KPI mensuels</p>
          {isEditing ? (
            <Button type="submit" disabled={isPending}>
              Enregistrer
            </Button>
          ) : null}
        </div>
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      </form>
    </Card>
  );
}
