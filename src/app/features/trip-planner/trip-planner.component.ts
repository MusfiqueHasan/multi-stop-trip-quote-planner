import { DatePipe } from '@angular/common';
import { Component, ElementRef, HostListener, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';

import { BdtPipe } from '../../shared/bdt.pipe';
import { interval, map } from 'rxjs';

import { SERVICE_FEES, TRUCK_CATEGORIES, getTruckCategory } from '../../core/data/trucks.data';
import { formatLocalDateTime } from '../../core/domain/date-time';
import { tripKey } from '../../core/domain/trip-key';
import { maxCargoCapacityTonnes } from '../../core/domain/trip-rules';
import { DraftStorageService } from '../../core/draft/draft-storage.service';
import { EMPTY_TRIP_DRAFT, MAX_TRUCKS, MIN_TRUCKS, TripDraft } from '../../core/models/trip.model';
import { Clock } from '../../core/services/clock';
import { QuotePanelComponent } from './quote-panel/quote-panel.component';
import { QuoteStore } from './quote.store';
import { deriveQuoteView } from './quote-view';
import { RouteStopsComponent } from './route-stops/route-stops.component';
import { applyDraft, createTripForm, readDraft, readTripRequest, revealErrorsOnFilledControls } from './trip-form';
import { TripField, capacityExceededMessage, collectTripIssues, controlErrorMessages } from './trip-form.errors';
import { CapacityExceededError } from './trip-form.validators';

/** Below this width the fare panel stacks under the form (matches the CSS breakpoint). */
const STACKED_LAYOUT_QUERY = '(max-width: 940px)';

/** How often the pickup time is re-checked against the clock while the page is open. */
export const PICKUP_REVALIDATION_INTERVAL_MS = 30_000;

const EMPTY_DRAFT_KEY = tripKey(EMPTY_TRIP_DRAFT);
const TIME_FORMAT = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

interface FormSnapshot {
  readonly draft: TripDraft;
  readonly key: string;
  readonly valid: boolean;
  readonly issues: readonly string[];
}

export interface Notice {
  readonly tone: 'info' | 'success' | 'warning' | 'error';
  readonly title: string;
  readonly details: readonly string[];
}

/**
 * Container for the planner. Owns the reactive form, wires it to the QuoteStore and the
 * draft storage, and derives everything the view shows from signals.
 */
@Component({
  selector: 'app-trip-planner',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, BdtPipe, RouteStopsComponent, QuotePanelComponent],
  providers: [QuoteStore],
  templateUrl: './trip-planner.component.html',
})
export class TripPlannerComponent {
  private readonly clock = inject(Clock);
  private readonly drafts = inject(DraftStorageService);
  private readonly quoteStore = inject(QuoteStore);

  private readonly quotePanel = viewChild<ElementRef<HTMLElement>>('quotePanel');

  readonly form = createTripForm(this.clock);
  readonly truckCategories = TRUCK_CATEGORIES;
  readonly serviceFees = SERVICE_FEES;
  readonly minTrucks = MIN_TRUCKS;
  readonly maxTrucks = MAX_TRUCKS;

  /** Re-derived on every form event (value, status, touched, pristine). */
  private readonly snapshot = toSignal(this.form.events.pipe(map(() => this.takeSnapshot())), {
    initialValue: this.takeSnapshot(),
  });

  /** Set when the user asks for a quote while the form is invalid; cleared once it becomes valid. */
  private readonly invalidAttempt = signal(false);

  readonly quoteView = computed(() =>
    deriveQuoteView({
      state: this.quoteStore.state(),
      currentKey: this.snapshot().key,
      formValid: this.snapshot().valid,
      invalidAttempt: this.invalidAttempt(),
      issues: this.snapshot().issues,
    }),
  );
  readonly isQuotePending = computed(() => this.quoteStore.state().status === 'pending');

  // ---- Draft state ---------------------------------------------------------------
  readonly notice = signal<Notice | null>(null);
  /** Whether something is currently stored for this trip. */
  readonly hasStoredDraft = signal(false);
  /** Key of the stored draft, or null when it differs from anything shown (e.g. repaired on restore). */
  private readonly storedDraftKey = signal<string | null>(null);
  readonly lastSavedAt = signal<Date | null>(null);
  readonly hasUnsavedChanges = computed(() => this.storedDraftKey() !== this.snapshot().key);
  readonly canClear = computed(
    () => this.hasStoredDraft() || this.snapshot().key !== EMPTY_DRAFT_KEY || this.quoteStore.state().status !== 'idle',
  );

  /** `min` for the date picker: the next whole minute (must be strictly in the future). */
  readonly minPickupDateTime = signal(this.nextMinute());

  readonly capacityHint = computed(() => {
    const { truckCategory, truckCount } = this.snapshot().draft;
    if (!truckCategory || truckCount === null || !Number.isInteger(truckCount) || truckCount < MIN_TRUCKS || truckCount > MAX_TRUCKS) {
      return null;
    }
    const category = getTruckCategory(truckCategory);
    return `Up to ${maxCargoCapacityTonnes(truckCategory, truckCount)} t with ${truckCount} ${category.label} truck${truckCount > 1 ? 's' : ''} (${category.capacityTonnes} t each).`;
  });

