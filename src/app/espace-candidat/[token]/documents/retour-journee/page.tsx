import { Card } from "@/components/ui/card";
import { getCandidatePortalContext } from "@/lib/services/candidate-portal";

export default async function CandidatePortalDiscoveryFeedbackDocumentPage({
  params
}: {
  params: { token: string };
}) {
  const { discoveryData } = await getCandidatePortalContext(params.token);

  const rows = [
    ["Prénom", discoveryData.firstname ?? ""],
    ["Nom", discoveryData.lastname ?? ""],
    ["Date de la journée découverte", discoveryData.discoveryDate ?? ""],
    ["Qu'avez-vous pensé de cette Journée Découverte ?", discoveryData.discoveryFeedback ?? ""],
    ["Avez-vous identifié des points d'amélioration ?", discoveryData.improvementPoints ?? ""],
    [
      "Souhaitez vous continuer le parcours de candidature ?",
      discoveryData.continueJourney
        ? discoveryData.continueJourney.charAt(0).toUpperCase() + discoveryData.continueJourney.slice(1)
        : ""
    ],
    ["Pourquoi souhaitez vous arrêter le parcours de candidature ?", discoveryData.stopReason ?? ""]
  ];

  return (
    <div className="space-y-6">
      <Card>
        <p className="text-sm uppercase tracking-[0.2em] text-[#007cbd]">Document</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">Retour de la journée découverte</h1>
      </Card>

      <Card className="space-y-4">
        {rows
          .filter(([label, value]) => label !== "Pourquoi souhaitez vous arrêter le parcours de candidature ?" || value)
          .map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.14em] text-slate-400">{label}</p>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-900">
                {value || "Non renseigné"}
              </p>
            </div>
          ))}
      </Card>
    </div>
  );
}
