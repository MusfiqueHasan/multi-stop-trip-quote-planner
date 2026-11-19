import { FakeClock, NOW } from '../../../testing/test-doubles';
import { TripDraft } from '../../core/models/trip.model';
import { applyDraft, createTripForm, moveDropOff, readTripRequest } from './trip-form';
import { collectTripIssues } from './trip-form.errors';

const VALID_DRAFT: TripDraft = {
  pickup: 'A',
  dropOffs: ['B', 'C'],
  truckCategory: 'medium',
  truckCount: 2,
  cargoWeightTonnes: 5,
  pickupDateTime: '2026-11-19T10:30',
  loadingAssistance: true,
  unloadingAssistance: false,
};

describe('trip form validation', () => {
  let clock: FakeClock;

  beforeEach(() => (clock = new FakeClock(NOW)));

  it('accepts a complete, valid trip and maps it to a TripRequest', () => {
    const form = createTripForm(clock, VALID_DRAFT);

    expect(form.valid).toBeTrue();
    expect(readTripRequest(form)).toEqual({ ...VALID_DRAFT, dropOffs: ['B', 'C'] } as never);
  });

  it('rejects a location used twice anywhere in the trip', () => {
    const pickupRepeated = createTripForm(clock, { ...VALID_DRAFT, dropOffs: ['B', 'A'] });
    expect(pickupRepeated.getError('duplicateLocations')?.duplicates).toEqual(['A']);

    const dropOffRepeated = createTripForm(clock, { ...VALID_DRAFT, dropOffs: ['C', 'C'] });
    expect(dropOffRepeated.hasError('duplicateLocations')).toBeTrue();
    expect(readTripRequest(dropOffRepeated)).toBeNull();
  });

  it('enforces cargo ≤ capacity × truck count (boundary inclusive)', () => {
    const atCapacity = createTripForm(clock, { ...VALID_DRAFT, truckCategory: 'medium', truckCount: 2, cargoWeightTonnes: 6 });
    expect(atCapacity.hasError('capacityExceeded')).toBeFalse();

    const over = createTripForm(clock, { ...VALID_DRAFT, truckCategory: 'mini', truckCount: 3, cargoWeightTonnes: 4.6 });
    expect(over.getError('capacityExceeded')).toEqual({ maxTonnes: 4.5, actualTonnes: 4.6 });
    expect(collectTripIssues(over).some((m) => m.includes('exceeds'))).toBeTrue();
  });

  it('rejects non-positive weights and truck counts outside 1–5 or non-integers', () => {
    const form = createTripForm(clock, VALID_DRAFT);
    const { cargoWeightTonnes, truckCount } = form.controls;

    cargoWeightTonnes.setValue(0);
    expect(cargoWeightTonnes.hasError('positive')).toBeTrue();
    cargoWeightTonnes.setValue(-2);
    expect(cargoWeightTonnes.hasError('positive')).toBeTrue();

    truckCount.setValue(6);
    expect(truckCount.hasError('max')).toBeTrue();
    truckCount.setValue(0);
    expect(truckCount.hasError('min')).toBeTrue();
    truckCount.setValue(2.5);
    expect(truckCount.hasError('integer')).toBeTrue();
  });

  it('requires a pickup time strictly later than now, and re-checks it as time passes', () => {
    const form = createTripForm(clock, { ...VALID_DRAFT, pickupDateTime: '2026-11-19T10:00' });
    const pickup = form.controls.pickupDateTime;
    expect(pickup.hasError('pastDateTime')).withContext('equal to now is not "strictly later"').toBeTrue();

    pickup.setValue('2026-11-19T10:01');
    expect(pickup.valid).toBeTrue();

    // Time passes without the field being edited: the stored value is now in the past.
    clock.advanceMinutes(5);
    pickup.updateValueAndValidity();
    expect(pickup.hasError('pastDateTime')).toBeTrue();
    expect(readTripRequest(form)).toBeNull();
  });

  it('reorders drop-offs by moving the existing controls', () => {
    const form = createTripForm(clock, { ...VALID_DRAFT, dropOffs: ['B', 'C', 'D'] });
    const movedControl = form.controls.dropOffs.at(2);

    moveDropOff(form.controls.dropOffs, 2, 0);

    expect(form.controls.dropOffs.getRawValue()).toEqual(['D', 'B', 'C']);
    expect(form.controls.dropOffs.at(0)).toBe(movedControl);
  });

  it('applyDraft rebuilds the drop-off list to the draft length', () => {
    const form = createTripForm(clock, VALID_DRAFT);
    applyDraft(form, { ...VALID_DRAFT, dropOffs: ['E'] });
    expect(form.controls.dropOffs.length).toBe(1);
    applyDraft(form, { ...VALID_DRAFT, dropOffs: [] });
    expect(form.controls.dropOffs.getRawValue()).toEqual([null]);
  });
});
