import { SettingsPanel } from "@/components/admin/settings-panel";
import { getAppSettings, resolveUserProfile } from "@/lib/services/settings-store";
import { requireRole } from "@/lib/auth/session";
import { isGoogleCalendarConfigured } from "@/lib/integrations/google-oauth";
import { prisma } from "@/lib/db/prisma";
import { workflowSections } from "@/app/admin/workflow/page";

export default async function AdminSettingsPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const session = await requireRole(["ADMIN", "DEV"]);
  const [settings, googleAccount] = await Promise.all([
    getAppSettings(),
    prisma.googleAccount.findUnique({ where: { userId: session.user.id } })
  ]);
  const profile = resolveUserProfile({
    settings,
    user: {
      id: session.user.id,
      firstname: session.user.firstname ?? "",
      lastname: session.user.lastname ?? "",
      email: session.user.email ?? "",
      phone: "",
      role: session.user.role
    }
  });
  const googleStatus = Array.isArray(searchParams?.google)
    ? searchParams?.google[0]
    : searchParams?.google;
  const googleDetail = Array.isArray(searchParams?.detail)
    ? searchParams?.detail[0]
    : searchParams?.detail;

  return (
    <div className="grid gap-6">
      <SettingsPanel
        initialBrandName={settings.brandName}
        initialSenderEmail={settings.senderEmail}
        initialBrandLogoDataUrl={settings.brandLogoDataUrl}
        initialSuperAdminUserId={settings.superAdminUserId || session.user.id}
        initialSuperAdminName={settings.superAdminName || `${session.user.firstname} ${session.user.lastname}`.trim()}
        initialSuperAdminEmail={settings.superAdminEmail || session.user.email || ""}
        initialMappingManagerFirstname={settings.mappingManagerFirstname}
        initialMappingManagerLastname={settings.mappingManagerLastname}
        initialMappingManagerEmail={settings.mappingManagerEmail}
        initialMappingManagerPhone={settings.mappingManagerPhone}
        initialMappingPortalToken={settings.mappingPortalToken}
        initialUserProfile={profile}
        currentUserId={session.user.id}
        initialGoogleCalendar={{
          configured: isGoogleCalendarConfigured(),
          connected: Boolean(googleAccount),
          calendarEmail: googleAccount?.googleCalendarId || settings.senderEmail,
          status: googleStatus,
          detail: googleDetail
        }}
        workflowSections={workflowSections.map((section) => ({ ...section, items: [...section.items] }))}
      />
    </div>
  );
}
