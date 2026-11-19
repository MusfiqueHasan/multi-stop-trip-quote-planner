import { ComponentFixture, TestBed, discardPeriodicTasks, fakeAsync, tick } from '@angular/core/testing';

import { FakeClock, MemoryStorage, NOW, latencySequence } from '../../../testing/test-doubles';
import { DRAFT_STORAGE, DRAFT_STORAGE_KEY } from '../../core/draft/draft-storage.service';
import { TripDraft } from '../../core/models/trip.model';
import { Clock } from '../../core/services/clock';
import { QUOTE_LATENCY, QuoteService } from '../../core/services/quote.service';
import { applyDraft } from './trip-form';
import { TripPlannerComponent } from './trip-planner.component';

const VERIFICATION_DRAFT: TripDraft = {
  pickup: 'A',
  dropOffs: ['B', 'C'],
  truckCategory: 'medium',
  truckCount: 2,
  cargoWeightTonnes: 5,
  pickupDateTime: '2026-11-19T12:00',
  loadingAssistance: true,
  unloadingAssistance: false,
};

describe('TripPlannerComponent', () => {
  let fixture: ComponentFixture<TripPlannerComponent>;
  let component: TripPlannerComponent;
  let clock: FakeClock;
  let storage: MemoryStorage;

  function create(latencies: number[] = [500]): void {
    TestBed.configureTestingModule({
      imports: [TripPlannerComponent],
      providers: [
        { provide: Clock, useValue: clock },
        { provide: DRAFT_STORAGE, useValue: storage },
        { provide: QUOTE_LATENCY, useValue: latencySequence(...latencies) },
      ],
    });
    fixture = TestBed.createComponent(TripPlannerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const query = (testId: string): HTMLElement | null => fixture.nativeElement.querySelector(`[data-testid="${testId}"]`);
  const text = (testId: string): string => query(testId)?.textContent?.trim() ?? '';
  const clickGetQuote = () => {
    query('get-quote')!.click();
    fixture.detectChanges();
  };

  beforeEach(() => {
    clock = new FakeClock(NOW);
    storage = new MemoryStorage();
  });

  it('shows the verification quote, and marks it outdated as soon as the trip changes', fakeAsync(() => {
    create([500]);
    applyDraft(component.form, VERIFICATION_DRAFT);
    clickGetQuote();
    expect(query('quote-pending')).not.toBeNull();

    tick(500);
    fixture.detectChanges();
    expect(text('quote-distance')).toBe('27 km');
    expect(text('quote-transport')).toBe('4,590 BDT');
    expect(text('quote-services')).toBe('1,200 BDT');
    expect(text('quote-total')).toBe('5,790 BDT');

    component.form.controls.unloadingAssistance.setValue(true);
    fixture.detectChanges();
    expect(query('quote-ready')).toBeNull();
    expect(query('quote-outdated')).not.toBeNull();
    discardPeriodicTasks();
  }));

  it('lets the user re-request while pending; only the latest result is displayed', fakeAsync(() => {
    create([1200, 300]);
    applyDraft(component.form, VERIFICATION_DRAFT);
    clickGetQuote(); // slow: 2 trucks

    component.form.controls.truckCount.setValue(3);
    fixture.detectChanges();
    expect(query('quote-pending')?.textContent).toContain('You changed the trip');

    clickGetQuote(); // fast: 3 trucks
    tick(300);
    fixture.detectChanges();
    expect(text('quote-total')).toBe('8,685 BDT'); // 2,295 × 3 + 600 × 3

    tick(900); // the stale first response would land now
    fixture.detectChanges();
    expect(text('quote-total')).toBe('8,685 BDT');
    discardPeriodicTasks();
  }));

  it('validates the pickup time against the current time when the quote is requested', fakeAsync(() => {
    create();
    const getQuote = spyOn(TestBed.inject(QuoteService), 'getQuote').and.callThrough();
    applyDraft(component.form, VERIFICATION_DRAFT);
    expect(component.form.valid).toBeTrue();

    clock.set(new Date(2026, 10, 19, 12, 30)); // the chosen 12:00 pickup is now in the past
    clickGetQuote();

    expect(getQuote).not.toHaveBeenCalled();
    expect(query('quote-invalid')?.textContent).toContain('Pickup time must be later than the current time.');
    expect(query('pickup-time-error')).not.toBeNull();
    discardPeriodicTasks();
  }));

  it('blocks invalid quotes and lists what to fix', fakeAsync(() => {
    create();
    applyDraft(component.form, { ...VERIFICATION_DRAFT, truckCategory: 'mini', truckCount: 1, cargoWeightTonnes: 5 });
    clickGetQuote();

    expect(query('quote-invalid')?.textContent).toContain('exceeds');
    expect(query('capacity-error')).not.toBeNull();
    discardPeriodicTasks();
  }));

  it('saves an incomplete draft and restores it on reload without restoring any quote', fakeAsync(() => {
    create();
    applyDraft(component.form, VERIFICATION_DRAFT);
    clickGetQuote();
    tick(500);
    component.form.controls.cargoWeightTonnes.setValue(null); // incomplete
    query('save-draft')!.click();
    fixture.detectChanges();
    expect(text('draft-status')).toContain('Draft saved');
    discardPeriodicTasks();
    fixture.destroy();
    TestBed.resetTestingModule();

    // "Reload": a fresh component reading the same storage, later in the day.
    clock.set(new Date(2026, 10, 19, 13, 0));
    create();
    expect(component.form.controls.pickup.value).toBe('A');
    expect(component.form.controls.dropOffs.getRawValue()).toEqual(['B', 'C']);
    expect(component.form.controls.cargoWeightTonnes.value).toBeNull();
    expect(query('quote-empty')).not.toBeNull();
    expect(component.form.controls.pickupDateTime.hasError('pastDateTime')).toBeTrue();
    expect(text('notice')).toContain('pickup time has already passed');
    discardPeriodicTasks();
  }));

  it('handles a corrupted draft safely and can clear the draft', fakeAsync(() => {
    storage.setItem(DRAFT_STORAGE_KEY, '{"version":1,"trip":');
    create();
    expect(text('notice')).toContain('could not be restored');
    expect(storage.getItem(DRAFT_STORAGE_KEY)).toBeNull();

    applyDraft(component.form, VERIFICATION_DRAFT);
    query('save-draft')!.click();
    fixture.detectChanges();
    expect(storage.getItem(DRAFT_STORAGE_KEY)).not.toBeNull();

    query('clear-draft')!.click();
    fixture.detectChanges();
    expect(storage.getItem(DRAFT_STORAGE_KEY)).toBeNull();
    expect(text('notice')).toContain('Draft cleared');
    expect(component.form.controls.pickup.value).toBeNull();
    discardPeriodicTasks();
  }));
});
