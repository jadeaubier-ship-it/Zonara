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
    descriptionCandidate: "Choisissez un créneau de visio avec votre interlocuteur Atome3D.",
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
    name: "Projet local",
    descriptionAdmin: "Accord bancaire et dépôt de projets de locaux avec pièces jointes.",
    descriptionCandidate: "Ajoutez votre accord bancaire et au moins un projet de local.",
    requiredDocuments: ["accord_bancaire", "plans_local", "photos_local"]
  },
  {
    stepNumber: 7,
    name: "Pièces société",
    descriptionAdmin: "Contrôle des statuts et du KBIS.",
    descriptionCandidate: "Déposez vos statuts et votre KBIS.",
    requiredDocuments: ["statuts", "kbis"]
  },
  {
    stepNumber: 8,
    name: "Contrat et formation",
    descriptionAdmin: "Choix du contrat, signatures DocuSign puis réservation de la formation.",
    descriptionCandidate: "Signez les documents contractuels et choisissez une session de formation.",
    requiredDocuments: ["contrat_franchise", "plan_3d"]
  },
  {
    stepNumber: 9,
    name: "Devis menuisier",
    descriptionAdmin: "Upload du devis menuisier et envoi automatique au partenaire.",
    descriptionCandidate: "Signez le devis menuisier pour lancer l'aménagement.",
    requiredDocuments: ["devis_menuisier"]
  },
  {
    stepNumber: 10,
    name: "Conversion franchisé",
    descriptionAdmin: "Conversion manuelle du candidat en franchisé et activation du réseau.",
    descriptionCandidate: "Bienvenue dans le réseau Atome3D.",
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
      lastname: "Atome3D",
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
      subject: "Bienvenue dans votre parcours Atome3D",
      bodyText:
        "Bonjour {{firstname}},\n\nVotre dossier est créé. Cliquez sur le lien sécurisé pour démarrer votre onboarding : {{onboardingUrl}}\n\nL'équipe Atome3D",
      bodyHtml:
        "<p>Bonjour {{firstname}},</p><p>Votre dossier est créé. Cliquez sur le lien sécurisé pour démarrer votre onboarding : <a href='{{onboardingUrl}}'>Activer mon espace</a></p><p>L'équipe Atome3D</p>"
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
