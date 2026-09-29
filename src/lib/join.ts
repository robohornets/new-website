/**
 * Graduation years a student joining now could have: this school year's
 * seniors through next year's incoming freshmen. The school year rolls over
 * in July.
 */
export function joinGraduationYears(now = new Date()): number[] {
  const seniors = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
  return [seniors, seniors + 1, seniors + 2, seniors + 3, seniors + 4];
}

export const JOIN_ABOUT_MAX = 500;
