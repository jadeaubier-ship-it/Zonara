"use client";

import { FormEvent, useState } from "react";

export function CandidatePortalCredentialsForm({
  token,
  initialEmail
}: {
  token: string;
  initialEmail: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (password && password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }

    if (password !== confirmPassword) {
      setError("La confirmation du mot de passe ne correspond pas.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(`/api/public/candidate-space/${token}/credentials`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password
        })
      });

      const data = (await response.json().catch(() => null)) as { email?: string; error?: string } | null;

      if (!response.ok || !data?.email) {
        throw new Error(data?.error ?? "Impossible d'enregistrer vos paramètres.");
      }

      setEmail(data.email);
      setPassword("");
      setConfirmPassword("");
      setMessage("Vos paramètres de connexion ont bien été enregistrés.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible d'enregistrer vos paramètres.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Identifiant de connexion</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#007cbd]"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Nouveau mot de passe</span>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Laisser vide pour ne pas changer"
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#007cbd]"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-slate-700">Confirmer le mot de passe</span>
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          placeholder="Confirmer le mot de passe"
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#007cbd]"
        />
      </label>

      <div className="flex items-center justify-between gap-4">
        <div className="text-sm">
          {error ? <p className="text-rose-600">{error}</p> : null}
          {!error && message ? <p className="text-emerald-600">{message}</p> : null}
        </div>
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center justify-center rounded-2xl bg-[#007cbd] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#00679d] disabled:opacity-60"
        >
          {isSaving ? "Enregistrement..." : "Enregistrer"}
        </button>
      </div>
    </form>
  );
}
