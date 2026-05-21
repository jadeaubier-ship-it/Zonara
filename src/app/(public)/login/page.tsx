import { LoginForm } from "@/components/public/login-form";
import { getAppSettings } from "@/lib/services/settings-store";

export default async function LoginPage() {
  const settings = await getAppSettings();

  return (
    <main className="min-h-screen bg-white px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-xl items-center justify-center">
        <div className="w-full">
          <div className="mx-auto flex w-full max-w-[170px] justify-center">
            {settings.brandLogoDataUrl ? (
              <img
                src={settings.brandLogoDataUrl}
                alt={settings.brandName || "Enseigne"}
                className="h-auto max-h-[170px] w-full object-contain"
              />
            ) : (
              <img src="/zonara-logo.png" alt="Zonara" className="h-auto w-full object-contain" />
            )}
          </div>

          <LoginForm />
        </div>
      </div>
    </main>
  );
}
