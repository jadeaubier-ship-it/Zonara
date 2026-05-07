import Link from "next/link";
import { isAfter } from "date-fns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db/prisma";

export default async function OnboardingPage({ params }: { params: { token: string } }) {
  const candidate = await prisma.candidate.findFirst({
    where: { onboardingToken: params.token },
    include: { user: true }
  });

  const isExpired = !candidate?.tokenExpirationDate || isAfter(new Date(), candidate.tokenExpirationDate);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-16">
      <Card className="w-full">
        <h1 className="text-3xl font-bold text-slate-950">Activation de votre dossier</h1>
        {candidate && !isExpired ? (
          <>
            <p className="mt-3 text-sm text-slate-600">
              Bonjour {candidate.user.firstname}, votre lien est valide. Connectez-vous ensuite pour définir votre mot de passe
              et commencer l'étape 2.
            </p>
            <div className="mt-6">
              <Link href="/login">
                <Button>Aller à la connexion</Button>
              </Link>
            </div>
          </>
        ) : (
          <p className="mt-3 text-sm text-rose-600">Ce lien d'onboarding est expiré ou invalide.</p>
        )}
      </Card>
    </main>
  );
}
