import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { maybeAdvanceCandidateToDipStep } from "@/lib/services/discovery-workflow";
import { getAppSettings } from "@/lib/services/settings-store";

async function fileToDataUrl(file: File) {
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  return `data:${file.type};base64,${base64}`;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { token: string; candidateId: string } }
) {
  const settings = await getAppSettings();
  if (params.token !== settings.mappingPortalToken) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: "Fichier introuvable." }, { status: 400 });
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id: params.candidateId }
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidat introuvable." }, { status: 404 });
  }

  const uploader =
    candidate.assignedDevId ??
    (
      await prisma.user.findFirst({
        where: { role: { in: ["ADMIN", "DEV"] } },
        orderBy: { createdAt: "asc" }
      })
    )?.id;

  if (!uploader) {
    return NextResponse.json({ error: "Aucun utilisateur interne disponible pour enregistrer l'ELM." }, { status: 500 });
  }

  const document = await prisma.document.create({
    data: {
      candidateId: candidate.id,
      stepNumber: 5,
      type: "elm",
      fileUrl: await fileToDataUrl(file),
      fileName: file.name,
      mimeType: file.type,
      uploadedById: uploader
    }
  });

  await prisma.noteAdmin.create({
    data: {
      candidateId: candidate.id,
      authorId: uploader,
      noteText: "ELM uploadé par le responsable mapping."
    }
  });

  await maybeAdvanceCandidateToDipStep({
    candidateId: candidate.id,
    actorUserId: uploader
  });

  return NextResponse.json({
    success: true,
    document: {
      id: document.id,
      fileName: document.fileName
    }
  });
}
