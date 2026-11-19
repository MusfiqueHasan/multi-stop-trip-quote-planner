import { TestBed } from '@angular/core/testing';

import { FakeClock, MemoryStorage, NOW } from '../../../testing/test-doubles';
import { EMPTY_TRIP_DRAFT, TripDraft } from '../models/trip.model';
import { Clock } from '../services/clock';
import { parseStoredDraft } from './draft-sanitizer';
import { DRAFT_STORAGE, DRAFT_STORAGE_KEY, DraftStorageService } from './draft-storage.service';

const stored = (trip: Record<string, unknown>, extra: Record<string, unknown> = {}) =>
  JSON.stringify({ version: 1, savedAt: NOW.toISOString(), trip, ...extra });

describe('draft restore sanitising', () => {
  it('treats missing data as "no draft"', () => {
    expect(parseStoredDraft(null)).toEqual({ status: 'none' });
    expect(parseStoredDraft('')).toEqual({ status: 'none' });
  });

  it('discards invalid JSON and unrecognised shapes instead of throwing', () => {
    expect(parseStoredDraft('{not json').status).toBe('discarded');
    expect(parseStoredDraft('42').status).toBe('discarded');
    expect(parseStoredDraft('[]').status).toBe('discarded');
    expect(parseStoredDraft(JSON.stringify({ version: 99, trip: {} })).status).toBe('discarded');
    expect(parseStoredDraft(JSON.stringify({ version: 1, trip: 'nope' })).status).toBe('discarded');
  });

  it('clears wrong types, unknown IDs and out-of-range numbers field by field', () => {
    const result = parseStoredDraft(
      stored({
        pickup: 'Z',
        dropOffs: ['B', 7, 'Q'],
        truckCategory: 'jumbo',
        truckCount: 9,
        cargoWeightTonnes: '5',
        pickupDateTime: 'tomorrow',
        loadingAssistance: 'yes',
        unloadingAssistance: true,
      }),
    );

    if (result.status !== 'restored') return fail('expected restored');
    expect(result.draft).toEqual({
      pickup: null,
      dropOffs: ['B'],
      truckCategory: null,
      truckCount: null,
      cargoWeightTonnes: null,
      pickupDateTime: null,
      loadingAssistance: false,
      unloadingAssistance: true,
    });
    expect(result.issues.length).toBe(8);
  });

  it('removes duplicate locations (including a drop-off equal to the pickup) and caps drop-offs at 3', () => {
    const result = parseStoredDraft(stored({ pickup: 'A', dropOffs: ['A', 'B', 'B', 'C', 'D', 'E'] }));

    if (result.status !== 'restored') return fail('expected restored');
    expect(result.draft.pickup).toBe('A');
    expect(result.draft.dropOffs).toEqual(['B', 'C', 'D']);
    expect(result.issues.join(' ')).toContain('Duplicate location A');
    expect(result.issues.join(' ')).toContain('Duplicate location B');
  });

  it('rejects truck counts that are non-integers or outside 1–5', () => {
    for (const truckCount of [0, 6, -1, 2.5, '3', true]) {
      const result = parseStoredDraft(stored({ truckCount }));
      if (result.status !== 'restored') return fail('expected restored');
      expect(result.draft.truckCount).withContext(String(truckCount)).toBeNull();
    }
  });

  it('keeps incomplete drafts, including empty drop-off slots and past dates (revalidated later by the form)', () => {
    const result = parseStoredDraft(stored({ pickup: 'C', dropOffs: [null, 'E'], pickupDateTime: '2020-01-01T08:00' }));

    if (result.status !== 'restored') return fail('expected restored');
    expect(result.draft.dropOffs).toEqual([null, 'E']);
    expect(result.draft.pickupDateTime).toBe('2020-01-01T08:00');
    expect(result.issues).toEqual([]);
  });
});

describe('DraftStorageService', () => {
  let storage: MemoryStorage;
  let service: DraftStorageService;

  beforeEach(() => {
    storage = new MemoryStorage();
    TestBed.configureTestingModule({
      providers: [
        { provide: DRAFT_STORAGE, useValue: storage },
        { provide: Clock, useValue: new FakeClock(NOW) },
      ],
    });
    service = TestBed.inject(DraftStorageService);
  });

  it('round-trips an incomplete draft and clears it', () => {
    const draft: TripDraft = { ...EMPTY_TRIP_DRAFT, pickup: 'B', dropOffs: [null, 'D'], cargoWeightTonnes: 2 };

    expect(service.save(draft)).toEqual({ ok: true, savedAt: NOW });
    expect(service.load()).toEqual({ status: 'restored', draft, savedAt: NOW, issues: [] });

    service.clear();
    expect(storage.getItem(DRAFT_STORAGE_KEY)).toBeNull();
    expect(service.load()).toEqual({ status: 'none' });
  });

  it('reports a failure instead of throwing when storage is full', () => {
    spyOn(storage, 'setItem').and.throwError(new DOMException('full', 'QuotaExceededError'));
    const result = service.save(EMPTY_TRIP_DRAFT);
    expect(result.ok).toBeFalse();
  });
});
