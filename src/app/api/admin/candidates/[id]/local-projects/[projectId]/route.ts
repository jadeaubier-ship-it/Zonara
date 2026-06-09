import { NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { autoAdvanceCandidateFromStep7 } from "@/lib/services/candidate-step-rules";
import { logEvent } from "@/lib/services/event-log";

export async function PATCH(_: Request, { params }: { params: { id: string; projectId: string } }) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;

  const project = await prisma.localProject.findFirst({
    where: {
      id: params.projectId,
      candidateId: params.id
    },
    select: {
      id: true,
      address: true
    }
  });

  if (!project) {
    return NextResponse.json({ error: "Projet de local introuvable." }, { status: 404 });
  }

  await prisma.localProject.update({
    where: { id: params.projectId },
    data: {
      status: "VALIDATED",
      validatedAt: new Date(),
      validatedById: auth.session!.user.id
    }
  });

  await logEvent({
    actionType: "LOCAL_PROJECT_VALIDATED",
    candidateId: params.id,
    userId: auth.session!.user.id,
    detailsJson: {
      localProjectId: params.projectId,
      address: project.address
    }
  });

  await autoAdvanceCandidateFromStep7(params.id, auth.session!.user.id);

  return NextResponse.json({ success: true });
}

export async function DELETE(_: Request, { params }: { params: { id: string; projectId: string } }) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;

  const project = await prisma.localProject.findFirst({
    where: {
      id: params.projectId,
      candidateId: params.id
    },
    select: {
      id: true,
      address: true
    }
  });

  if (!project) {
    return NextResponse.json({ error: "Projet de local introuvable." }, { status: 404 });
  }

  await prisma.localProject.delete({
    where: { id: params.projectId }
  });

  await logEvent({
    actionType: "LOCAL_PROJECT_REJECTED",
    candidateId: params.id,
    userId: auth.session!.user.id,
    detailsJson: {
      localProjectId: params.projectId,
      address: project.address
    }
  });

  return NextResponse.json({ success: true });
}
