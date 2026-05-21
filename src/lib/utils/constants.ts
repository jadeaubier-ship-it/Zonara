export const APP_NAME = "Zonara";
export const ROLE_REDIRECTS = {
  ADMIN: "/admin/candidates",
  DEV: "/admin/candidates",
  CANDIDATE: "/candidat/dashboard",
  FRANCHISEE: "/franchisee/dashboard"
} as const;

export const STEP_LABELS = [
  "Prise de contact",
  "Dossier de candidature",
  "Visio candidat",
  "Journée découverte",
  "DIP et ELM",
  "Projet local et statuts",
  "Pièces société",
  "Contrat et formation",
  "Devis menuisier",
  "Conversion franchisé"
];

export const STEP_THEMES = [
  {
    solid: "bg-[#6B7280] hover:bg-[#5d6471]",
    soft: "border-[#6B7280] bg-[#6B7280] text-white hover:bg-[#5d6471]",
    badge: "bg-white/20 text-white"
  },
  {
    solid: "bg-[#22C55E] hover:bg-[#1eb154]",
    soft: "border-[#22C55E] bg-[#22C55E] text-white hover:bg-[#1eb154]",
    badge: "bg-white/20 text-white"
  },
  {
    solid: "bg-[#16A34A] hover:bg-[#138f41]",
    soft: "border-[#16A34A] bg-[#16A34A] text-white hover:bg-[#138f41]",
    badge: "bg-white/20 text-white"
  },
  {
    solid: "bg-[#15803D] hover:bg-[#126f35]",
    soft: "border-[#15803D] bg-[#15803D] text-white hover:bg-[#126f35]",
    badge: "bg-white/20 text-white"
  },
  {
    solid: "bg-[#EAB308] hover:bg-[#d19f07]",
    soft: "border-[#EAB308] bg-[#EAB308] text-white hover:bg-[#d19f07]",
    badge: "bg-white/20 text-white"
  },
  {
    solid: "bg-[#CA8A04] hover:bg-[#b57b03]",
    soft: "border-[#CA8A04] bg-[#CA8A04] text-white hover:bg-[#b57b03]",
    badge: "bg-white/20 text-white"
  },
  {
    solid: "bg-[#A16207] hover:bg-[#8f5606]",
    soft: "border-[#A16207] bg-[#A16207] text-white hover:bg-[#8f5606]",
    badge: "bg-white/20 text-white"
  },
  {
    solid: "bg-[#3B82F6] hover:bg-[#3171dd]",
    soft: "border-[#3B82F6] bg-[#3B82F6] text-white hover:bg-[#3171dd]",
    badge: "bg-white/20 text-white"
  },
  {
    solid: "bg-[#2563EB] hover:bg-[#1f56cf]",
    soft: "border-[#2563EB] bg-[#2563EB] text-white hover:bg-[#1f56cf]",
    badge: "bg-white/20 text-white"
  },
  {
    solid: "bg-[#1D4ED8] hover:bg-[#1844be]",
    soft: "border-[#1D4ED8] bg-[#1D4ED8] text-white hover:bg-[#1844be]",
    badge: "bg-white/20 text-white"
  }
] as const;

export function getStepTheme(stepNumber: number) {
  return STEP_THEMES[stepNumber - 1] ?? STEP_THEMES[0];
}