  constructor() {
    this.restoreDraft();

    this.form.statusChanges.pipe(takeUntilDestroyed()).subscribe((status) => {
      if (status === 'VALID') this.invalidAttempt.set(false);
    });

    // "Now" keeps moving: keep the pickup-time validation honest while the page is open.
    interval(PICKUP_REVALIDATION_INTERVAL_MS)
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.revalidatePickupTime());
  }

  @HostListener('window:focus')
  onWindowFocus(): void {
    this.revalidatePickupTime();
  }

  // ---- Actions -------------------------------------------------------------------

  requestQuote(): void {
    // Validate the pickup time against the clock *now*, not when it was last edited.
    this.revalidatePickupTime();

    const request = readTripRequest(this.form);
    if (!request) {
      this.form.markAllAsTouched();
      this.invalidAttempt.set(true);
    } else {
      this.invalidAttempt.set(false);
      this.quoteStore.request(request);
    }
    this.revealQuotePanelOnSmallScreens();
  }

  saveDraft(): void {
    const draft = readDraft(this.form);
    const result = this.drafts.save(draft);
    if (!result.ok) {
      this.notice.set({ tone: 'error', title: 'Draft not saved', details: [result.error] });
      return;
    }
    this.hasStoredDraft.set(true);
    this.storedDraftKey.set(tripKey(draft));
    this.lastSavedAt.set(result.savedAt);
    this.notice.set({
      tone: 'success',
      title: `Draft saved at ${TIME_FORMAT.format(result.savedAt)}.`,
      details: ['It will be restored when you reopen this page. Saving a draft does not save the quote.'],
    });
  }

  clearDraft(): void {
    this.drafts.clear();
    this.quoteStore.reset();
    applyDraft(this.form, EMPTY_TRIP_DRAFT);
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.invalidAttempt.set(false);
    this.hasStoredDraft.set(false);
    this.storedDraftKey.set(null);
    this.lastSavedAt.set(null);
    this.notice.set({ tone: 'info', title: 'Draft cleared. You can start a new trip.', details: [] });
  }

  dismissNotice(): void {
    this.notice.set(null);
  }

  // ---- Template helpers -----------------------------------------------------------

  fieldErrors(field: TripField): string[] {
    const control = this.form.controls[field];
    return control.touched || control.dirty ? controlErrorMessages(field, control.errors) : [];
  }

  capacityError(): string | null {
    const error = this.form.getError('capacityExceeded') as CapacityExceededError | null;
    const c = this.form.controls;
    const relevantTouched = c.cargoWeightTonnes.touched || c.cargoWeightTonnes.dirty || c.truckCount.dirty || c.truckCategory.dirty;
    return error && relevantTouched ? capacityExceededMessage(error) : null;
  }

  // ---- Internals --------------------------------------------------------------------

  /** On stacked (mobile) layouts the fare panel is below the fold; bring the result into view. */
  private revealQuotePanelOnSmallScreens(): void {
    const panel = this.quotePanel()?.nativeElement;
    if (panel && typeof window.matchMedia === 'function' && window.matchMedia(STACKED_LAYOUT_QUERY).matches) {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      panel.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    }
  }

  private takeSnapshot(): FormSnapshot {
    const draft = readDraft(this.form);
    return { draft, key: tripKey(draft), valid: this.form.valid, issues: collectTripIssues(this.form) };
  }

  private revalidatePickupTime(): void {
    this.minPickupDateTime.set(this.nextMinute());
    this.form.controls.pickupDateTime.updateValueAndValidity();
  }

  private nextMinute(): string {
    const next = this.clock.now();
    next.setSeconds(0, 0);
    next.setMinutes(next.getMinutes() + 1);
    return formatLocalDateTime(next);
  }

  private restoreDraft(): void {
    const result = this.drafts.load();
    if (result.status === 'none') return;

    if (result.status === 'discarded') {
      this.drafts.clear();
      this.notice.set({ tone: 'warning', title: 'Your saved draft could not be restored.', details: result.issues });
      return;
    }

    applyDraft(this.form, result.draft);
    revealErrorsOnFilledControls(this.form);

    const details = [...result.issues];
    if (this.form.controls.pickupDateTime.hasError('pastDateTime')) {
      details.push('The saved pickup time has already passed. Choose a new pickup time.');
    }
    details.push('Quotes are not saved with drafts — request a new quote for the restored trip.');

    this.hasStoredDraft.set(true);
    // If anything had to be repaired, what's stored no longer matches the form: show "unsaved".
    this.storedDraftKey.set(result.issues.length === 0 ? tripKey(readDraft(this.form)) : null);
    this.lastSavedAt.set(result.savedAt);
    this.notice.set({
      tone: result.issues.length > 0 || details.length > 1 ? 'warning' : 'info',
      title: result.savedAt ? `Draft restored (saved ${TIME_FORMAT.format(result.savedAt)}).` : 'Draft restored.',
      details,
    });
  }
}
