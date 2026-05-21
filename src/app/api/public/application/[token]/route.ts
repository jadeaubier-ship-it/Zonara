import { NextRequest, NextResponse } from "next/server";
import {
  buildApplicationFormValues,
  extractApplicationPayload,
  finalizeApplicationIfComplete,
  getCandidateByApplicationToken,
  REQUIRED_APPLICATION_FIELD_KEYS,
  saveApplicationForm
} from "@/lib/services/application-workflow";
import { logEvent } from "@/lib/services/event-log";

export async function GET(_: NextRequest, { params }: { params: { token: string } }) {
  const candidate = await getCandidateByApplicationToken(params.token);

  if (!candidate) {
    return NextResponse.json({ error: "Lien invalide ou expiré." }, { status: 404 });
  }

  return NextResponse.json({
    candidate: {
      id: candidate.id,
      firstname: candidate.user.firstname,
      lastname: candidate.user.lastname
    },
    values: buildApplicationFormValues(candidate)
  });
}

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const candidate = await getCandidateByApplicationToken(params.token);

  if (!candidate) {
    return NextResponse.json({ error: "Lien invalide ou expiré." }, { status: 404 });
  }

  const formData = await request.formData();
  const photo = formData.get("photo");
  const cv = formData.get("cv");
  const payload = extractApplicationPayload(formData);
  const existingHasPhoto = candidate.documents.some((document) => document.type === "photo_profil" && Boolean(document.fileUrl));
  const existingHasCv = candidate.documents.some((document) => document.type === "cv" && Boolean(document.fileUrl));
  const nextHasPhoto = existingHasPhoto || (photo instanceof File && photo.size > 0);
  const nextHasCv = existingHasCv || (cv instanceof File && cv.size > 0);
  const missingRequiredField = REQUIRED_APPLICATION_FIELD_KEYS.find((key) => payload[key].trim().length === 0);

  if (missingRequiredField || !nextHasPhoto || !nextHasCv) {
    return NextResponse.json(
      {
        error: "Merci de remplir tous les champs obligatoires et d'ajouter votre photo ainsi que votre CV avant de valider le dossier."
      },
      { status: 400 }
    );
  }

  await saveApplicationForm({
    candidate,
    payload,
    actorUserId: candidate.userId,
    photo: photo instanceof File && photo.size > 0 ? photo : null,
    cv: cv instanceof File && cv.size > 0 ? cv : null
  });

  try {
    await logEvent({
      actionType: "CANDIDATE_APPLICATION_UPDATED",
      candidateId: candidate.id,
      userId: candidate.userId,
      detailsJson: {
        formData: payload,
        photoUpdated: photo instanceof File && photo.size > 0,
        cvUpdated: cv instanceof File && cv.size > 0,
        source: "public-link"
      } as any
    });
  } catch {
    // Ne bloque pas l'enregistrement si l'historique échoue.
  }

  const completion = await finalizeApplicationIfComplete({
    candidateId: candidate.id,
    actorUserId: candidate.userId
  });

  return NextResponse.json({
    success: true,
    advancedToVisio: completion.advanced,
    bookingUrl: completion.advanced ? completion.bookingUrl : null
  });
}
