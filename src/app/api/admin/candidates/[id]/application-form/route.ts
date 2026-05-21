import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { logEvent } from "@/lib/services/event-log";
import { extractApplicationPayload, finalizeApplicationIfComplete, saveApplicationForm } from "@/lib/services/application-workflow";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;
  const session = auth.session!;

  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id },
    include: { user: true }
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidat introuvable." }, { status: 404 });
  }

  const formData = await request.formData();
  const photo = formData.get("photo");
  const cv = formData.get("cv");
  const payload = extractApplicationPayload(formData);

  await saveApplicationForm({
    candidate,
    payload,
    actorUserId: session.user.id,
    photo: photo instanceof File && photo.size > 0 ? photo : null,
    cv: cv instanceof File && cv.size > 0 ? cv : null
  });

  try {
    await logEvent({
      actionType: "CANDIDATE_APPLICATION_UPDATED",
      candidateId: params.id,
      userId: session.user.id,
      detailsJson: {
        formData: payload,
        photoUpdated: photo instanceof File && photo.size > 0,
        cvUpdated: cv instanceof File && cv.size > 0
      } as any
    });
  } catch {
    // Ne bloque pas l'enregistrement du dossier si l'historique échoue.
  }

  const completion = await finalizeApplicationIfComplete({
    candidateId: params.id,
    actorUserId: session.user.id
  });

  return NextResponse.json({
    success: true,
    advancedToVisio: completion.advanced,
    bookingUrl: completion.advanced ? completion.bookingUrl : null
  });
}
