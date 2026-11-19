import { getTruckCategory } from '../data/trucks.data';
import { LocationId } from '../models/location.model';
import { MAX_DROP_OFFS, MAX_TRUCKS, MIN_DROP_OFFS, MIN_TRUCKS, TripRequest } from '../models/trip.model';
import { TruckCategoryId } from '../models/truck.model';
import { isStrictlyAfter, parseLocalDateTime } from './date-time';

/**
 * Framework-free business rules. The reactive-form validators and the QuoteService
 * both delegate here so the UI and the "server side" can never disagree.
 */

/** Returns every location ID that appears more than once (empty slots are ignored). */
export function findDuplicateLocations(ids: readonly (LocationId | null)[]): LocationId[] {
  const seen = new Set<LocationId>();
  const duplicates = new Set<LocationId>();
  for (const id of ids) {
    if (id === null) continue;
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  return [...duplicates];
}

export function maxCargoCapacityTonnes(category: TruckCategoryId, truckCount: number): number {
  return getTruckCategory(category).capacityTonnes * truckCount;
}

export function isValidTruckCount(count: number): boolean {
  return Number.isInteger(count) && count >= MIN_TRUCKS && count <= MAX_TRUCKS;
}

export function isPositiveWeight(weight: number): boolean {
  return Number.isFinite(weight) && weight > 0;
}

/**
 * Full validation of a trip request against the current time.
 * Returns human-readable problems; an empty array means the trip can be quoted.
 */
export function validateTripRequest(trip: TripRequest, now: Date): string[] {
  const problems: string[] = [];

  if (trip.dropOffs.length < MIN_DROP_OFFS || trip.dropOffs.length > MAX_DROP_OFFS) {
    problems.push(`A trip needs between ${MIN_DROP_OFFS} and ${MAX_DROP_OFFS} drop-off locations.`);
  }
  if (findDuplicateLocations([trip.pickup, ...trip.dropOffs]).length > 0) {
    problems.push('The same location cannot appear twice in one trip.');
  }
  if (!isValidTruckCount(trip.truckCount)) {
    problems.push(`Truck count must be a whole number between ${MIN_TRUCKS} and ${MAX_TRUCKS}.`);
  }
  if (!isPositiveWeight(trip.cargoWeightTonnes)) {
    problems.push('Cargo weight must be a positive number of tonnes.');
  } else if (
    isValidTruckCount(trip.truckCount) &&
    trip.cargoWeightTonnes > maxCargoCapacityTonnes(trip.truckCategory, trip.truckCount)
  ) {
    problems.push('Cargo weight exceeds the capacity of the selected trucks.');
  }
  if (parseLocalDateTime(trip.pickupDateTime) === null) {
    problems.push('Pickup date and time is not valid.');
  } else if (!isStrictlyAfter(trip.pickupDateTime, now)) {
    problems.push('Pickup date and time must be later than the current time.');
  }

  return problems;
}
