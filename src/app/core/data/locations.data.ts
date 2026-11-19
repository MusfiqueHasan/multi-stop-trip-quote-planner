import { LocationId, TripLocation } from '../models/location.model';

export const LOCATIONS: readonly TripLocation[] = [
  { id: 'A', name: 'Baily Road' },
  { id: 'B', name: 'Shahbagh' },
  { id: 'C', name: 'Bijoy Sarani' },
  { id: 'D', name: 'Banani' },
  { id: 'E', name: 'Uttara' },
];

const LOCATION_NAMES: Readonly<Record<LocationId, string>> = {
  A: 'Baily Road',
  B: 'Shahbagh',
  C: 'Bijoy Sarani',
  D: 'Banani',
  E: 'Uttara',
};

export function locationName(id: LocationId): string {
  return LOCATION_NAMES[id];
}

/** Unordered pair key, e.g. `pairKey('C', 'A') === 'A-C'`. Distances are symmetric. */
export type LocationPairKey = `${LocationId}-${LocationId}`;

export function pairKey(a: LocationId, b: LocationId): LocationPairKey {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/** Fictional symmetric road distances in kilometres. */
export const ROAD_DISTANCES_KM: Readonly<Partial<Record<LocationPairKey, number>>> = {
  'A-B': 12,
  'A-C': 18,
  'A-D': 26,
  'A-E': 30,
  'B-C': 15,
  'B-D': 29,
  'B-E': 24,
  'C-D': 22,
  'C-E': 28,
  'D-E': 17,
};
