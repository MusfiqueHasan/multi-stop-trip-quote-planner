/** All location IDs the planner knows about. Single source of truth for the union type. */
export const LOCATION_IDS = ['A', 'B', 'C', 'D', 'E'] as const;

export type LocationId = (typeof LOCATION_IDS)[number];

export interface TripLocation {
  readonly id: LocationId;
  readonly name: string;
}

export function isLocationId(value: unknown): value is LocationId {
  return typeof value === 'string' && (LOCATION_IDS as readonly string[]).includes(value);
}
