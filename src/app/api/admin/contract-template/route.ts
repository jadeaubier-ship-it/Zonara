import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import {
  CONTRACT_TEMPLATE_DEFINITIVE_TYPE,
  CONTRACT_TEMPLATE_RESERVATION_TYPE,
  getContractTemplateDocuments
} from "@/lib/services/contract-template";

async function fileToDataUrl(file: File) {
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  return `data:${file.type};base64,${base64}`;
}

async function readContractTemplate() {
  const docs = await getContractTemplateDocuments();

  return {
    reservationTemplate: docs.reservationTemplate
      ? {
          id: docs.reservationTemplate.id,
          fileName: docs.reservationTemplate.fileName,
          mimeType: docs.reservationTemplate.mimeType,
          uploadedAt: docs.reservationTemplate.uploadedAt.toISOString(),
          fileUrl: docs.reservationTemplate.fileUrl
        }
      : null,
    definitiveTemplate: docs.definitiveTemplate
      ? {
          id: docs.definitiveTemplate.id,
          fileName: docs.definitiveTemplate.fileName,
          mimeType: docs.definitiveTemplate.mimeType,
          uploadedAt: docs.definitiveTemplate.uploadedAt.toISOString(),
          fileUrl: docs.definitiveTemplate.fileUrl
        }
      : null
  };
}

export async function GET() {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;

  return NextResponse.json(await readContractTemplate());
}

export async function POST(request: NextRequest) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;

  const formData = await request.formData();
  const file = formData.get("file");
  const kind = String(formData.get("kind") || "reservation");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Fichier invalide." }, { status: 400 });
  }

  const fileUrl = await fileToDataUrl(file);
  const documentType =
    kind === "definitive" ? CONTRACT_TEMPLATE_DEFINITIVE_TYPE : CONTRACT_TEMPLATE_RESERVATION_TYPE;

  await prisma.document.deleteMany({
    where: {
      candidateId: null,
      type: documentType
    }
  });

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

  return NextResponse.json(await readContractTemplate());
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
        in: [CONTRACT_TEMPLATE_RESERVATION_TYPE, CONTRACT_TEMPLATE_DEFINITIVE_TYPE]
      }
    }
  });

  return NextResponse.json(await readContractTemplate());
}
