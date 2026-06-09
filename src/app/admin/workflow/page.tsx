import { WorkflowBoard } from "@/components/admin/workflow-board";

const mailTransportConfigured = Boolean(
  process.env.RESEND_API_KEY || (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
);
const visioBookingConfigured = Boolean(process.env.GOOGLE_VISIO_BOOKING_URL);
const discoveryBookingConfigured = Boolean(process.env.GOOGLE_DISCOVERY_BOOKING_URL || "https://calendar.app.google/BKDtER5vDyjrNPjeA");

export const workflowSections = [
  {
    title: "Étape 1 -> Dossier de candidature",
    items: [
      {
        label: "Envoi automatique du mail d'invitation quand l'étape passe à Dossier de candidature",
        done: mailTransportConfigured,
        templateSlug: "candidate-application-invitation"
      },
      {
        label: "Génération d'un lien sécurisé vers le dossier de candidature",
        done: true,
        previewHref: "/dossier/apercu"
      }
    ]
  },
  {
    title: "Dossier de candidature",
    items: [
      {
        label: "Page publique du dossier accessible par lien sécurisé",
        done: true
      },
      {
        label: "Préremplissage des informations déjà connues du candidat",
        done: true
      },
      {
        label: "Modification et enregistrement des informations du candidat",
        done: true
      },
      {
        label: "Téléchargement de la photo de profil",
        done: true
      },
      {
        label: "Téléchargement du CV",
        done: true
      },
      {
        label: "Détection d'un dossier entièrement complété",
        done: true
      },
      {
        label: "Passage automatique du candidat à l'étape Visio candidat",
        done: true
      }
    ]
  },
  {
    title: "Mail après complétion du dossier",
    items: [
      {
        label: "Mail unique de remerciement + invitation à réserver la visio",
        done: mailTransportConfigured && visioBookingConfigured,
        templateSlug: "candidate-application-visio"
      },
      {
        label: "Lien de réservation visio configurable depuis l'environnement",
        done: visioBookingConfigured
      },
      {
        label: "Utilisation d'un vrai lien Google Agenda fourni par l'équipe",
        done: visioBookingConfigured
      }
    ]
  },
  {
    title: "Réservation de la visio",
    items: [
      {
        label: "Préparation du système pour créer une note automatique après réservation",
        done: true
      },
      {
        label: "Commentaire CRM automatique avec date et interlocuteur après réservation interne",
        done: true
      },
      {
        label: "Réception automatique d'une réservation Google externe dans le CRM",
        done: true
      },
      {
        label: "Confirmation Google réellement synchronisée avec le CRM",
        done: true
      }
    ]
  },
  {
    title: "Après la visio",
    items: [
      {
        label: "Décision animateur : conserver ou non le candidat",
        done: true
      },
      {
        label: "Mail journée découverte envoyé lors du passage manuel étape 4 → 5",
        done: mailTransportConfigured && discoveryBookingConfigured,
        templateSlug: "candidate-discovery-invitation"
      },
      {
        label: "Réservation Google de la journée découverte détectée dans le CRM",
        done: true
      },
      {
        label: "Commentaire automatique avec date de journée découverte",
        done: true
      },
      {
        label: "Mail J+1 d'invitation au retour de journée découverte",
        done: mailTransportConfigured,
        templateSlug: "candidate-discovery-feedback"
      },
      {
        label: "Formulaire public de retour de journée découverte",
        done: true,
        previewHref: "/retour-journee/apercu"
      },
      {
        label: "Mail automatique au responsable mapping",
        done: mailTransportConfigured,
        templateSlug: "mapping-manager-notification"
      },
      {
        label: "Portail mapping simplifié avec upload ELM",
        done: true
      },
      {
        label: "Passage automatique à DIP & ELM quand feedback + ELM sont présents",
        done: true
      },
      {
        label: "Mail automatique au développeur responsable quand le DIP est prêt à être préparé",
        done: mailTransportConfigured,
        templateSlug: "dip-ready-notification"
      },
      {
        label: "Page de préparation du DIP avec annexes ELM et verrouillage après validation",
        done: true
      }
    ]
  },
  {
    title: "DIP via DocuSign",
    items: [
      {
        label: "DIP, annexes et modèle DocuSign",
        done: true,
        dipTemplate: "config"
      },
      {
        label: "Bouton “Envoyer le DIP” dans la fiche candidat",
        done: true
      },
      {
        label: "Vérifications bloquantes avant envoi du DIP",
        done: true
      },
      {
        label: "Création de l’enveloppe DocuSign à partir du modèle d’accusé + DIP + annexes + ELM",
        done: true
      },
      {
        label: "Stockage complet de la transmission DIP en base",
        done: true
      },
      {
        label: "Email DocuSign de remise du DIP au candidat",
        done: true
      },
      {
        label: "Webhook DocuSign sécurisé pour suivre les statuts de l’enveloppe",
        done: false
      },
      {
        label: "Mise à jour automatique des statuts principaux : envoyé et signé",
        done: true
      },
      {
        label: "Mise à jour complète des statuts secondaires : consulté, refusé, expiré, annulé",
        done: false
      },
      {
        label: "Récupération automatique du PDF signé",
        done: true
      },
      {
        label: "Récupération automatique du certificat et de l’audit trail",
        done: false
      },
      {
        label: "Calcul automatique de la fin du délai légal de 20 jours",
        done: true
      },
      {
        label: "Blocage légal du contrat, des paiements et des validations avant la fin du délai",
        done: false
      },
      {
        label: "Bloc DIP dans la fiche candidat avec statuts, dates et documents probatoires",
        done: true
      },
      {
        label: "Action “Renvoyer” depuis l’interface",
        done: true
      },
      {
        label: "Action “Annuler l’enveloppe” depuis l’interface",
        done: false
      },
      {
        label: "Archivage probatoire non supprimable des preuves de remise du DIP",
        done: false
      }
    ]
  },
  {
    title: "Après le délai légal du DIP",
    items: [
      {
        label: "Passage automatique à l’étape Projet local et statuts 20 jours après signature de réception du DIP",
        done: true
      },
      {
        label: "Mail automatique au candidat pour l’ouverture du dépôt des éléments local + société",
        done: mailTransportConfigured,
        templateSlug: "candidate-local-project-opened"
      },
      {
        label: "Documents attendus visibles dès l’étape Projet local et statuts",
        done: true
      }
    ]
  },
  {
    title: "Projet local et statuts → Pièces société",
    items: [
      {
        label: "Étape 6 renommée en Projet local et statuts",
        done: true
      },
      {
        label: "Pièces facultatives à l’étape 6 : plans 2D, photos du local, business plan, statuts, KBIS, pièce d’identité, justificatif de domicile, RIB société",
        done: true
      },
      {
        label: "Bloc Local dédié côté candidat avec création de dossiers par adresse, plans, photos, loyer HT et charges HT",
        done: true
      },
      {
        label: "Validation / invalidation d’un projet de local côté développeur avec remontée du statut côté candidat",
        done: true
      },
      {
        label: "Documents déjà reçus repliables et documents futurs masqués/affichables selon l’étape",
        done: true
      },
      {
        label: "Étape 7 Pièces société dédiée à la validation obligatoire des pièces administratives",
        done: true
      },
      {
        label: "Passage manuel de l’étape 6 à l’étape 7 par le développeur",
        done: false
      },
      {
        label: "Blocage intelligent à l’étape 7 tant que les pièces minimales obligatoires ne sont pas présentes",
        done: false
      },
      {
        label: "Passage automatique à Contrat et formation quand toutes les pièces requises sont validées",
        done: false
      }
    ]
  },
  {
    title: "Contrat et formation",
    items: [
      {
        label: "Document “Contrat à envoyer” dans la fiche candidat avec téléchargement des modèles PDF",
        done: true,
        contractTemplate: "config"
      },
      {
        label: "Upload du contrat de réservation signé et/ou du contrat définitif signé dans une modale dédiée",
        done: true
      },
      {
        label: "Statut contrat en vert seulement quand le contrat définitif signé est présent",
        done: true
      },
      {
        label: "Définition des dates de formation dès qu’un contrat est présent",
        done: true
      },
      {
        label: "Mail automatique à la team formation avec planning PDF",
        done: false
      },
      {
        label: "Passage automatique à Devis menuisier dès que les dates de formation sont choisies",
        done: false
      }
    ]
  },
  {
    title: "Devis menuisier → Conversion franchisé",
    items: [
      {
        label: "Compte à rebours de formation visible dans la fiche candidat",
        done: false
      },
      {
        label: "Mail automatique au responsable franchise deux semaines avant la formation avec checklist",
        done: false
      },
      {
        label: "Documents plan 3D du local et devis menuisier visibles côté développement",
        done: true
      },
      {
        label: "Upload du devis menuisier signé par le candidat depuis son espace",
        done: false
      },
      {
        label: "Envoi automatique du devis menuisier signé au menuisier en pièce jointe",
        done: false
      },
      {
        label: "Passage automatique en franchisé quand la formation est terminée et le contrat définitif uploadé",
        done: false
      }
    ]
  }
] as const;

export default function AdminWorkflowPage() {
  return <WorkflowBoard sections={workflowSections.map((section) => ({ ...section, items: [...section.items] }))} />;
}
