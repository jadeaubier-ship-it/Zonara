import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { logEvent } from "@/lib/services/event-log";

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;

  const body = (await request.json().catch(() => null)) as { noteText?: string } | null;
  const noteText = body?.noteText?.trim();

  if (!noteText) {
    return NextResponse.json({ error: "Le commentaire est vide." }, { status: 400 });
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id }
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidat introuvable." }, { status: 404 });
  }

  const note = await prisma.noteAdmin.create({
    data: {
      candidateId: params.id,
      authorId: auth.session!.user.id,
      noteText
    },
    include: {
      author: true
    }
  });

  await logEvent({
    actionType: "NOTE_ADDED",
    candidateId: params.id,
    userId: auth.session!.user.id,
    detailsJson: {
      noteText
    }
  });

  return NextResponse.json(note);
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;

  const body = (await request.json().catch(() => null)) as { noteId?: string; noteText?: string } | null;
  const noteId = body?.noteId;
  const noteText = body?.noteText?.trim();

  if (!noteId || !noteText) {
    return NextResponse.json({ error: "Les informations du commentaire sont incomplètes." }, { status: 400 });
  }

  const note = await prisma.noteAdmin.findUnique({
    where: { id: noteId }
  });

  if (!note || note.candidateId !== params.id) {
    return NextResponse.json({ error: "Commentaire introuvable." }, { status: 404 });
  }

  const updatedNote = await prisma.noteAdmin.update({
    where: { id: noteId },
    data: {
      noteText
    },
    include: {
      author: true
    }
  });

  await logEvent({
    actionType: "NOTE_UPDATED",
    candidateId: params.id,
    userId: auth.session!.user.id,
    detailsJson: {
      noteId,
      noteText
    }
  });

  return NextResponse.json(updatedNote);
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;

  const body = (await request.json().catch(() => null)) as { noteId?: string } | null;
  const noteId = body?.noteId;

  if (!noteId) {
    return NextResponse.json({ error: "Commentaire introuvable." }, { status: 400 });
  }

  const note = await prisma.noteAdmin.findUnique({
    where: { id: noteId }
  });

  if (!note || note.candidateId !== params.id) {
    return NextResponse.json({ error: "Commentaire introuvable." }, { status: 404 });
  }

  await prisma.noteAdmin.delete({
    where: { id: noteId }
  });

  await logEvent({
    actionType: "NOTE_DELETED",
    candidateId: params.id,
    userId: auth.session!.user.id,
    detailsJson: {
      noteId,
      deletedNoteText: note.noteText
    }
  });

  return NextResponse.json({ success: true });
}
