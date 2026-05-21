import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL ou DIRECT_URL manquante");
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const steps = [
  {
    stepNumber: 1,
    name: "Prise de contact",
    descriptionAdmin: "Création du dossier et envoi du mail d'onboarding avec token unique.",
    descriptionCandidate: "Votre dossier est en cours de création par notre équipe.",
    requiredDocuments: []
  },
  {
    stepNumber: 2,
    name: "Dossier de candidature",
    descriptionAdmin: "Le candidat complète son profil, sa photo et le questionnaire initial.",
    descriptionCandidate: "Complétez votre profil, ajoutez votre photo et répondez au questionnaire.",
    requiredDocuments: ["photo_profil", "questionnaire"]
  },
  {
    stepNumber: 3,
    name: "Visio candidat",
    descriptionAdmin: "Réservation d'un rendez-vous de découverte avec le chargé de développement.",
    descriptionCandidate: "Choisissez un créneau de visio avec votre interlocuteur Zonara.",
    requiredDocuments: []
  },
  {
    stepNumber: 4,
    name: "Journée découverte",
    descriptionAdmin: "Validation ou rejet après visio. Déclenche le paiement Stripe de 45€.",
    descriptionCandidate: "Après la visio, nous vous confirmerons la suite du parcours.",
    requiredDocuments: []
  },
  {
    stepNumber: 5,
    name: "DIP et ELM",
    descriptionAdmin: "Upload du DIP/ELM puis signature DocuSign.",
    descriptionCandidate: "Consultez puis signez le DIP et l'ELM.",
    requiredDocuments: ["dip", "elm"]
  },
  {
    stepNumber: 6,
    name: "Projet local et statuts",
    descriptionAdmin:
      "Le délai légal du DIP est terminé. Le candidat peut déposer ses pistes de locaux, ses plans, son business plan et les premières pièces société.",
    descriptionCandidate:
      "Votre espace a été mis à jour afin de télécharger les différents éléments permettant d’étudier l’ouverture de votre agence Atome3D.",
    requiredDocuments: [
      "plans_local",
      "photos_local",
      "business_plan",
      "statuts",
      "kbis",
      "carte_identite",
      "justificatif_domicile",
      "rib_societe"
    ]
  },
  {
    stepNumber: 7,
    name: "Pièces société",
    descriptionAdmin:
      "Les pièces société deviennent obligatoires. Le candidat doit au minimum fournir ses projets de statuts ou son KBIS définitif, ainsi que les pièces administratives nécessaires.",
    descriptionCandidate:
      "Déposez les pièces administratives et société attendues pour poursuivre votre parcours.",
    requiredDocuments: ["statuts", "kbis", "carte_identite", "justificatif_domicile", "rib_societe"]
  },
  {
    stepNumber: 8,
    name: "Contrat et formation",
    descriptionAdmin:
      "Upload du contrat de réservation ou du contrat définitif, puis planification des dates de formation et notification à l’équipe formation.",
    descriptionCandidate:
      "Consultez les éléments contractuels et vos prochaines dates de formation.",
    requiredDocuments: ["contrat_reservation_zone", "contrat_definitif", "plan_3d_local"]
  },
  {
    stepNumber: 9,
    name: "Devis menuisier",
    descriptionAdmin:
      "Le responsable développement ajoute le plan 3D du local et le devis menuisier. Le candidat renvoie ensuite le devis menuisier signé.",
    descriptionCandidate:
      "Consultez le devis menuisier puis renvoyez le devis signé pour préparer l’aménagement.",
    requiredDocuments: ["plan_3d_local", "devis_menuisier", "devis_menuisier_signe"]
  },
  {
    stepNumber: 10,
    name: "Conversion franchisé",
    descriptionAdmin: "Conversion manuelle du candidat en franchisé et activation du réseau.",
    descriptionCandidate: "Bienvenue dans le réseau Zonara.",
    requiredDocuments: []
  }
];

async function main() {
  const password = await bcrypt.hash("Admin1234!", 12);

  await prisma.user.upsert({
    where: { email: "admin@atome3d.fr" },
    update: {},
    create: {
      email: "admin@atome3d.fr",
      firstname: "Admin",
      lastname: "Zonara",
      password,
      role: "ADMIN"
    }
  });

  for (const step of steps) {
    await prisma.stepConfig.upsert({
      where: { stepNumber: step.stepNumber },
      update: step,
      create: step
    });
  }

  await prisma.emailTemplate.upsert({
    where: { slug: "welcome-candidate" },
    update: {},
    create: {
      slug: "welcome-candidate",
      subject: "Bienvenue dans votre parcours Zonara",
      bodyText:
        "Bonjour {{firstname}},\n\nVotre dossier est créé. Cliquez sur le lien sécurisé pour démarrer votre onboarding : {{onboardingUrl}}\n\nL'équipe Zonara",
      bodyHtml:
        "<p>Bonjour {{firstname}},</p><p>Votre dossier est créé. Cliquez sur le lien sécurisé pour démarrer votre onboarding : <a href='{{onboardingUrl}}'>Activer mon espace</a></p><p>L'équipe Zonara</p>"
    }
  });

  await prisma.emailTemplate.upsert({
    where: { slug: "candidate-application-invitation" },
    update: {},
    create: {
      slug: "candidate-application-invitation",
      subject: "Complétez votre dossier de candidature Zonara",
      bodyText:
        "Bonjour {{firstname}},\n\nVotre dossier de candidature est prêt. Merci de le compléter en suivant ce lien sécurisé : {{applicationUrl}}\n\nL'équipe Zonara",
      bodyHtml:
        "<p>Bonjour {{firstname}},</p><p>Votre dossier de candidature est prêt. Merci de le compléter en suivant ce lien sécurisé : <a href='{{applicationUrl}}'>Compléter mon dossier</a></p><p>L'équipe Zonara</p>"
    }
  });

  await prisma.emailTemplate.upsert({
    where: { slug: "candidate-application-visio" },
    update: {},
    create: {
      slug: "candidate-application-visio",
      subject: "Votre dossier est complet, planifions notre visio {{brandName}}",
      bodyText:
        "Bonjour {{firstname}},\n\nMerci d'avoir pris le temps de completer votre dossier de candidature pour la franchise {{brandName}}.\n\nJe vous invite maintenant a reserver le creneau de visio qui vous convient en suivant ce lien : {{bookingUrl}}\n\nCette visio nous permettra d'echanger sur votre projet et de repondre a vos questions.\n\nAu plaisir !",
      bodyHtml:
        "<p>Bonjour {{firstname}},</p><p>Merci d'avoir pris le temps de completer votre dossier de candidature pour la franchise {{brandName}}.</p><p>Je vous invite maintenant a reserver le creneau de visio qui vous convient en suivant ce lien : <a href='{{bookingUrl}}'>Reserver ma visio</a></p><p>Cette visio nous permettra d'echanger sur votre projet et de repondre a vos questions.</p><p>Au plaisir !</p>"
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
