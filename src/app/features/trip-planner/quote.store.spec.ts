import { TestBed, fakeAsync, tick } from '@angular/core/testing';

import { FakeClock, NOW, latencySequence, verificationTrip } from '../../../testing/test-doubles';
import { tripKey } from '../../core/domain/trip-key';
import { QuoteState } from '../../core/models/quote.model';
import { Clock } from '../../core/services/clock';
import { MAX_QUOTE_LATENCY_MS, MIN_QUOTE_LATENCY_MS, QUOTE_LATENCY, QuoteService, randomQuoteLatency } from '../../core/services/quote.service';
import { QuoteStore } from './quote.store';
import { deriveQuoteView } from './quote-view';

/**
 * All timing is controlled with fakeAsync/tick and an injected latency sequence,
 * so these tests never wait for real timeouts.
 */
describe('QuoteStore (latest request wins)', () => {
  let store: QuoteStore;
  let clock: FakeClock;

  function setup(latency: () => number): void {
    clock = new FakeClock(NOW);
    TestBed.configureTestingModule({
      providers: [QuoteStore, { provide: QUOTE_LATENCY, useValue: latency }, { provide: Clock, useValue: clock }],
    });
    store = TestBed.inject(QuoteStore);
  }

  const status = (): QuoteState['status'] => store.state().status;

  it('goes pending → success after the simulated latency', fakeAsync(() => {
    setup(latencySequence(800));

    store.request(verificationTrip());
    expect(status()).toBe('pending');

    tick(799);
    expect(status()).toBe('pending');

    tick(1);
    const state = store.state();
    if (state.status !== 'success') return fail('expected success');
    expect(state.quote.breakdown.totalQuote).toBe(5790);
    expect(state.quote.requestKey).toBe(tripKey(verificationTrip()));
  }));

  it('ignores an older request that finishes after a newer one', fakeAsync(() => {
    setup(latencySequence(1200, 300)); // first request is slow, second is fast
    const older = verificationTrip({ truckCount: 2 });
    const newer = verificationTrip({ truckCount: 3, cargoWeightTonnes: 6 });

    store.request(older);
    const newerId = store.request(newer);

    tick(300); // newer completes first
    let state = store.state();
    if (state.status !== 'success') return fail('expected success');
    expect(state.quote.requestId).toBe(newerId);
    expect(state.quote.request.truckCount).toBe(3);

    tick(900); // older would complete now — it must not overwrite the newer quote
    state = store.state();
    if (state.status !== 'success') return fail('expected success');
    expect(state.quote.requestId).toBe(newerId);
  }));

  it('keeps showing "pending" for the latest request when an older one completes first', fakeAsync(() => {
    setup(latencySequence(300, 1200)); // first request is fast, second is slow
    store.request(verificationTrip({ truckCount: 2 }));
    const latestId = store.request(verificationTrip({ truckCount: 3 }));

    tick(300); // the older request's timer fires — it was superseded, so nothing changes
    const state = store.state();
    expect(state.status).toBe('pending');
    expect(state.status === 'pending' && state.requestId).toBe(latestId);

    tick(900);
    expect(status()).toBe('success');
  }));

  it('reports a rejection when the pickup time has passed by the time the request is made', fakeAsync(() => {
    setup(latencySequence(500));
    clock.set(new Date(2026, 10, 21, 0, 0)); // after the trip's pickup time

    store.request(verificationTrip());
    tick(500);

    const state = store.state();
    if (state.status !== 'rejected') return fail('expected rejected');
    expect(state.reasons).toContain('Pickup date and time must be later than the current time.');
  }));

  it('reset cancels an in-flight request', fakeAsync(() => {
    setup(latencySequence(600));
    store.request(verificationTrip());
    store.reset();
    tick(600);
    expect(status()).toBe('idle');
  }));

  it('never presents a quote as valid for inputs different from those that produced it', fakeAsync(() => {
    setup(latencySequence(400));
    const trip = verificationTrip();
    store.request(trip);

    // The user edits the trip while the request is pending.
    const editedKey = tripKey({ ...trip, cargoWeightTonnes: 4 });
    const view = (currentKey: string) =>
      deriveQuoteView({ state: store.state(), currentKey, formValid: true, invalidAttempt: false, issues: [] });

    expect(view(editedKey)).toEqual({ kind: 'pending', inputsChanged: true });
    tick(400);
    expect(view(editedKey).kind).toBe('outdated');
    expect(view(tripKey(trip)).kind).toBe('ready');

    // Same inputs but no longer valid now (e.g. pickup time passed) → not presented as valid.
    expect(deriveQuoteView({ state: store.state(), currentKey: tripKey(trip), formValid: false, invalidAttempt: false, issues: [] }).kind).toBe('outdated');
  }));
});

describe('QuoteService', () => {
  it('produces latencies within 300–1,200 ms', () => {
    expect(randomQuoteLatency(() => 0)).toBe(MIN_QUOTE_LATENCY_MS);
    expect(randomQuoteLatency(() => 0.999999)).toBe(MAX_QUOTE_LATENCY_MS);
    for (let i = 0; i < 200; i++) {
      const ms = randomQuoteLatency();
      expect(ms).toBeGreaterThanOrEqual(MIN_QUOTE_LATENCY_MS);
      expect(ms).toBeLessThanOrEqual(MAX_QUOTE_LATENCY_MS);
    }
  });

  it('emits nothing until the latency elapses', fakeAsync(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: QUOTE_LATENCY, useValue: () => 700 }, { provide: Clock, useValue: new FakeClock(NOW) }],
    });
    const results: number[] = [];
    TestBed.inject(QuoteService)
      .getQuote(verificationTrip())
      .subscribe((b) => results.push(b.totalQuote));

    tick(699);
    expect(results).toEqual([]);
    tick(1);
    expect(results).toEqual([5790]);
  }));
});
