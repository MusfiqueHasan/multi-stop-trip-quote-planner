import { AbstractControl, FormArray, FormControl, FormGroup, Validators } from '@angular/forms';

import { LocationId } from '../../core/models/location.model';
import {
  EMPTY_TRIP_DRAFT,
  MAX_DROP_OFFS,
  MAX_TRUCKS,
  MIN_DROP_OFFS,
  MIN_TRUCKS,
  TripDraft,
  TripRequest,
} from '../../core/models/trip.model';
import { TruckCategoryId } from '../../core/models/truck.model';
import { Clock } from '../../core/services/clock';
import {
  cargoCapacityValidator,
  futureDateTimeValidator,
  integerValidator,
  positiveNumberValidator,
  uniqueLocationsValidator,
} from './trip-form.validators';

export interface TripFormControls {
  pickup: FormControl<LocationId | null>;
  dropOffs: FormArray<FormControl<LocationId | null>>;
  truckCategory: FormControl<TruckCategoryId | null>;
  truckCount: FormControl<number | null>;
  cargoWeightTonnes: FormControl<number | null>;
  pickupDateTime: FormControl<string | null>;
  loadingAssistance: FormControl<boolean>;
  unloadingAssistance: FormControl<boolean>;
}

export type TripFormGroup = FormGroup<TripFormControls>;
export type DropOffsArray = TripFormControls['dropOffs'];

export function createDropOffControl(value: LocationId | null = null): FormControl<LocationId | null> {
  return new FormControl<LocationId | null>(value, Validators.required);
}

export function createTripForm(clock: Clock, draft: TripDraft = EMPTY_TRIP_DRAFT): TripFormGroup {
  const form = new FormGroup<TripFormControls>(
    {
      pickup: new FormControl<LocationId | null>(null, Validators.required),
      dropOffs: new FormArray<FormControl<LocationId | null>>([], [
        Validators.minLength(MIN_DROP_OFFS),
        Validators.maxLength(MAX_DROP_OFFS),
      ]),
      truckCategory: new FormControl<TruckCategoryId | null>(null, Validators.required),
      truckCount: new FormControl<number | null>(null, [
        Validators.required,
        integerValidator,
        Validators.min(MIN_TRUCKS),
        Validators.max(MAX_TRUCKS),
      ]),
      cargoWeightTonnes: new FormControl<number | null>(null, [Validators.required, positiveNumberValidator]),
      pickupDateTime: new FormControl<string | null>(null, [Validators.required, futureDateTimeValidator(clock)]),
      loadingAssistance: new FormControl<boolean>(false, { nonNullable: true }),
      unloadingAssistance: new FormControl<boolean>(false, { nonNullable: true }),
    },
    { validators: [uniqueLocationsValidator, cargoCapacityValidator] },
  );
  applyDraft(form, draft);
  return form;
}

/** Replaces the whole form state with `draft` (used for restore and reset). */
export function applyDraft(form: TripFormGroup, draft: TripDraft): void {
  const dropOffs = form.controls.dropOffs;
  const slots = draft.dropOffs.length > 0 ? draft.dropOffs.slice(0, MAX_DROP_OFFS) : [null];
  // Resize rather than rebuild, so existing controls (and their DOM rows) are reused.
  while (dropOffs.length > slots.length) {
    dropOffs.removeAt(dropOffs.length - 1, { emitEvent: false });
  }
  while (dropOffs.length < slots.length) {
    dropOffs.push(createDropOffControl(), { emitEvent: false });
  }

  form.setValue({
    pickup: draft.pickup,
    dropOffs: [...slots],
    truckCategory: draft.truckCategory,
    truckCount: draft.truckCount,
    cargoWeightTonnes: draft.cargoWeightTonnes,
    pickupDateTime: draft.pickupDateTime,
    loadingAssistance: draft.loadingAssistance,
    unloadingAssistance: draft.unloadingAssistance,
  });
}

export function readDraft(form: TripFormGroup): TripDraft {
  return form.getRawValue();
}

/** Returns a TripRequest only when the whole form is valid; otherwise `null`. */
export function readTripRequest(form: TripFormGroup): TripRequest | null {
  if (!form.valid) return null;
  const v = form.getRawValue();
  const dropOffs = v.dropOffs.filter((id): id is LocationId => id !== null);
  if (
    v.pickup === null ||
    v.truckCategory === null ||
    v.truckCount === null ||
    v.cargoWeightTonnes === null ||
    v.pickupDateTime === null ||
    dropOffs.length !== v.dropOffs.length
  ) {
    return null; // unreachable when validators pass; narrows the types safely
  }
  return {
    pickup: v.pickup,
    dropOffs,
    truckCategory: v.truckCategory,
    truckCount: v.truckCount,
    cargoWeightTonnes: v.cargoWeightTonnes,
    pickupDateTime: v.pickupDateTime,
    loadingAssistance: v.loadingAssistance,
    unloadingAssistance: v.unloadingAssistance,
  };
}

/** Moves a drop-off without recreating controls, so state (touched, etc.) moves with it. */
export function moveDropOff(dropOffs: DropOffsArray, from: number, to: number): void {
  const last = dropOffs.length - 1;
  if (from === to || from < 0 || to < 0 || from > last || to > last) return;
  const control = dropOffs.at(from);
  dropOffs.removeAt(from, { emitEvent: false });
  dropOffs.insert(to, control);
  dropOffs.markAsDirty();
}

/** Marks controls that already hold a value as touched, so their errors become visible. */
export function revealErrorsOnFilledControls(control: AbstractControl): void {
  if (control instanceof FormGroup || control instanceof FormArray) {
    Object.values(control.controls).forEach((child: AbstractControl) => revealErrorsOnFilledControls(child));
  } else if (control.value !== null && control.value !== '' && control.value !== false) {
    control.markAsTouched();
  }
}
