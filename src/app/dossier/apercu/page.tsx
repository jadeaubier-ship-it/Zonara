import { CandidateApplicationPublicForm } from "@/components/public/candidate-application-public-form";
import { getAppSettings } from "@/lib/services/settings-store";

const previewValues = {
  firstname: "Jérôme",
  lastname: "Dupuis",
  email: "jerome.dupuis@gmail.fr",
  phone: "0685896996",
  address: "23 rue du marais",
  city: "Saint-Etienne",
  zipcode: "42000",
  birthDate: "1990-05-15",
  familySituation: "Marié",
  childrenCount: "2",
  profession: "Commercial",
  professionalSituation: "Salarié",
  projectZone: "Loire",
  projectDelay: "6 mois",
  personalContribution: "80000 €",
  motivation: "Je souhaite développer un projet structuré dans mon secteur et rejoindre un réseau solide.",
  entrepreneurshipExperience: "Gestion d'équipe et développement commercial",
  notes: "Exemple d'aperçu du dossier envoyé au candidat."
};

export default async function CandidateApplicationPreviewPage() {
  const settings = await getAppSettings();

  return (
    <CandidateApplicationPublicForm
      token="preview"
      candidateName="Jérôme Dupuis"
      initialValues={previewValues}
      brandLogoDataUrl={settings.brandLogoDataUrl}
      brandName={settings.brandName}
      previewMode
      hasPhoto
      hasCv
    />
  );
}
