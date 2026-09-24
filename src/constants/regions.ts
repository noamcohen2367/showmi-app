/**
 * Where a user says they live.
 *
 * Kept here rather than in a database constraint, deliberately: this list is
 * far more likely to change than the column that holds it, and every change
 * would otherwise be a migration. `preferred_location` is free text on the
 * server; this is the app's agreement with itself about what goes in it.
 *
 * The values are stored as written. They are the user-facing labels too,
 * which is safe only because the app is Hebrew-only — the moment a second
 * language exists these need stable ids underneath and the Hebrew becomes a
 * translation.
 */
export const REGIONS = ['תל אביב', 'השרון', 'הצפון', 'הדרום', 'ירושלים'] as const;

export type Region = (typeof REGIONS)[number];

export function isRegion(value: string | null | undefined): value is Region {
  return !!value && (REGIONS as readonly string[]).includes(value);
}
