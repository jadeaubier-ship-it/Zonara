import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { requireApiRole } from "@/lib/auth/api";
import { createCalendarBooking } from "@/lib/integrations/google-calendar";
import { validateStep } from "@/lib/services/candidate";

export async function POST(request: NextRequest) {
  const auth = await requireApiRole(["CANDIDATE"]);
  if (auth.unauthorized) return auth.unauthorized;
  const session = auth.session!;

  const body = await request.json();
  const candidate = await prisma.candidate.findFirstOrThrow({
    where: { userId: session.user.id },
    include: { steps: true }
  });
  const step = candidate.steps.find((item) => item.stepNumber === 3);

  if (!step || !["AVAILABLE", "PENDING"].includes(step.status)) {
    return NextResponse.json({ error: "Réservation indisponible pour cette étape" }, { status: 403 });
  }

  const start = new Date(body.start);
  const end = new Date(body.end);

  const booking = await createCalendarBooking({
    candidateId: candidate.id,
    start,
    end
  });

  const appointment = await prisma.appointment.create({
    data: {
      candidateId: candidate.id,
      googleEventId: booking.googleEventId,
      appointmentType: "VISIO_DECOUVERTE",
      startDatetime: start,
      endDatetime: end,
      status: "CONFIRMED"
    }
  });

  await validateStep({
    candidateId: candidate.id,
    stepNumber: 3,
    userId: session.user.id
  });

  return NextResponse.json(appointment);
}

export async function GET() {
  return NextResponse.json({ message: "Utilisez POST avec start et end." });
}
