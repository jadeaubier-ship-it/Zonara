"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ROLE_REDIRECTS } from "@/lib/utils/constants";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false
    });

    if (result?.error) {
      setError("Identifiants invalides");
      return;
    }

    const sessionResponse = await fetch("/api/auth/session");
    const session = await sessionResponse.json();
    const role = session?.user?.role as keyof typeof ROLE_REDIRECTS | undefined;

    router.refresh();
    router.push(role ? ROLE_REDIRECTS[role] : "/login");
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto mt-10 w-full max-w-md space-y-5">
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Email</label>
        <input
          name="email"
          type="email"
          required
          defaultValue="admin@atome3d.fr"
          className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition focus:border-black focus:ring-2 focus:ring-black/10"
        />
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Mot de passe</label>
        <input
          name="password"
          type="password"
          required
          defaultValue="Admin1234!"
          className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-950 outline-none transition focus:border-black focus:ring-2 focus:ring-black/10"
        />
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <button
        type="submit"
        className="inline-flex h-14 w-full items-center justify-center rounded-2xl border border-black bg-white text-base font-semibold text-black transition hover:bg-black hover:text-white"
      >
        Se connecter
      </button>
    </form>
  );
}
