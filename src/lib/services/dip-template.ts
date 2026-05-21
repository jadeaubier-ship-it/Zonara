import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db/prisma";

export const DIP_TEMPLATE_MAIN_TYPE = "dip_template_main";
export const DIP_TEMPLATE_ANNEX_TYPE = "dip_template_annex";

export type DipTemplateSettings = {
  version: string;
  docusignTemplateId: string;
  docusignTemplateRoleName: string;
};

const DIP_TEMPLATE_PATH = path.join(process.cwd(), "data", "dip-template.json");

const DEFAULT_DIP_TEMPLATE: DipTemplateSettings = {
  version: "2026.1",
  docusignTemplateId: "f63367fa-a6af-4543-91ec-b43c47ee31be",
  docusignTemplateRoleName: "Candidat à la Franchise Atome3D"
};

async function ensureDipTemplateFile() {
  await mkdir(path.dirname(DIP_TEMPLATE_PATH), { recursive: true });
  try {
    await readFile(DIP_TEMPLATE_PATH, "utf8");
  } catch {
    await writeFile(DIP_TEMPLATE_PATH, JSON.stringify(DEFAULT_DIP_TEMPLATE, null, 2), "utf8");
  }
}

export async function getDipTemplateSettings(): Promise<DipTemplateSettings> {
  await ensureDipTemplateFile();
  try {
    const raw = await readFile(DIP_TEMPLATE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<DipTemplateSettings>;
    return {
      version: parsed.version?.trim() || DEFAULT_DIP_TEMPLATE.version,
      docusignTemplateId:
        parsed.docusignTemplateId?.trim() || DEFAULT_DIP_TEMPLATE.docusignTemplateId,
      docusignTemplateRoleName:
        parsed.docusignTemplateRoleName?.trim() || DEFAULT_DIP_TEMPLATE.docusignTemplateRoleName
    };
  } catch {
    return DEFAULT_DIP_TEMPLATE;
  }
}

export async function saveDipTemplateSettings(nextSettings: DipTemplateSettings) {
  await ensureDipTemplateFile();
  await writeFile(DIP_TEMPLATE_PATH, JSON.stringify(nextSettings, null, 2), "utf8");
  return nextSettings;
}

export async function updateDipTemplateSettings(patch: Partial<DipTemplateSettings>) {
  const current = await getDipTemplateSettings();
  return saveDipTemplateSettings({
    version: patch.version?.trim() || current.version,
    docusignTemplateId: patch.docusignTemplateId?.trim() || current.docusignTemplateId,
    docusignTemplateRoleName:
      patch.docusignTemplateRoleName?.trim() || current.docusignTemplateRoleName
  });
}

export async function getDipTemplateDocuments() {
  const documents = await prisma.document.findMany({
    where: {
      candidateId: null,
      type: {
        in: [DIP_TEMPLATE_MAIN_TYPE, DIP_TEMPLATE_ANNEX_TYPE]
      }
    },
    orderBy: [{ uploadedAt: "desc" }, { fileName: "asc" }]
  });

  return {
    mainDocument:
      documents.find((document) => document.type === DIP_TEMPLATE_MAIN_TYPE) ?? null,
    annexes: documents.filter((document) => document.type === DIP_TEMPLATE_ANNEX_TYPE)
  };
}
