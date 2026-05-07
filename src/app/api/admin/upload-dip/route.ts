import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiRole } from "@/lib/auth/api";
import { logEvent } from "@/lib/services/event-log";
import { getUploadUrl } from "@/lib/integrations/storage";

export async function POST(request: NextRequest) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;
  const session = auth.session!;

  const body = await request.json();
  const candidateId = String(body.candidateId);
  const fileName = String(body.fileName ?? "dip-elm.pdf");
  const key = `candidates/${candidateId}/step-5/${fileName}`;
  const upload = await getUploadUrl(key, "application/pdf");

  await prisma.document.create({
    data: {
      candidateId,
      stepNumber: 5,
      type: "DIP_ELM",
      fileName,
      fileUrl: key,
      mimeType: "application/pdf",
      uploadedById: session.user.id
    }
  });

  await logEvent({
    actionType: "DIP_UPLOADED",
    candidateId,
    userId: session.user.id,
    detailsJson: { fileName }
  });

  return NextResponse.json(upload);
}
