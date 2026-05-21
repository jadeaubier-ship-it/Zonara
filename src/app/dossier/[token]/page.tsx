import { CandidateApplicationPublicForm } from "@/components/public/candidate-application-public-form";
import { Card } from "@/components/ui/card";
import { buildApplicationFormValues, getCandidateByApplicationToken } from "@/lib/services/application-workflow";
import { getAppSettings } from "@/lib/services/settings-store";

export default async function CandidateApplicationPage({ params }: { params: { token: string } }) {
  const [candidate, settings] = await Promise.all([getCandidateByApplicationToken(params.token), getAppSettings()]);

  if (!candidate) {
    return (
      <main className="min-h-screen bg-white px-6 py-10">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-3xl items-center">
          <Card className="w-full">
            <h1 className="text-3xl font-bold text-slate-950">Lien invalide</h1>
            <p className="mt-3 text-sm text-rose-600">Ce lien de dossier de candidature est expiré ou invalide.</p>
          </Card>
        </div>
      </main>
    );
  }

  const initialValues = buildApplicationFormValues(candidate);
  const hasPhoto = candidate.documents.some((document) => document.type === "photo_profil" && Boolean(document.fileUrl));
  const hasCv = candidate.documents.some((document) => document.type === "cv" && Boolean(document.fileUrl));

  return (
    <CandidateApplicationPublicForm
      token={params.token}
      candidateName={`${candidate.user.firstname} ${candidate.user.lastname}`}
      initialValues={initialValues}
      brandLogoDataUrl={settings.brandLogoDataUrl}
      brandName={settings.brandName}
      hasPhoto={hasPhoto}
      hasCv={hasCv}
    />
  );
}
