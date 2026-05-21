import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import {
  DIP_TEMPLATE_MAIN_TYPE,
  DIP_TEMPLATE_ANNEX_TYPE,
  getDipTemplateDocuments,
  getDipTemplateSettings,
  updateDipTemplateSettings
} from "@/lib/services/dip-template";

async function fileToDataUrl(file: File) {
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  return `data:${file.type};base64,${base64}`;
}

async function readDipTemplate() {
  const [settings, docs] = await Promise.all([getDipTemplateSettings(), getDipTemplateDocuments()]);

  return {
    version: settings.version,
    docusignTemplateId: settings.docusignTemplateId,
    docusignTemplateRoleName: settings.docusignTemplateRoleName,
    mainDocument: docs.mainDocument
      ? {
          id: docs.mainDocument.id,
          fileName: docs.mainDocument.fileName,
          mimeType: docs.mainDocument.mimeType,
          uploadedAt: docs.mainDocument.uploadedAt.toISOString(),
          fileUrl: docs.mainDocument.fileUrl
        }
      : null,
    annexes: docs.annexes.map((attachment) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      uploadedAt: attachment.uploadedAt.toISOString(),
      fileUrl: attachment.fileUrl
    }))
  };
}

export async function GET() {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;

  return NextResponse.json(await readDipTemplate());
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;

  const body = (await request.json().catch(() => null)) as
    | {
        version?: string;
        docusignTemplateId?: string;
        docusignTemplateRoleName?: string;
      }
    | null;

  if (!body) {
    return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  }

  await updateDipTemplateSettings(body);
  return NextResponse.json(await readDipTemplate());
}

export async function POST(request: NextRequest) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;

  const formData = await request.formData();
  const file = formData.get("file");
  const kind = String(formData.get("kind") || "annex");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Fichier invalide." }, { status: 400 });
  }

  const fileUrl = await fileToDataUrl(file);
  const documentType = kind === "main" ? DIP_TEMPLATE_MAIN_TYPE : DIP_TEMPLATE_ANNEX_TYPE;

  if (documentType === DIP_TEMPLATE_MAIN_TYPE) {
    await prisma.document.deleteMany({
      where: {
        candidateId: null,
        type: DIP_TEMPLATE_MAIN_TYPE
      }
    });
  }

  await prisma.document.create({
    data: {
      candidateId: null,
      type: documentType,
      fileUrl,
      fileName: file.name,
      mimeType: file.type || "application/pdf",
      uploadedById: auth.session!.user.id
    }
  });

  return NextResponse.json(await readDipTemplate());
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;

  const url = new URL(request.url);
  const documentId = url.searchParams.get("documentId");

  if (!documentId) {
    return NextResponse.json({ error: "Document introuvable." }, { status: 400 });
  }

  await prisma.document.deleteMany({
    where: {
      id: documentId,
      candidateId: null,
      type: {
        in: [DIP_TEMPLATE_MAIN_TYPE, DIP_TEMPLATE_ANNEX_TYPE]
      }
    }
  });

  return NextResponse.json(await readDipTemplate());
}
