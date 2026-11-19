import { AbstractControl, ValidationErrors } from '@angular/forms';

import { locationName } from '../../core/data/locations.data';
import { MAX_TRUCKS, MIN_TRUCKS } from '../../core/models/trip.model';
import { TripFormGroup } from './trip-form';
import { CapacityExceededError, DuplicateLocationsError } from './trip-form.validators';

export type TripField = 'pickup' | 'truckCategory' | 'truckCount' | 'cargoWeightTonnes' | 'pickupDateTime';

const FIELD_LABELS: Readonly<Record<TripField, string>> = {
  pickup: 'Pickup location',
  truckCategory: 'Truck category',
  truckCount: 'Number of trucks',
  cargoWeightTonnes: 'Cargo weight',
  pickupDateTime: 'Pickup date and time',
};

/** Maps a single control's validation errors to user-facing messages. */
export function controlErrorMessages(field: TripField, errors: ValidationErrors | null): string[] {
  if (!errors) return [];
  const label = FIELD_LABELS[field];
  const messages: string[] = [];
  if (errors['required']) messages.push(`${label} is required.`);
  if (errors['integer']) messages.push(`${label} must be a whole number.`);
  if (errors['min'] || errors['max']) messages.push(`Choose between ${MIN_TRUCKS} and ${MAX_TRUCKS} trucks.`);
  if (errors['positive']) messages.push(`${label} must be greater than 0 tonnes.`);
  if (errors['invalidDateTime']) messages.push('Enter a valid date and time.');
  if (errors['pastDateTime']) messages.push('Pickup time must be later than the current time.');
  return messages;
}

export function duplicateLocationsMessage(error: DuplicateLocationsError): string {
  const names = error.duplicates.map((id) => `${locationName(id)} (${id})`).join(', ');
  return `Each location can appear only once in a trip. Repeated: ${names}.`;
}

export function capacityExceededMessage(error: CapacityExceededError): string {
  return (
    `Cargo weight ${formatTonnes(error.actualTonnes)} t exceeds the selected trucks' capacity of ` +
    `${formatTonnes(error.maxTonnes)} t. Add trucks, choose a larger category, or reduce the weight.`
  );
}

export function formatTonnes(value: number): string {
  return Number(value.toFixed(3)).toString();
}

/** Every outstanding problem in the form, for the "can't request a quote" summary. */
export function collectTripIssues(form: TripFormGroup): string[] {
  const c = form.controls;
  const issues: string[] = [];
  const fields: [TripField, AbstractControl][] = [
    ['pickup', c.pickup],
    ['truckCategory', c.truckCategory],
    ['truckCount', c.truckCount],
    ['cargoWeightTonnes', c.cargoWeightTonnes],
    ['pickupDateTime', c.pickupDateTime],
  ];

  issues.push(...controlErrorMessages('pickup', c.pickup.errors));
  const emptyStops = c.dropOffs.controls.filter((stop) => stop.hasError('required')).length;
  if (emptyStops > 0) {
    issues.push(emptyStops === 1 ? 'Choose a location for the empty drop-off.' : `Choose locations for ${emptyStops} empty drop-offs.`);
  }
  for (const [field, control] of fields.slice(1)) {
    issues.push(...controlErrorMessages(field, control.errors));
  }

  const duplicate = form.getError('duplicateLocations') as DuplicateLocationsError | null;
  if (duplicate) issues.push(duplicateLocationsMessage(duplicate));
  const capacity = form.getError('capacityExceeded') as CapacityExceededError | null;
  if (capacity) issues.push(capacityExceededMessage(capacity));

  return issues;
}
