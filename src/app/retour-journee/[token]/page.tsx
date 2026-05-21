import { notFound } from "next/navigation";
import { DiscoveryFeedbackPublicForm } from "@/components/public/discovery-feedback-public-form";
import {
  buildDiscoveryFeedbackValues,
  getCandidateByDiscoveryFeedbackToken
} from "@/lib/services/discovery-workflow";
import { getAppSettings } from "@/lib/services/settings-store";

export default async function DiscoveryFeedbackPage({
  params
}: {
  params: { token: string };
}) {
  const [match, settings] = await Promise.all([getCandidateByDiscoveryFeedbackToken(params.token), getAppSettings()]);

  if (!match) {
    notFound();
  }

  const initialValues = buildDiscoveryFeedbackValues(match.candidate, match.invitationLog);

  return (
    <DiscoveryFeedbackPublicForm
      token={params.token}
      initialValues={initialValues}
      brandLogoDataUrl={settings.brandLogoDataUrl}
      brandName={settings.brandName}
      candidateSpaceUrl={
        match.candidate.onboardingToken
          ? `${process.env.NEXTAUTH_URL}/espace-candidat/${match.candidate.onboardingToken}`
          : undefined
      }
    />
  );
}
