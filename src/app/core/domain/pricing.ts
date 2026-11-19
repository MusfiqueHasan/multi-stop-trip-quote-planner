import { SERVICE_FEES, getTruckCategory } from '../data/trucks.data';
import { QuoteBreakdown } from '../models/quote.model';
import { TripRequest } from '../models/trip.model';
import { ServiceFees } from '../models/truck.model';
import { routeLegs } from './route-distance';

/**
 * Applies the pricing rules to a (validated) trip. Pure and synchronous —
 * the asynchronous behaviour lives in QuoteService, not here.
 *
 *   distanceKm     = sum(consecutiveRouteDistances)
 *   farePerTruck   = max(distanceKm * ratePerKm, minimumFare)
 *   transportCost  = farePerTruck * truckCount
 *   serviceCost    = selectedServiceFeesPerTruck * truckCount
 *   totalQuote     = transportCost + serviceCost
 */
export function calculateQuote(trip: TripRequest, fees: ServiceFees = SERVICE_FEES): QuoteBreakdown {
  const category = getTruckCategory(trip.truckCategory);
  const legs = routeLegs([trip.pickup, ...trip.dropOffs]);
  const distanceKm = legs.reduce((sum, leg) => sum + leg.distanceKm, 0);

  const distanceFare = distanceKm * category.ratePerKm;
  const farePerTruck = Math.max(distanceFare, category.minimumFarePerTruck);
  const transportCost = farePerTruck * trip.truckCount;

  const serviceFeesPerTruck =
    (trip.loadingAssistance ? fees.loadingPerTruck : 0) +
    (trip.unloadingAssistance ? fees.unloadingPerTruck : 0);
  const serviceCost = serviceFeesPerTruck * trip.truckCount;

  return {
    legs,
    distanceKm,
    farePerTruck,
    minimumFareApplied: distanceFare < category.minimumFarePerTruck,
    transportCost,
    serviceFeesPerTruck,
    serviceCost,
    totalQuote: transportCost + serviceCost,
  };
}
