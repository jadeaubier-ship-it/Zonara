import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
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

export async function GET(
  _: Request,
  { params }: { params: { id: string; projectId: string; fileId: string } }
) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;

  const file = await prisma.localFile.findFirst({
    where: {
      id: params.fileId,
      localProjectId: params.projectId,
      localProject: {
        candidateId: params.id
      }
    },
    select: {
      fileUrl: true,
      fileType: true
    }
  });

  if (!file) {
    return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
  }

  const decoded = decodeDataUrl(file.fileUrl);

  if (!decoded) {
    return NextResponse.json({ error: "Fichier invalide." }, { status: 400 });
  }

  const [, ...nameParts] = file.fileType.split("::");
  const fileName = nameParts.join("::") || "document-local";

  return new NextResponse(decoded.buffer, {
    headers: {
      "Content-Type": decoded.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
      "Cache-Control": "private, no-store"
    }
  });
}
