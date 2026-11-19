import { TripDraft, TripRequest } from '../models/trip.model';

/**
 * Canonical fingerprint of the inputs that affect a quote. Two trips with the same key
 * produce the same quote, so a quote is only shown as valid while the form's key
 * matches the key of the request that produced it.
 *
 * Field order is fixed explicitly so the key never depends on object property order.
 */
export function tripKey(trip: TripDraft | TripRequest): string {
  return JSON.stringify([
    trip.pickup,
    trip.dropOffs,
    trip.truckCategory,
    trip.truckCount,
    trip.cargoWeightTonnes,
    trip.pickupDateTime,
    trip.loadingAssistance,
    trip.unloadingAssistance,
  ]);
}
