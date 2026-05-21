import { NextRequest, NextResponse } from "next/server";
import { requireApiRole } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import {
  buildDefaultSignature,
  getAppSettings,
  resolveUserProfile
} from "@/lib/services/settings-store";

function getDefaultTemplate(slug: string) {
  if (slug === "candidate-application-invitation") {
    return {
      slug,
      subject: "Suite à votre prise de contact pour la franchise {{brandName}}",
      bodyText:
        "Bonjour {{firstname}},\n\nMerci d'avoir pris contact avec nous concernant le projet de franchise {{brandName}}.\n\nVous trouverez en piece jointe la plaquette de presentation de la franchise, c'est toujours utile.\n\nPour planifier une visio ensemble, il va me falloir quelques informations supplementaires. Il vous suffit de les remplir en suivant ce lien : {{applicationUrl}}\n\nDes qu'il est rempli, vous recevrez un acces a mon agenda pour que vous choisissiez un creneau pour la visio.\n\nAu plaisir !",
      bodyHtml:
        "<p>Bonjour {{firstname}},</p><p>Merci d'avoir pris contact avec nous concernant le projet de franchise {{brandName}}.</p><p>Vous trouverez en piece jointe la plaquette de presentation de la franchise, c'est toujours utile.</p><p>Pour planifier une visio ensemble, il va me falloir quelques informations supplementaires. Il vous suffit de les remplir en suivant ce lien : <a href='{{applicationUrl}}'>Completer mon dossier</a></p><p>Des qu'il est rempli, vous recevrez un acces a mon agenda pour que vous choisissiez un creneau pour la visio.</p><p>Au plaisir !</p>",
      isActive: true
    };
  }

  if (slug === "candidate-discovery-invitation") {
    return {
      slug,
      subject: "Réservons votre journée découverte {{brandName}}",
      bodyText:
        "Bonjour {{firstname}},\n\nMerci pour notre échange visio.\n\nJe vous propose maintenant de réserver votre journée découverte en suivant ce lien : {{bookingUrl}}\n\nÀ très vite !",
      bodyHtml:
        "<p>Bonjour {{firstname}},</p><p>Merci pour notre échange visio.</p><p>Je vous propose maintenant de réserver votre journée découverte en suivant ce lien : <a href='{{bookingUrl}}'>Réserver ma journée découverte</a></p><p>À très vite !</p>",
      isActive: true
    };
  }

  if (slug === "candidate-discovery-feedback") {
    return {
      slug,
      subject: "Merci pour votre venue chez {{brandName}}",
      bodyText:
        "Bonjour {{firstname}},\n\nMerci d'être venu à votre journée découverte hier.\n\nPour la suite du parcours, merci de remplir ce court retour : {{feedbackUrl}}\n\nAu plaisir !",
      bodyHtml:
        "<p>Bonjour {{firstname}},</p><p>Merci d'être venu à votre journée découverte hier.</p><p>Pour la suite du parcours, merci de remplir ce court retour : <a href='{{feedbackUrl}}'>Remplir mon retour</a></p><p>Au plaisir !</p>",
      isActive: true
    };
  }

  if (slug === "mapping-manager-notification") {
    return {
      slug,
      subject: "Nouveau candidat à contacter pour le mapping {{brandName}}",
      bodyText:
        "Bonjour {{mappingManagerFirstname}},\n\nLe candidat {{candidateFullName}} va vous contacter pour échanger sur son projet de franchise pour la zone de {{projectZone}} {{projectZipcode}}.\n\nVoici ses coordonnées :\n{{candidateEmail}}\n{{candidatePhone}}\n\nTéléphone du responsable mapping : {{mappingManagerPhone}}",
      bodyHtml:
        "<p>Bonjour {{mappingManagerFirstname}},</p><p>Le candidat <strong>{{candidateFullName}}</strong> va vous contacter pour échanger sur son projet de franchise pour la zone de <strong>{{projectZone}} {{projectZipcode}}</strong>.</p><p>Voici ses coordonnées :</p><p>{{candidateEmail}}<br/>{{candidatePhone}}</p><p>Téléphone du responsable mapping : {{mappingManagerPhone}}</p>",
      isActive: true
    };
  }

  if (slug === "dip-ready-notification") {
    return {
      slug,
      subject: "Le DIP de {{candidateFullName}} pour {{projectZone}} est prêt à être envoyé",
      bodyText:
        "Bonjour {{firstname}},\n\nLe DIP de {{candidateFullName}} pour {{projectZone}} est prêt à être envoyé.\n\nVous pouvez le relire, le compléter et le valider ici : {{dipPreparationUrl}}\n\nLes ELM du candidat y sont déjà rattachés en annexe.\n\nUne fois validé, le DIP préparé sera figé et ne devra plus être modifié avant l'envoi DocuSign.",
      bodyHtml:
        "<p>Bonjour {{firstname}},</p><p>Le DIP de <strong>{{candidateFullName}}</strong> pour <strong>{{projectZone}}</strong> est prêt à être envoyé.</p><p>Vous pouvez le relire, le compléter et le valider ici : <a href='{{dipPreparationUrl}}'>Ouvrir la préparation du DIP</a></p><p>Les ELM du candidat y sont déjà rattachés en annexe.</p><p>Une fois validé, le DIP préparé sera figé et ne devra plus être modifié avant l'envoi DocuSign.</p>",
      isActive: true
    };
  }

  if (slug === "candidate-local-project-opened") {
    return {
      slug,
      subject: "Votre espace candidat {{brandName}} a été mis à jour",
      bodyText:
        "Bonjour {{firstname}},\n\nLe délai légal lié au DIP est maintenant terminé.\n\nVotre espace a été mis à jour afin de télécharger les différents éléments permettant d’étudier l’ouverture de votre agence {{brandName}}.\n\nVous pouvez y déposer vos projets de locaux, vos plans, votre business plan et vos premières pièces société.\n\nÀ très vite !",
      bodyHtml:
        "<p>Bonjour {{firstname}},</p><p>Le délai légal lié au DIP est maintenant terminé.</p><p>Votre espace a été mis à jour afin de télécharger les différents éléments permettant d’étudier l’ouverture de votre agence <strong>{{brandName}}</strong>.</p><p>Vous pouvez y déposer vos projets de locaux, vos plans, votre business plan et vos premières pièces société.</p><p>À très vite !</p>",
      isActive: true
    };
  }

  return {
    slug,
    subject: "Votre dossier est complet, planifions notre visio {{brandName}}",
    bodyText:
      "Bonjour {{firstname}},\n\nMerci d'avoir pris le temps de completer votre dossier de candidature pour la franchise {{brandName}}.\n\nJe vous invite maintenant a reserver le creneau de visio qui vous convient en suivant ce lien : {{bookingUrl}}\n\nCette visio nous permettra d'echanger sur votre projet et de repondre a vos questions.\n\nAu plaisir !",
    bodyHtml:
      "<p>Bonjour {{firstname}},</p><p>Merci d'avoir pris le temps de completer votre dossier de candidature pour la franchise {{brandName}}.</p><p>Je vous invite maintenant a reserver le creneau de visio qui vous convient en suivant ce lien : <a href='{{bookingUrl}}'>Reserver ma visio</a></p><p>Cette visio nous permettra d'echanger sur votre projet et de repondre a vos questions.</p><p>Au plaisir !</p>",
    isActive: true
  };
}

