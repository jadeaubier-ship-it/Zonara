import { Card } from "@/components/ui/card";
import { getCandidatePortalContext } from "@/lib/services/candidate-portal";
import { CandidatePortalCredentialsForm } from "@/components/public/candidate-portal-credentials-form";
import { CandidatePortalProfileForm } from "@/components/public/candidate-portal-profile-form";

export default async function CandidatePortalSettingsPage({
  params
}: {
  params: { token: string };
}) {
  const { candidate } = await getCandidatePortalContext(params.token);
  const profilePhoto =
    candidate.documents.find((document) => document.type === "photo_profil")?.fileUrl ?? "";

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h1 className="text-xl font-semibold text-slate-950">Paramètres</h1>
        <p className="mt-1 text-[12px] text-slate-500">
          Modifiez ici votre profil, votre identifiant de connexion et votre mot de passe.
        </p>
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 text-[16px] font-semibold text-slate-950">Profil</h2>
        <CandidatePortalProfileForm
          token={params.token}
          initialFirstname={candidate.user.firstname}
          initialLastname={candidate.user.lastname}
          initialEmail={candidate.user.email}
          initialPhone={candidate.user.phone ?? ""}
          initialPhotoDataUrl={profilePhoto}
        />
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 text-[16px] font-semibold text-slate-950">Connexion</h2>
        <CandidatePortalCredentialsForm
          token={params.token}
          initialEmail={candidate.user.email}
        />
      </Card>
    </div>
  );
}
