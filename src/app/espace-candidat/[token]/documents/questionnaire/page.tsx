import { Card } from "@/components/ui/card";
import { getCandidatePortalContext } from "@/lib/services/candidate-portal";
import { formatPhoneNumber } from "@/lib/utils/formatters";

export default async function CandidatePortalApplicationDocumentPage({
  params
}: {
  params: { token: string };
}) {
  const { candidate, applicationData } = await getCandidatePortalContext(params.token);

  const rows = [
    ["Prénom", applicationData.firstname ?? candidate.user.firstname],
    ["Nom", applicationData.lastname ?? candidate.user.lastname],
    ["Email", applicationData.email ?? candidate.user.email],
    ["Téléphone", applicationData.phone ? formatPhoneNumber(applicationData.phone) : candidate.user.phone ? formatPhoneNumber(candidate.user.phone) : ""],
    ["Date de naissance", applicationData.birthDate ?? ""],
    ["Adresse", applicationData.address ?? ""],
    ["Ville", applicationData.city ?? ""],
    ["Code postal", applicationData.zipcode ?? ""],
    ["Situation familiale", applicationData.familySituation ?? ""],
    ["Nombre d'enfants", applicationData.childrenCount ?? ""],
    ["Profession actuelle", applicationData.profession ?? ""],
    ["Situation professionnelle", applicationData.professionalSituation ?? ""],
    ["Ville d'implantation du projet", applicationData.projectZone ?? ""],
    ["Code postal d'implantation du projet", applicationData.projectZipcode ?? ""],
    ["Délai du projet", applicationData.projectDelay ?? ""],
    ["Apport personnel", applicationData.personalContribution ?? ""],
    ["Expérience entrepreneuriale", applicationData.entrepreneurshipExperience ?? ""],
    ["Motivation", applicationData.motivation ?? ""],
    ["Notes complémentaires", applicationData.notes ?? ""]
  ];

  return (
    <div className="space-y-6">
      <Card>
        <p className="text-sm uppercase tracking-[0.2em] text-[#007cbd]">Document</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">Formulaire de candidature</h1>
      </Card>

      <Card className="space-y-4">
        {rows.map(([label, value]) => (
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
