import { randomUUID } from "crypto";
import { addDays } from "date-fns";

export function generateOnboardingToken() {
  return randomUUID();
}

export function onboardingExpiration() {
  return addDays(new Date(), 7);
}
