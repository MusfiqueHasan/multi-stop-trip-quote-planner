import { AbstractControl, FormArray, FormControl, ValidationErrors, ValidatorFn } from '@angular/forms';

import { formatLocalDateTime, isStrictlyAfter, parseLocalDateTime } from '../../core/domain/date-time';
import { findDuplicateLocations, maxCargoCapacityTonnes } from '../../core/domain/trip-rules';
import { LocationId } from '../../core/models/location.model';
import { TruckCategoryId } from '../../core/models/truck.model';
import { Clock } from '../../core/services/clock';

/** Error payloads, so templates and messages are type-checked. */
export interface DuplicateLocationsError {
  readonly duplicates: readonly LocationId[];
}
export interface CapacityExceededError {
  readonly maxTonnes: number;
  readonly actualTonnes: number;
}

export const integerValidator: ValidatorFn = (control) => {
  const value: unknown = control.value;
  return typeof value === 'number' && !Number.isInteger(value) ? { integer: true } : null;
};

export const positiveNumberValidator: ValidatorFn = (control) => {
  const value: unknown = control.value;
  if (value === null || value === undefined || value === '') return null; // `required` handles empties
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? null : { positive: true };
};

/**
 * Pickup time must be strictly later than *now*. Because "now" keeps moving, the
 * component re-runs this validator when a quote is requested and periodically.
 */
export function futureDateTimeValidator(clock: Clock): ValidatorFn {
  return (control) => {
    const value: unknown = control.value;
    if (value === null || value === undefined || value === '') return null;
    if (typeof value !== 'string' || parseLocalDateTime(value) === null) {
      return { invalidDateTime: true };
    }
    const now = clock.now();
    return isStrictlyAfter(value, now) ? null : { pastDateTime: { now: formatLocalDateTime(now) } };
  };
}

/** Group-level: pickup and all drop-offs must be distinct. */
export const uniqueLocationsValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const pickup = group.get('pickup') as FormControl<LocationId | null> | null;
  const dropOffs = group.get('dropOffs') as FormArray<FormControl<LocationId | null>> | null;
  if (!pickup || !dropOffs) return null;

  const duplicates = findDuplicateLocations([pickup.value, ...dropOffs.controls.map((c) => c.value)]);
  if (duplicates.length === 0) return null;
  const error: DuplicateLocationsError = { duplicates };
  return { duplicateLocations: error };
};

/** Group-level: cargo weight ≤ category capacity × truck count. */
export const cargoCapacityValidator: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const category = group.get('truckCategory')?.value as TruckCategoryId | null | undefined;
  const count = group.get('truckCount')?.value as number | null | undefined;
  const weight = group.get('cargoWeightTonnes')?.value as number | null | undefined;

  // Only meaningful once the other fields are individually valid.
  if (!category || typeof count !== 'number' || !Number.isInteger(count) || count < 1) return null;
  if (typeof weight !== 'number' || !Number.isFinite(weight) || weight <= 0) return null;

  const maxTonnes = maxCargoCapacityTonnes(category, count);
  if (weight <= maxTonnes) return null;
  const error: CapacityExceededError = { maxTonnes, actualTonnes: weight };
  return { capacityExceeded: error };
};
