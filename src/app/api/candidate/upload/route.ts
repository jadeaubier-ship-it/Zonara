import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiRole } from "@/lib/auth/api";
import { logEvent } from "@/lib/services/event-log";
import { getUploadUrl } from "@/lib/integrations/storage";

export async function POST(request: NextRequest) {
  const auth = await requireApiRole(["CANDIDATE"]);
  if (auth.unauthorized) return auth.unauthorized;
  const session = auth.session!;

  const contentType = request.headers.get("content-type") ?? "";
  const payload =
    contentType.includes("application/json")
      ? await request.json()
      : Object.fromEntries((await request.formData()).entries());

  const candidate = await prisma.candidate.findFirstOrThrow({
    where: { userId: session.user.id },
    include: { steps: true }
  });

  const stepNumber = Number(payload.stepNumber);
  const step = candidate.steps.find((item) => item.stepNumber === stepNumber);

  if (!step || step.status === "LOCKED") {
    return NextResponse.json({ error: "Étape verrouillée" }, { status: 403 });
  }

  const fileName = String(payload.fileName ?? "document.pdf");
  const type = String(payload.type ?? "UNKNOWN");
  const key = `candidates/${candidate.id}/step-${stepNumber}/${fileName}`;
  const upload = await getUploadUrl(key, "application/pdf");

  await prisma.document.create({
    data: {
      candidateId: candidate.id,
      stepNumber,
      type,
      fileName,
      fileUrl: key,
      mimeType: "application/pdf",
      uploadedById: session.user.id
    }
  });

  await prisma.candidate.update({
    where: { id: candidate.id },
    data: { lastActivityAt: new Date() }
  });

  await logEvent({
    actionType: "CANDIDATE_DOCUMENT_UPLOADED",
    candidateId: candidate.id,
    userId: session.user.id,
    detailsJson: { stepNumber, type, fileName }
  });

  return NextResponse.json(upload);
}
