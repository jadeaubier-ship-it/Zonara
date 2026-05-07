import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { StepUploadCard } from "@/components/candidate/step-upload-card";
import { prisma } from "@/lib/db/prisma";
import { requireRole } from "@/lib/auth/session";

export default async function CandidateStepPage({ params }: { params: { step: string } }) {
  const stepNumber = Number(params.step);

  if (!Number.isInteger(stepNumber) || stepNumber < 1 || stepNumber > 10) {
    notFound();
  }

  const session = await requireRole(["CANDIDATE"]);
  const candidate = await prisma.candidate.findFirstOrThrow({
    where: { userId: session.user.id },
    include: {
      steps: true,
      documents: {
        where: { stepNumber }
      },
      docusignEnvelopes: {
        where: { stepNumber }
      }
    }
  });
  const config = await prisma.stepConfig.findUnique({ where: { stepNumber } });
  const step = candidate.steps.find((item) => item.stepNumber === stepNumber);

  return (
    <div className="space-y-6">
      <Card>
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-brand-700">Étape {stepNumber}</p>
        <h2 className="mt-2 text-3xl font-bold text-slate-950">{config?.name}</h2>
        <p className="mt-3 max-w-3xl text-sm text-slate-600">{config?.descriptionCandidate}</p>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-4">
          <h3 className="text-xl font-bold">Documents à télécharger ou envoyer</h3>
          {candidate.documents.length ? (
            candidate.documents.map((document) => (
              <div key={document.id} className="rounded-2xl border border-slate-200 p-4">
                <p className="font-semibold">{document.fileName}</p>
                <p className="text-sm text-slate-500">{document.type}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">Aucun document pour cette étape pour le moment.</p>
          )}
        </Card>
        <StepUploadCard candidateId={candidate.id} stepNumber={stepNumber} />
        <Card className="space-y-4">
          <h3 className="text-xl font-bold">Actions de l'étape</h3>
          <p className="text-sm text-slate-600">Statut actuel: {step?.status}</p>
          <div className="grid gap-3">
            <a href="/api/calendar/availability" className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
              Voir les créneaux disponibles
            </a>
            <a href="/api/docusign/send-envelope" className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
              Ouvrir la signature DocuSign
            </a>
            <a href="/api/calendar/book" className="rounded-2xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
              Réserver un rendez-vous
            </a>
          </div>
          {candidate.docusignEnvelopes.length ? (
            <div className="rounded-2xl bg-brand-50 p-4 text-sm text-brand-900">
              Signature en cours: {candidate.docusignEnvelopes[0].status}
            </div>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
