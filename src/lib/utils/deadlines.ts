export const STEP_DEADLINES: Record<number, number> = {
  1: 2,
  2: 7,
  3: 5,
  4: 4,
  5: 7,
  6: 10,
  7: 7,
  8: 10,
  9: 7,
  10: 5
};

export function getStepDeadlineDays(step: number) {
  return STEP_DEADLINES[step] ?? 7;
}
