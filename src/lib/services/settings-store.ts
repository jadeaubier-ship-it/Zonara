import { mkdir, readFile, writeFile } from "fs/promises";
import crypto from "crypto";
import path from "path";

export type AppSettings = {
  brandName: string;
  senderEmail: string;
  brandLogoDataUrl: string;
  superAdminUserId: string;
  superAdminName: string;
  superAdminEmail: string;
  userSignatures: Record<string, string>;
  userProfiles: Record<string, UserProfileSettings>;
  mappingManagerFirstname: string;
  mappingManagerLastname: string;
  mappingManagerEmail: string;
  mappingManagerPhone: string;
  mappingPortalToken: string;
};

export type GoogleCalendarConnection = {
  connected: boolean;
  calendarEmail: string;
};

export type UserProfileSettings = {
  firstname: string;
  lastname: string;
  professionalEmail: string;
  professionalPhone: string;
  professionalRole: string;
  photoDataUrl: string;
};

const SETTINGS_PATH = path.join(process.cwd(), "data", "app-settings.json");

const DEFAULT_SETTINGS: AppSettings = {
  brandName: "Atome3D",
  senderEmail: "franchise@atome3d.com",
  brandLogoDataUrl: "",
  superAdminUserId: "",
  superAdminName: "",
  superAdminEmail: "",
  userSignatures: {},
  userProfiles: {},
  mappingManagerFirstname: "",
  mappingManagerLastname: "",
  mappingManagerEmail: "",
  mappingManagerPhone: "",
  mappingPortalToken: crypto.randomUUID()
};

async function ensureSettingsFile() {
  await mkdir(path.dirname(SETTINGS_PATH), { recursive: true });
  try {
    await readFile(SETTINGS_PATH, "utf8");
  } catch {
    await writeFile(SETTINGS_PATH, JSON.stringify(DEFAULT_SETTINGS, null, 2), "utf8");
  }
}

export async function getAppSettings(): Promise<AppSettings> {
  await ensureSettingsFile();
  try {
    const raw = await readFile(SETTINGS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const legacyMappingName = (parsed as { mappingManagerName?: string }).mappingManagerName?.trim() || "";
    const fallbackFirstname = legacyMappingName ? legacyMappingName.split(/\s+/)[0] ?? "" : "";
    const fallbackLastname = legacyMappingName
      ? legacyMappingName
          .split(/\s+/)
          .slice(1)
          .join(" ")
      : "";
    return {
      brandName: parsed.brandName?.trim() || DEFAULT_SETTINGS.brandName,
      senderEmail: parsed.senderEmail?.trim() || DEFAULT_SETTINGS.senderEmail,
      brandLogoDataUrl: parsed.brandLogoDataUrl?.trim() || "",
      superAdminUserId: parsed.superAdminUserId?.trim() || "",
      superAdminName: parsed.superAdminName?.trim() || "",
      superAdminEmail: parsed.superAdminEmail?.trim() || "",
      userSignatures: parsed.userSignatures ?? {},
      userProfiles: parsed.userProfiles ?? {},
      mappingManagerFirstname: parsed.mappingManagerFirstname?.trim() || fallbackFirstname,
      mappingManagerLastname: parsed.mappingManagerLastname?.trim() || fallbackLastname,
      mappingManagerEmail: parsed.mappingManagerEmail?.trim() || "",
      mappingManagerPhone: parsed.mappingManagerPhone?.trim() || "",
      mappingPortalToken: parsed.mappingPortalToken?.trim() || DEFAULT_SETTINGS.mappingPortalToken
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveAppSettings(nextSettings: AppSettings) {
  await ensureSettingsFile();
  await writeFile(SETTINGS_PATH, JSON.stringify(nextSettings, null, 2), "utf8");
  return nextSettings;
}

export async function updateAppSettings(patch: Partial<AppSettings>) {
  const current = await getAppSettings();
  const next: AppSettings = {
    brandName: patch.brandName?.trim() || current.brandName,
    senderEmail: patch.senderEmail?.trim() || current.senderEmail,
    brandLogoDataUrl:
      patch.brandLogoDataUrl !== undefined ? patch.brandLogoDataUrl.trim() : current.brandLogoDataUrl,
    superAdminUserId:
      patch.superAdminUserId !== undefined ? patch.superAdminUserId.trim() : current.superAdminUserId,
    superAdminName:
      patch.superAdminName !== undefined ? patch.superAdminName.trim() : current.superAdminName,
    superAdminEmail:
      patch.superAdminEmail !== undefined ? patch.superAdminEmail.trim() : current.superAdminEmail,
    userSignatures: patch.userSignatures ?? current.userSignatures,
    userProfiles: patch.userProfiles ?? current.userProfiles,
    mappingManagerFirstname:
      patch.mappingManagerFirstname !== undefined
        ? patch.mappingManagerFirstname.trim()
        : current.mappingManagerFirstname,
    mappingManagerLastname:
      patch.mappingManagerLastname !== undefined
        ? patch.mappingManagerLastname.trim()
        : current.mappingManagerLastname,
    mappingManagerEmail:
      patch.mappingManagerEmail !== undefined ? patch.mappingManagerEmail.trim() : current.mappingManagerEmail,
    mappingManagerPhone:
      patch.mappingManagerPhone !== undefined ? patch.mappingManagerPhone.trim() : current.mappingManagerPhone,
    mappingPortalToken: patch.mappingPortalToken?.trim() || current.mappingPortalToken || DEFAULT_SETTINGS.mappingPortalToken
  };
  return saveAppSettings(next);
}

export function buildDefaultSignature(params: {
  firstname: string;
  lastname: string;
  brandName: string;
  senderEmail: string;
  professionalRole?: string;
  professionalPhone?: string;
  professionalEmail?: string;
}) {
  return [
    `${params.firstname} ${params.lastname}`.trim(),
    params.professionalRole?.trim() || "",
    params.brandName,
    params.professionalEmail?.trim() || params.senderEmail,
    params.professionalPhone?.trim() || ""
  ]
    .filter(Boolean)
    .join("\n");
}

export function resolveUserProfile(params: {
  settings: AppSettings;
  user: {
    id: string;
    firstname: string;
    lastname: string;
    email: string;
    phone?: string | null;
    role: string;
  };
}) {
  const custom = params.settings.userProfiles[params.user.id];
  return {
    firstname: custom?.firstname?.trim() || params.user.firstname,
    lastname: custom?.lastname?.trim() || params.user.lastname,
    professionalEmail: custom?.professionalEmail?.trim() || params.user.email,
    professionalPhone: custom?.professionalPhone?.trim() || params.user.phone || "",
    professionalRole: custom?.professionalRole?.trim() || params.user.role,
    photoDataUrl: custom?.photoDataUrl?.trim() || ""
  };
}
