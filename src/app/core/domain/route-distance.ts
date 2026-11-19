import { ROAD_DISTANCES_KM, pairKey } from '../data/locations.data';
import { LocationId } from '../models/location.model';
import { RouteLeg } from '../models/quote.model';

export function distanceBetween(from: LocationId, to: LocationId): number {
  if (from === to) {
    throw new Error(`A route cannot visit ${from} twice in a row.`);
  }
  const distance = ROAD_DISTANCES_KM[pairKey(from, to)];
  if (distance === undefined) {
    throw new Error(`No road distance defined between ${from} and ${to}.`);
  }
  return distance;
}

/**
 * Splits an ordered route (pickup first, then drop-offs in the user's order) into legs.
 * There is no return leg back to the pickup.
 */
export function routeLegs(route: readonly LocationId[]): RouteLeg[] {
  const legs: RouteLeg[] = [];
  for (let i = 1; i < route.length; i++) {
    const from = route[i - 1];
    const to = route[i];
    legs.push({ from, to, distanceKm: distanceBetween(from, to) });
  }
  return legs;
}

export function routeDistanceKm(route: readonly LocationId[]): number {
  return routeLegs(route).reduce((sum, leg) => sum + leg.distanceKm, 0);
}
