"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function CandidateForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const formData = new FormData(event.currentTarget);

    const response = await fetch("/api/admin/candidates", {
      method: "POST",
      body: formData
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      setMessage(data?.error ?? "Impossible de créer le candidat.");
      return;
    }

    setMessage("Candidat créé et email de bienvenue envoyé.");
    router.push("/admin/dashboard");
    router.refresh();
  }

  return (
    <Card>
      <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium">Prénom</label>
          <input name="firstname" required />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">Nom</label>
          <input name="lastname" required />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">Email</label>
          <input name="email" type="email" required />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">Téléphone</label>
          <input name="phone" />
        </div>
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium">Adresse personnelle</label>
          <input name="address" />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">Ville</label>
          <input name="city" required />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">Code postal</label>
          <input name="zipcode" required />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">Source de la demande</label>
          <select name="source" defaultValue="L'EXPRESS">
            <option>L&apos;EXPRESS</option>
            <option>A3D</option>
            <option>HelloWork</option>
            <option>MAIL</option>
            <option>LinkedIn</option>
            <option>Site web</option>
            <option>Recommandation</option>
            <option>Autre</option>
          </select>
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium">Chargé de développement</label>
          <input name="assignedDevId" placeholder="ID utilisateur DEV" />
        </div>
        <div className="md:col-span-2">
          <label className="mb-2 block text-sm font-medium">Commentaire interne à la création</label>
          <textarea name="comment" rows={4} placeholder="Notes, contexte, infos utiles..." />
        </div>
        <div className="md:col-span-2">
          <Button type="submit">Créer le candidat et envoyer l'email</Button>
        </div>
        {message ? <p className="md:col-span-2 text-sm text-slate-600">{message}</p> : null}
      </form>
    </Card>
  );
}