async function fileToDataUrl(file: File) {
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");
  return `data:${file.type};base64,${base64}`;
}

async function readTemplate(slug: string, currentUserId?: string) {
  const [template, attachments, settings] = await Promise.all([
    prisma.emailTemplate.findUnique({ where: { slug } }),
    prisma.document.findMany({
      where: { type: `email_template_${slug}` },
      orderBy: { uploadedAt: "desc" }
    }),
    getAppSettings()
  ]);
  const currentUser = currentUserId
    ? await prisma.user.findUnique({
        where: { id: currentUserId }
      })
    : null;

  const resolvedTemplate = template ?? getDefaultTemplate(slug);
  const currentProfile = currentUser
    ? resolveUserProfile({
        settings,
        user: {
          id: currentUser.id,
          firstname: currentUser.firstname,
          lastname: currentUser.lastname,
          email: currentUser.email,
          phone: currentUser.phone,
          role: currentUser.role
        }
      })
    : {
        firstname: "Prénom",
        lastname: "Nom",
        professionalEmail: settings.senderEmail,
        professionalPhone: "",
        professionalRole: "Votre rôle",
        photoDataUrl: ""
      };
  const currentSignature = buildDefaultSignature({
    firstname: currentProfile.firstname,
    lastname: currentProfile.lastname,
    brandName: settings.brandName,
    senderEmail: settings.senderEmail,
    professionalRole: currentProfile.professionalRole,
    professionalPhone: currentProfile.professionalPhone,
    professionalEmail: currentProfile.professionalEmail
  });

  const sanitizeForEditor = (value: string, type: "subject" | "text" | "html") => {
    let next = value.replaceAll("Zonara", settings.brandName).replaceAll("Atome3D", settings.brandName);

    if (type === "text") {
      next = next.replace(/\n\s*L'équipe\s+[^\n]+\s*$/i, "");
      next = next.replace(/\n\s*Prénom Nom\s*\n[\s\S]*$/i, "");
      next = next.replace(/\n\s*L'equipe\s+[^\n]+\s*$/i, "");
      next = next.trim();
    }

    if (type === "html") {
      next = next.replace(/<p>\s*L'équipe\s+.*?<\/p>/gi, "");
      next = next.replace(/<p>\s*Prénom Nom\s*<\/p>[\s\S]*$/i, "");
      next = next.replace(/<p>\s*L'equipe\s+.*?<\/p>/gi, "");
      next = next.trim();
    }

    return next;
  };

  return {
    slug,
    subject: sanitizeForEditor(resolvedTemplate.subject, "subject"),
    bodyText: sanitizeForEditor(resolvedTemplate.bodyText, "text"),
    bodyHtml: sanitizeForEditor(resolvedTemplate.bodyHtml, "html"),
    isActive: resolvedTemplate.isActive,
    transportConfigured: Boolean(process.env.RESEND_API_KEY || (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)),
    signaturePreview: currentSignature,
    signatureProfile: currentProfile,
    brandName: settings.brandName,
    attachments: attachments.map((attachment) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      uploadedAt: attachment.uploadedAt.toISOString(),
      fileUrl: attachment.fileUrl
    }))
  };
}

export async function GET(_: NextRequest, { params }: { params: { slug: string } }) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;

  return NextResponse.json(await readTemplate(params.slug, auth.session!.user.id));
}

export async function PATCH(request: NextRequest, { params }: { params: { slug: string } }) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;

  const body = (await request.json()) as {
    subject?: string;
    bodyText?: string;
    bodyHtml?: string;
    isActive?: boolean;
  };

  const fallback = getDefaultTemplate(params.slug);
  const settings = await getAppSettings();
  const stripManualSignature = (value: string, type: "text" | "html") => {
    let next = value;

    if (type === "text") {
      next = next.replace(/\n\s*L'équipe\s+[^\n]+\s*$/i, "");
      next = next.replace(/\n\s*L'equipe\s+[^\n]+\s*$/i, "");
      next = next.trim();
    }

    if (type === "html") {
      next = next.replace(/<p>\s*L'équipe\s+.*?<\/p>/gi, "");
      next = next.replace(/<p>\s*L'equipe\s+.*?<\/p>/gi, "");
      next = next.trim();
    }

    return next.replaceAll(settings.brandName, "{{brandName}}");
  };

  await prisma.emailTemplate.upsert({
    where: { slug: params.slug },
    update: {
      subject: (body.subject?.trim() || fallback.subject).replaceAll(settings.brandName, "{{brandName}}"),
      bodyText: stripManualSignature(body.bodyText ?? fallback.bodyText, "text"),
      bodyHtml: stripManualSignature(body.bodyHtml ?? fallback.bodyHtml, "html"),
      isActive: body.isActive ?? true
    },
    create: {
      slug: params.slug,
      subject: (body.subject?.trim() || fallback.subject).replaceAll(settings.brandName, "{{brandName}}"),
      bodyText: stripManualSignature(body.bodyText ?? fallback.bodyText, "text"),
      bodyHtml: stripManualSignature(body.bodyHtml ?? fallback.bodyHtml, "html"),
      isActive: body.isActive ?? true
    }
  });

  return NextResponse.json(await readTemplate(params.slug, auth.session!.user.id));
}

export async function POST(request: NextRequest, { params }: { params: { slug: string } }) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: "Fichier introuvable." }, { status: 400 });
  }

  const fileUrl = await fileToDataUrl(file);

  await prisma.document.create({
    data: {
      type: `email_template_${params.slug}`,
      fileUrl,
      fileName: file.name,
      mimeType: file.type,
      uploadedById: auth.session!.user.id
    }
  });

  return NextResponse.json(await readTemplate(params.slug, auth.session!.user.id));
}

export async function DELETE(request: NextRequest, { params }: { params: { slug: string } }) {
  const auth = await requireApiRole(["ADMIN", "DEV"]);
  if (auth.unauthorized) return auth.unauthorized;

  const attachmentId = new URL(request.url).searchParams.get("attachmentId");
  if (!attachmentId) {
    return NextResponse.json({ error: "Piece jointe introuvable." }, { status: 400 });
  }

  await prisma.document.deleteMany({
    where: {
      id: attachmentId,
      type: `email_template_${params.slug}`
    }
  });

  return NextResponse.json(await readTemplate(params.slug, auth.session!.user.id));
}
