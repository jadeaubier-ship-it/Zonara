import { DiscoveryFeedbackPublicForm } from "@/components/public/discovery-feedback-public-form";
import { getAppSettings } from "@/lib/services/settings-store";

export default async function DiscoveryFeedbackPreviewPage() {
  const settings = await getAppSettings();

  return (
    <DiscoveryFeedbackPublicForm
      token="apercu"
      initialValues={{
        firstname: "Jade",
        lastname: "Aubier",
        discoveryDate: "2026-05-15",
        discoveryFeedback: "",
        improvementPoints: "",
        continueJourney: "",
        stopReason: ""
      }}
      brandLogoDataUrl={settings.brandLogoDataUrl}
      brandName={settings.brandName}
    />
  );
}
