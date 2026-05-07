import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl items-center px-6 py-16">
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.35em] text-brand-700">Réseau Franchise</p>
          <h1 className="mt-4 text-5xl font-black leading-tight text-slate-950">Atome3D pilote tout le recrutement franchisé dans une seule plateforme.</h1>
          <p className="mt-6 max-w-2xl text-lg text-slate-600">
            Pipeline CRM, onboarding sécurisé, signatures DocuSign, paiement Stripe, rendez-vous Google Calendar,
            documents signés et suivi KPI du réseau.
          </p>
          <div className="mt-8 flex gap-3">
            <Link href="/login">
              <Button>Se connecter</Button>
            </Link>
          </div>
        </div>
        <Card className="grid gap-4 bg-slate-950 text-white">
          <p className="text-sm font-semibold text-brand-300">Flux 10 étapes verrouillé</p>
          <ul className="space-y-3 text-sm text-slate-200">
            <li>1. Création candidat et email de bienvenue</li>
            <li>2. Activation du compte et questionnaire</li>
            <li>3. Réservation de visio</li>
            <li>4. Validation et paiement journée découverte</li>
            <li>5. Signature DIP / ELM</li>
            <li>6. Validation du local</li>
            <li>7. Pièces société</li>
            <li>8. Contrat et formation</li>
            <li>9. Devis menuisier</li>
            <li>10. Conversion franchisé</li>
          </ul>
        </Card>
      </div>
    </main>
  );
}
