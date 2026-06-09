import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { autoAdvanceCandidateFromStep8 } from "@/lib/services/candidate-step-rules";
import { logEvent } from "@/lib/services/event-log";

function toLocalDateTime(dateValue: string, hours: number, minutes: number) {
  const [year, month, day] = dateValue.split("-").map((part) => Number(part));
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;
  const session = auth.session!;

  const body = (await request.json().catch(() => null)) as
    | {
        startDate?: string;
        endDate?: string;
      }
    | null;

  const startDate = body?.startDate?.trim() ?? "";
  const endDate = body?.endDate?.trim() ?? "";

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "Les dates de formation sont obligatoires." }, { status: 400 });
  }

  const startDatetime = toLocalDateTime(startDate, 9, 0);
  const endDatetime = toLocalDateTime(endDate, 17, 0);

  if (Number.isNaN(startDatetime.getTime()) || Number.isNaN(endDatetime.getTime())) {
    return NextResponse.json({ error: "Les dates de formation sont invalides." }, { status: 400 });
  }

  if (endDatetime < startDatetime) {
    return NextResponse.json(
      { error: "La date de fin de formation doit être postérieure à la date de début." },
      { status: 400 }
    );
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id },
    include: {
      documents: {
        where: {
          type: {
            in: ["contrat_reservation_zone", "contrat_definitif"]
          }
        }
      }
    }
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidat introuvable." }, { status: 404 });
  }

  if (candidate.documents.length === 0) {
    return NextResponse.json(
      { error: "Ajoutez d’abord un contrat signé." },
      { status: 409 }
    );
  }

  const appointment = await prisma.$transaction(async (tx) => {
    await tx.appointment.deleteMany({
      where: {
        candidateId: params.id,
        appointmentType: "FORMATION"
      }
    });

    const created = await tx.appointment.create({
      data: {
        candidateId: params.id,
        appointmentType: "FORMATION",
        startDatetime,
        endDatetime,
        status: "CONFIRMED"
      }
    });

    await tx.candidate.update({
      where: { id: params.id },
      data: {
        lastActivityAt: new Date()
      }
    });

    await tx.noteAdmin.create({
      data: {
        candidateId: params.id,
        authorId: session.user.id,
        noteText: `Formation planifiée du ${startDate.split("-").reverse().join("/")} au ${endDate
          .split("-")
          .reverse()
          .join("/")}.`
      }
    });

    return created;
  });

  await logEvent({
    actionType: "TRAINING_DATES_SET",
    candidateId: params.id,
    userId: session.user.id,
    detailsJson: {
      startDate,
      endDate,
      appointmentType: "FORMATION"
    }
  });

  const autoAdvance = await autoAdvanceCandidateFromStep8(params.id, session.user.id);

  return NextResponse.json({
    success: true,
    appointment: {
      id: appointment.id,
      startDatetime: appointment.startDatetime.toISOString(),
      endDatetime: appointment.endDatetime.toISOString(),
      appointmentType: appointment.appointmentType,
      status: appointment.status
    },
    advancedToStep9: autoAdvance.advanced
  });
}
