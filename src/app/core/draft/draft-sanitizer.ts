import { parseLocalDateTime } from '../domain/date-time';
import { isPositiveWeight, isValidTruckCount } from '../domain/trip-rules';
import { LocationId, isLocationId } from '../models/location.model';
import { EMPTY_TRIP_DRAFT, MAX_DROP_OFFS, MAX_TRUCKS, MIN_TRUCKS, TripDraft } from '../models/trip.model';
import { TruckCategoryId, isTruckCategoryId } from '../models/truck.model';

export const DRAFT_SCHEMA_VERSION = 1;

/** What is written to storage. Quotes are intentionally never persisted. */
export interface StoredDraft {
  readonly version: typeof DRAFT_SCHEMA_VERSION;
  readonly savedAt: string;
  readonly trip: TripDraft;
}

export type DraftLoadResult =
  | { readonly status: 'none' }
  | {
      readonly status: 'restored';
      readonly draft: TripDraft;
      readonly savedAt: Date | null;
      /** Fields that were dropped or repaired while restoring. */
      readonly issues: readonly string[];
    }
  | { readonly status: 'discarded'; readonly issues: readonly string[] };

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMissing(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Turns whatever is in storage into a safe TripDraft. Never throws.
 *
 * Policy: an unreadable payload (bad JSON, wrong shape/version) is discarded entirely;
 * otherwise each field is checked independently and any invalid value (wrong type,
 * unknown ID, duplicate location, out-of-range number) is cleared with an explanation,
 * keeping the rest of the user's work.
 */
export function parseStoredDraft(raw: string | null): DraftLoadResult {
  if (raw === null || raw.trim() === '') {
    return { status: 'none' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: 'discarded', issues: ['The saved draft was corrupted (not valid JSON) and was discarded.'] };
  }

  if (!isRecord(parsed) || parsed['version'] !== DRAFT_SCHEMA_VERSION || !isRecord(parsed['trip'])) {
    return { status: 'discarded', issues: ['The saved draft is in an unrecognised format and was discarded.'] };
  }

  const issues: string[] = [];
  const trip = parsed['trip'];

  const pickup = readLocation(trip['pickup'], 'pickup location', issues);
  const dropOffs = readDropOffs(trip['dropOffs'], pickup, issues);
  const truckCategory = readTruckCategory(trip['truckCategory'], issues);
  const truckCount = readTruckCount(trip['truckCount'], issues);
  const cargoWeightTonnes = readCargoWeight(trip['cargoWeightTonnes'], issues);
  const pickupDateTime = readPickupDateTime(trip['pickupDateTime'], issues);
  const loadingAssistance = readBoolean(trip['loadingAssistance'], 'loading assistance', issues);
  const unloadingAssistance = readBoolean(trip['unloadingAssistance'], 'unloading assistance', issues);

  return {
    status: 'restored',
    draft: {
      pickup,
      dropOffs,
      truckCategory,
      truckCount,
      cargoWeightTonnes,
      pickupDateTime,
      loadingAssistance,
      unloadingAssistance,
    },
    savedAt: readSavedAt(parsed['savedAt']),
    issues,
  };
}

function readLocation(value: unknown, label: string, issues: string[]): LocationId | null {
  if (isMissing(value)) return null;
  if (isLocationId(value)) return value;
  issues.push(`The saved ${label} (${describe(value)}) is not a known location and was cleared.`);
  return null;
}

function readDropOffs(value: unknown, pickup: LocationId | null, issues: string[]): (LocationId | null)[] {
  if (isMissing(value)) return [...EMPTY_TRIP_DRAFT.dropOffs];
  if (!Array.isArray(value)) {
    issues.push('The saved drop-off list was invalid and was cleared.');
    return [...EMPTY_TRIP_DRAFT.dropOffs];
  }

  const used = new Set<LocationId>(pickup ? [pickup] : []);
  const result: (LocationId | null)[] = [];
  for (const item of value) {
    if (isMissing(item)) {
      result.push(null); // an empty slot the user had added but not filled in yet
    } else if (!isLocationId(item)) {
      issues.push(`Unknown drop-off location ${describe(item)} was removed.`);
    } else if (used.has(item)) {
      issues.push(`Duplicate location ${item} was removed from the drop-offs.`);
    } else {
      used.add(item);
      result.push(item);
    }
  }

  if (result.length > MAX_DROP_OFFS) {
    issues.push(`Only the first ${MAX_DROP_OFFS} drop-off locations were kept.`);
    result.length = MAX_DROP_OFFS;
  }
  return result.length > 0 ? result : [...EMPTY_TRIP_DRAFT.dropOffs];
}

function readTruckCategory(value: unknown, issues: string[]): TruckCategoryId | null {
  if (isMissing(value)) return null;
  if (isTruckCategoryId(value)) return value;
  issues.push(`Unknown truck category ${describe(value)} was cleared.`);
  return null;
}

function readTruckCount(value: unknown, issues: string[]): number | null {
  if (isMissing(value)) return null;
  if (typeof value === 'number' && isValidTruckCount(value)) return value;
  issues.push(`The saved truck count ${describe(value)} was outside ${MIN_TRUCKS}–${MAX_TRUCKS} and was cleared.`);
  return null;
}

function readCargoWeight(value: unknown, issues: string[]): number | null {
  if (isMissing(value)) return null;
  if (typeof value === 'number' && isPositiveWeight(value)) return value;
  issues.push(`The saved cargo weight ${describe(value)} was not a positive number and was cleared.`);
  return null;
}

function readPickupDateTime(value: unknown, issues: string[]): string | null {
  if (isMissing(value) || value === '') return null;
  // Validity against the *current* time is checked by the form after restoring.
  if (typeof value === 'string' && parseLocalDateTime(value) !== null) return value;
  issues.push('The saved pickup date/time was invalid and was cleared.');
  return null;
}

function readBoolean(value: unknown, label: string, issues: string[]): boolean {
  if (isMissing(value)) return false;
  if (typeof value === 'boolean') return value;
  issues.push(`The saved ${label} setting was invalid and was turned off.`);
  return false;
}

function readSavedAt(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function describe(value: unknown): string {
  try {
    const text = JSON.stringify(value);
    return text === undefined ? String(value) : text.length > 30 ? `${text.slice(0, 27)}...` : text;
  } catch {
    return String(value);
  }
}
