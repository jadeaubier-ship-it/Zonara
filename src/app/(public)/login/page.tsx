"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ROLE_REDIRECTS } from "@/lib/utils/constants";

export default function LoginPage() {
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
    <main className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-16">
      <Card className="w-full max-w-lg">
        <p className="text-sm font-bold uppercase tracking-[0.35em] text-brand-700">Connexion</p>
        <h1 className="mt-4 text-3xl font-bold text-slate-950">Accéder à votre espace Atome3D</h1>
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium">Email</label>
            <input name="email" type="email" required defaultValue="admin@atome3d.fr" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium">Mot de passe</label>
            <input name="password" type="password" required defaultValue="Admin1234!" />
          </div>
          {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          <Button type="submit" className="w-full">
            Se connecter
          </Button>
        </form>
      </Card>
    </main>
  );
}
