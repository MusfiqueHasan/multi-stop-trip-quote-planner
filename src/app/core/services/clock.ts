import { Injectable } from '@angular/core';

/**
 * Source of "now". Injected everywhere the current time matters (pickup-time validation,
 * quote-time revalidation) so tests can control time deterministically.
 */
@Injectable({ providedIn: 'root' })
export class Clock {
  now(): Date {
    return new Date();
  }
}
