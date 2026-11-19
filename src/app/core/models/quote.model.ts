import { LocationId } from './location.model';
import { TripRequest } from './trip.model';

export interface RouteLeg {
  readonly from: LocationId;
  readonly to: LocationId;
  readonly distanceKm: number;
}

/** Result of applying the pricing rules to a trip. All money values are in BDT. */
export interface QuoteBreakdown {
  readonly legs: readonly RouteLeg[];
  readonly distanceKm: number;
  readonly farePerTruck: number;
  /** True when the per-truck minimum fare was charged instead of distance × rate. */
  readonly minimumFareApplied: boolean;
  readonly transportCost: number;
  readonly serviceFeesPerTruck: number;
  readonly serviceCost: number;
  readonly totalQuote: number;
}

/** A quote is always tied to the exact trip inputs that produced it. */
export interface Quote {
  readonly requestId: number;
  readonly request: TripRequest;
  /** Canonical fingerprint of `request`, used to detect when the form no longer matches. */
  readonly requestKey: string;
  readonly breakdown: QuoteBreakdown;
}

/** State of the most recent quote request. */
export type QuoteState =
  | { readonly status: 'idle' }
  | {
      readonly status: 'pending';
      readonly requestId: number;
      readonly request: TripRequest;
      readonly requestKey: string;
    }
  | { readonly status: 'success'; readonly quote: Quote }
  | {
      readonly status: 'rejected';
      readonly requestId: number;
      readonly requestKey: string;
      readonly reasons: readonly string[];
    };
