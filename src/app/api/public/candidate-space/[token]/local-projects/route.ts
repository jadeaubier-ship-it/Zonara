import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { logEvent } from "@/lib/services/event-log";

async function fileToDataUrl(file: File) {
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  return `data:${file.type};base64,${base64}`;
}

function mapProject(project: {
  id: string;
  address: string;
  city: string;
  zipcode: string;
  surfaceM2: number;
  notesCandidate: string | null;
  status: string;
  files: Array<{ id: string; fileType: string }>;
}, token: string) {
  let monthlyRentHt = "";
  let monthlyChargesHt = "";

  if (project.notesCandidate) {
    try {
      const parsed = JSON.parse(project.notesCandidate) as {
        monthlyRentHt?: string;
        monthlyChargesHt?: string;
      };
      monthlyRentHt = parsed.monthlyRentHt ?? "";
      monthlyChargesHt = parsed.monthlyChargesHt ?? "";
    } catch {}
  }

  return {
    id: project.id,
    address: project.address,
    city: project.city,
    zipcode: project.zipcode,
    surfaceM2: project.surfaceM2,
    monthlyRentHt,
    monthlyChargesHt,
    status: project.status,
    files: project.files.map((file) => {
      const [kind, ...nameParts] = file.fileType.split("::");
      const fileName = nameParts.join("::") || (kind === "plan" ? "Plan du local" : "Photo du local");

      return {
        id: file.id,
        kind,
        fileName,
        href: `/api/public/candidate-space/${token}/local-projects/${project.id}/files/${file.id}`
      };
    })
  };
}

export async function POST(request: NextRequest, { params }: { params: { token: string } }) {
  const formData = await request.formData();
  const address = String(formData.get("address") ?? "").trim();
  const zipcode = String(formData.get("zipcode") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const monthlyRentHt = String(formData.get("monthlyRentHt") ?? "").trim();
  const monthlyChargesHt = String(formData.get("monthlyChargesHt") ?? "").trim();
  const planFiles = formData.getAll("plans").filter((entry): entry is File => entry instanceof File);
  const photoFiles = formData.getAll("photos").filter((entry): entry is File => entry instanceof File);

  if (!address || !zipcode || !city) {
    return NextResponse.json(
      { error: "Le nom de rue, le code postal et la ville sont obligatoires." },
      { status: 400 }
    );
  }

  if (!monthlyRentHt || !monthlyChargesHt) {
    return NextResponse.json(
      { error: "Le loyer mensuel HT et les charges mensuelles HT sont obligatoires." },
      { status: 400 }
    );
  }

  if (!planFiles.length || !photoFiles.length) {
    return NextResponse.json(
      { error: "Vous devez joindre au moins un plan et une photo pour créer ce projet." },
      { status: 400 }
    );
  }

  const candidate = await prisma.candidate.findFirst({
    where: { onboardingToken: params.token },
    include: { user: true }
  });

  if (!candidate) {
    return NextResponse.json({ error: "Lien candidat invalide." }, { status: 404 });
  }

  if (candidate.currentStep < 6) {
    return NextResponse.json({ error: "Les projets de local ne sont pas encore attendus." }, { status: 403 });
  }

  const files = await Promise.all([
    ...planFiles.map(async (file) => ({
      fileType: `plan::${file.name}`,
      fileUrl: await fileToDataUrl(file)
    })),
    ...photoFiles.map(async (file) => ({
      fileType: `photo::${file.name}`,
      fileUrl: await fileToDataUrl(file)
    }))
  ]);

  const project = await prisma.localProject.create({
    data: {
      candidateId: candidate.id,
      address,
      city,
      zipcode,
      surfaceM2: 0,
      notesCandidate: JSON.stringify({
        monthlyRentHt,
        monthlyChargesHt
      }),
      status: "SUBMITTED",
      files: {
        create: files
      }
    },
    select: {
      id: true,
      address: true,
      city: true,
      zipcode: true,
      surfaceM2: true,
      notesCandidate: true,
      status: true,
      files: {
        orderBy: { uploadedAt: "desc" },
        select: {
          id: true,
          fileType: true
        }
      }
    }
  });

  await prisma.candidate.update({
    where: { id: candidate.id },
    data: { lastActivityAt: new Date() }
  });

  await logEvent({
    actionType: "CANDIDATE_DOCUMENT_UPDATED",
    candidateId: candidate.id,
    userId: candidate.user.id,
    detailsJson: {
      type: "local_project",
      address,
      zipcode,
      city,
      monthlyRentHt,
      monthlyChargesHt,
      fileCount: files.length,
      source: "candidate-portal"
    }
  });

  return NextResponse.json({
    success: true,
    project: mapProject(project, params.token)
  });
}
