import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { Observable, Subject, catchError, filter, map, of, startWith, switchMap } from 'rxjs';

import { tripKey } from '../../core/domain/trip-key';
import { QuoteState } from '../../core/models/quote.model';
import { TripRequest } from '../../core/models/trip.model';
import { QuoteRejectedError, QuoteService } from '../../core/services/quote.service';

type QuoteCommand =
  | { readonly kind: 'request'; readonly requestId: number; readonly request: TripRequest }
  | { readonly kind: 'reset' };

/**
 * Owns the quote state for one planner instance ("latest request wins").
 *
 * - Every request gets a monotonically increasing id.
 * - Requests flow through `switchMap`, so starting a new request unsubscribes from the
 *   previous one: an older response can never overwrite a newer one, even if it would
 *   have finished first, and the pending flag always belongs to the latest request.
 * - As a second, independent guard, any emission whose id is not the latest is dropped.
 * - The resulting state remembers the exact request (and its key) it belongs to, so the
 *   view can refuse to present it as valid once the form no longer matches.
 */
@Injectable()
export class QuoteStore {
  private readonly quoteService = inject(QuoteService);
  private readonly commands = new Subject<QuoteCommand>();
  private latestRequestId = 0;

  private readonly stateSignal = signal<QuoteState>({ status: 'idle' });
  readonly state = this.stateSignal.asReadonly();

  constructor() {
    const subscription = this.commands
      .pipe(switchMap((command) => (command.kind === 'reset' ? of<QuoteState>({ status: 'idle' }) : this.run(command))))
      .subscribe((state) => this.stateSignal.set(state));
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }

  /** Starts a new quote request, superseding any request still in flight. Returns its id. */
  request(trip: TripRequest): number {
    const requestId = ++this.latestRequestId;
    this.commands.next({ kind: 'request', requestId, request: trip });
    return requestId;
  }

  /** Cancels any in-flight request and forgets the current quote. */
  reset(): void {
    this.latestRequestId++;
    this.commands.next({ kind: 'reset' });
  }

  private run(command: Extract<QuoteCommand, { kind: 'request' }>): Observable<QuoteState> {
    const { requestId, request } = command;
    const requestKey = tripKey(request);
    return this.quoteService.getQuote(request).pipe(
      map((breakdown): QuoteState => ({ status: 'success', quote: { requestId, request, requestKey, breakdown } })),
      catchError((error: unknown) =>
        of<QuoteState>({
          status: 'rejected',
          requestId,
          requestKey,
          reasons:
            error instanceof QuoteRejectedError ? error.reasons : ['The quote could not be generated. Please try again.'],
        }),
      ),
      startWith<QuoteState>({ status: 'pending', requestId, request, requestKey }),
      filter(() => requestId === this.latestRequestId),
    );
  }
}
