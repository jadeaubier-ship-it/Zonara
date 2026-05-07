# Atome3D CRM Franchise

Application full-stack Next.js 14 pour le recrutement de franchisés Atome3D.

## Stack

- Next.js 14 App Router + TypeScript
- PostgreSQL / Supabase
- Prisma 7 avec adaptateur `@prisma/adapter-pg`
- NextAuth.js v4 avec JWT et credentials
- Tailwind CSS
- Stripe, DocuSign, Google Calendar, Nodemailer/Resend, Cloudflare R2

## Démarrage

1. Copier `.env.example` vers `.env`.
2. Installer les dépendances avec `npm install`.
3. Générer Prisma: `npm run prisma:generate`
4. Appliquer la base: `npx prisma migrate dev --name init`
5. Seeder: `npm run prisma:seed`
6. Lancer: `npm run dev`

## Compte seed

- Email: `admin@atome3d.fr`
- Mot de passe: `Admin1234!`

## Fonctions incluses

- Authentification 4 rôles et redirection post-login
- CRM admin avec pipeline, fiche candidat, carte réseau et paramètres
- Espace candidat avec timeline verrouillée 10 étapes
- Espace franchisé avec KPI et documents
- API routes pour candidats, validations, uploads, calendrier, DocuSign, Stripe, carte
- Automatisation quotidienne pour relances et inactivité
- Seed des 10 étapes du workflow et de l'admin principal
