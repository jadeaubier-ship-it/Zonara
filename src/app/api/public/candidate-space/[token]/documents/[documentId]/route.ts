import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);

  if (!match) {
    return null;
  }

  return {
    mimeType: match[1] || "application/octet-stream",
    buffer: Buffer.from(match[2], "base64")
  };
}

export async function GET(_: Request, { params }: { params: { token: string; documentId: string } }) {
  const candidate = await prisma.candidate.findFirst({
    where: { onboardingToken: params.token },
    select: { id: true }
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidat introuvable." }, { status: 404 });
  }

  const document = await prisma.document.findFirst({
    where: {
      id: params.documentId,
      candidateId: candidate.id
    },
    select: {
      fileUrl: true,
      fileName: true,
      mimeType: true
    }
  });

  if (!document) {
    return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  }

  if (document.fileUrl.startsWith("data:")) {
    const decoded = decodeDataUrl(document.fileUrl);

    if (!decoded) {
      return NextResponse.json({ error: "Document invalide." }, { status: 400 });
    }

    return new NextResponse(decoded.buffer, {
      headers: {
        "Content-Type": document.mimeType || decoded.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(document.fileName)}"`,
        "Cache-Control": "private, no-store"
      }
    });
  }

  return NextResponse.redirect(document.fileUrl);
}
