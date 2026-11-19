import { Injectable, InjectionToken, inject } from '@angular/core';

import { TripDraft } from '../models/trip.model';
import { Clock } from '../services/clock';
import { DRAFT_SCHEMA_VERSION, DraftLoadResult, StoredDraft, parseStoredDraft } from './draft-sanitizer';

export const DRAFT_STORAGE_KEY = 'trip-quote-planner.draft';

/** Web Storage used for drafts; `null` when the browser blocks storage access. */
export const DRAFT_STORAGE = new InjectionToken<Storage | null>('DRAFT_STORAGE', {
  providedIn: 'root',
  factory: () => {
    try {
      return window.localStorage;
    } catch {
      return null; // e.g. storage disabled by privacy settings
    }
  },
});

export type DraftSaveResult =
  | { readonly ok: true; readonly savedAt: Date }
  | { readonly ok: false; readonly error: string };

@Injectable({ providedIn: 'root' })
export class DraftStorageService {
  private readonly storage = inject(DRAFT_STORAGE);
  private readonly clock = inject(Clock);

  save(trip: TripDraft): DraftSaveResult {
    if (!this.storage) {
      return { ok: false, error: 'Local storage is not available in this browser, so the draft could not be saved.' };
    }
    const savedAt = this.clock.now();
    const payload: StoredDraft = { version: DRAFT_SCHEMA_VERSION, savedAt: savedAt.toISOString(), trip };
    try {
      this.storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
      return { ok: true, savedAt };
    } catch {
      return { ok: false, error: 'The draft could not be saved (browser storage may be full or blocked).' };
    }
  }

  load(): DraftLoadResult {
    if (!this.storage) {
      return { status: 'none' };
    }
    let raw: string | null;
    try {
      raw = this.storage.getItem(DRAFT_STORAGE_KEY);
    } catch {
      return { status: 'none' };
    }
    return parseStoredDraft(raw);
  }

  clear(): void {
    try {
      this.storage?.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // Nothing else to do: if storage is inaccessible there is no draft to clear.
    }
  }
}
