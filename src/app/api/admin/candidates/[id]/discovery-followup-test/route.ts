import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { sendDiscoveryFollowupAndMappingEmail } from "@/lib/services/discovery-workflow";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;

  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id },
    include: {
      appointments: {
        where: {
          appointmentType: "DISCOVERY_DAY"
        },
        orderBy: { startDatetime: "desc" }
      }
    }
  });

  if (!candidate) {
    return NextResponse.json({ error: "Candidat introuvable." }, { status: 404 });
  }

  const appointment = candidate.appointments[0];

  const result = await sendDiscoveryFollowupAndMappingEmail({
    candidateId: candidate.id,
    appointmentId: appointment?.id ?? `test-discovery-${candidate.id}-${Date.now()}`,
    actorUserId: auth.session?.user.id,
    forceTest: true
  });

  if (!result.sent) {
    return NextResponse.json(
      { error: "Impossible de déclencher le workflow après journée découverte." },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    feedbackUrl: result.feedbackUrl
  });
}
