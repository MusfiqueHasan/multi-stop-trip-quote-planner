import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable, SchedulerLike, asyncScheduler, defer, map, timer } from 'rxjs';

import { calculateQuote } from '../domain/pricing';
import { validateTripRequest } from '../domain/trip-rules';
import { QuoteBreakdown } from '../models/quote.model';
import { TripRequest } from '../models/trip.model';
import { Clock } from './clock';

export const MIN_QUOTE_LATENCY_MS = 300;
export const MAX_QUOTE_LATENCY_MS = 1200;

/** Uniformly random integer latency in [300, 1200] ms. */
export function randomQuoteLatency(random: () => number = Math.random): number {
  const span = MAX_QUOTE_LATENCY_MS - MIN_QUOTE_LATENCY_MS;
  return MIN_QUOTE_LATENCY_MS + Math.floor(random() * (span + 1));
}

/**
 * Supplies the simulated response time for each request. Overridden in tests with a
 * fixed sequence so out-of-order completion can be reproduced deterministically.
 */
export const QUOTE_LATENCY = new InjectionToken<() => number>('QUOTE_LATENCY', {
  providedIn: 'root',
  factory: () => () => randomQuoteLatency(),
});

/**
 * Scheduler used for the simulated delay. Defaults to RxJS's async scheduler (setTimeout),
 * which Angular's fakeAsync/tick controls; a VirtualTimeScheduler can be injected too.
 */
export const QUOTE_SCHEDULER = new InjectionToken<SchedulerLike>('QUOTE_SCHEDULER', {
  providedIn: 'root',
  factory: () => asyncScheduler,
});

/** Thrown (as an Observable error) when the "server" refuses to quote a trip. */
export class QuoteRejectedError extends Error {
  constructor(readonly reasons: readonly string[]) {
    super(`Quote rejected: ${reasons.join(' ')}`);
    this.name = 'QuoteRejectedError';
  }
}

/**
 * Client-side stand-in for a pricing API. Each call is cold and independent: it
 * re-validates the trip against the current time (as a real backend would), waits a
 * variable delay, then emits a single breakdown or errors with QuoteRejectedError.
 *
 * This service deliberately knows nothing about "latest request wins" — that is a UI
 * concern handled by QuoteStore.
 */
@Injectable({ providedIn: 'root' })
export class QuoteService {
  private readonly latency = inject(QUOTE_LATENCY);
  private readonly scheduler = inject(QUOTE_SCHEDULER);
  private readonly clock = inject(Clock);

  getQuote(trip: TripRequest): Observable<QuoteBreakdown> {
    return defer(() => {
      // Validate when the request is received, respond after the simulated latency.
      const problems = validateTripRequest(trip, this.clock.now());
      return timer(this.latency(), this.scheduler).pipe(
        map(() => {
          if (problems.length > 0) {
            throw new QuoteRejectedError(problems);
          }
          return calculateQuote(trip);
        }),
      );
    });
  }
}
