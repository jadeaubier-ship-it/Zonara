import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { logEvent } from "@/lib/services/event-log";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;
  const session = auth.session!;

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Aucun fichier reçu." }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  const fileUrl = `data:${file.type};base64,${base64}`;

  const existingPhoto = await prisma.document.findFirst({
    where: {
      candidateId: params.id,
      type: "photo_profil"
    },
    orderBy: {
      uploadedAt: "desc"
    }
  });

  if (existingPhoto) {
    await prisma.document.update({
      where: { id: existingPhoto.id },
      data: {
        fileUrl,
        fileName: file.name,
        mimeType: file.type,
        uploadedById: session.user.id
      }
    });
  } else {
    await prisma.document.create({
      data: {
        candidateId: params.id,
        stepNumber: 2,
        type: "photo_profil",
        fileUrl,
        fileName: file.name,
        mimeType: file.type,
        uploadedById: session.user.id
      }
    });
  }

  await logEvent({
    actionType: "CANDIDATE_PHOTO_UPDATED",
    candidateId: params.id,
    userId: session.user.id,
    detailsJson: { fileName: file.name }
  });

  return NextResponse.json({ success: true });
}
