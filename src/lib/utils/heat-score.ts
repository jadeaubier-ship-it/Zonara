import { HeatScore } from "@prisma/client";

export function computeHeatScore(step: number, inactivityDays: number) {
  let score: HeatScore = step >= 6 ? "HOT" : step >= 3 ? "MEDIUM" : "COLD";

  if (inactivityDays > 14) {
    score = score === "HOT" ? "MEDIUM" : "COLD";
  }

  return score;
}
