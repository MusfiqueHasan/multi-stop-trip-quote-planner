import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDragPlaceholder, CdkDropList } from '@angular/cdk/drag-drop';
import { Component, input, signal } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';

import { LOCATIONS, locationName } from '../../../core/data/locations.data';
import { findDuplicateLocations } from '../../../core/domain/trip-rules';
import { distanceBetween, routeDistanceKm } from '../../../core/domain/route-distance';
import { LocationId } from '../../../core/models/location.model';
import { MAX_DROP_OFFS, MIN_DROP_OFFS } from '../../../core/models/trip.model';
import { DropOffsArray, TripFormGroup, createDropOffControl, moveDropOff } from '../trip-form';
import { DuplicateLocationsError } from '../trip-form.validators';
import { controlErrorMessages, duplicateLocationsMessage } from '../trip-form.errors';

/** Pickup + ordered drop-offs editor. Reorder by drag-and-drop (mouse/touch) or the ↑/↓ buttons (keyboard). */
@Component({
  selector: 'app-route-stops',
  standalone: true,
  imports: [ReactiveFormsModule, CdkDropList, CdkDrag, CdkDragHandle, CdkDragPlaceholder],
  templateUrl: './route-stops.component.html',
})
export class RouteStopsComponent {
  readonly form = input.required<TripFormGroup>();

  readonly locations = LOCATIONS;
  readonly maxDropOffs = MAX_DROP_OFFS;
  readonly minDropOffs = MIN_DROP_OFFS;

  /** Screen-reader announcement for reorder/add/remove actions. */
  readonly announcement = signal('');

  get dropOffs(): DropOffsArray {
    return this.form().controls.dropOffs;
  }

  get canAdd(): boolean {
    return this.dropOffs.length < MAX_DROP_OFFS;
  }

  get canRemove(): boolean {
    return this.dropOffs.length > MIN_DROP_OFFS;
  }

  addDropOff(): void {
    if (!this.canAdd) return;
    this.dropOffs.push(createDropOffControl());
    this.dropOffs.markAsDirty();
    this.announcement.set(`Drop-off ${this.dropOffs.length} added.`);
  }

  removeDropOff(index: number): void {
    if (!this.canRemove) return;
    const removed = this.dropOffs.at(index).value;
    this.dropOffs.removeAt(index);
    this.dropOffs.markAsDirty();
    this.announcement.set(`${removed ? locationName(removed) : 'Empty drop-off'} removed.`);
  }

  onDrop(event: CdkDragDrop<unknown>): void {
    this.move(event.previousIndex, event.currentIndex);
  }

  move(from: number, to: number): void {
    if (from === to || to < 0 || to >= this.dropOffs.length) return;
    const moved = this.dropOffs.at(from).value;
    moveDropOff(this.dropOffs, from, to);
    this.announcement.set(`${moved ? locationName(moved) : 'Empty drop-off'} moved to stop ${to + 1}.`);
  }

  /** IDs selected anywhere in the trip except the given slot (-1 = pickup). */
  private usedElsewhere(slot: number): Set<LocationId> {
    const used = new Set<LocationId>();
    const pickup = this.form().controls.pickup.value;
    if (slot !== -1 && pickup) used.add(pickup);
    this.dropOffs.controls.forEach((control, i) => {
      if (i !== slot && control.value) used.add(control.value);
    });
    return used;
  }

  optionLabel(id: LocationId, name: string, slot: number): string {
    return this.usedElsewhere(slot).has(id) ? `${name} (${id}), already in this trip` : `${name} (${id})`;
  }

  /** True when this slot's value is repeated elsewhere in the trip. */
  isDuplicate(slot: number): boolean {
    const value = slot === -1 ? this.form().controls.pickup.value : this.dropOffs.at(slot).value;
    return value !== null && this.usedElsewhere(slot).has(value);
  }

  pickupErrors(): string[] {
    const control = this.form().controls.pickup;
    return control.touched ? controlErrorMessages('pickup', control.errors) : [];
  }

  dropOffMissing(index: number): boolean {
    const control = this.dropOffs.at(index);
    return control.touched && control.hasError('required');
  }

  duplicateMessage(): string | null {
    const error = this.form().getError('duplicateLocations') as DuplicateLocationsError | null;
    return error ? duplicateLocationsMessage(error) : null;
  }

  /** Distance of the leg arriving at drop-off `index`, once both ends are chosen and distinct. */
  legDistance(index: number): number | null {
    const from = index === 0 ? this.form().controls.pickup.value : this.dropOffs.at(index - 1).value;
    const to = this.dropOffs.at(index).value;
    return from && to && from !== to ? distanceBetween(from, to) : null;
  }

  /** Live route distance — route information only, never a price. Null until the route is complete. */
  routeTotalKm(): number | null {
    const route = [this.form().controls.pickup.value, ...this.dropOffs.controls.map((c) => c.value)];
    if (route.some((id) => id === null) || findDuplicateLocations(route).length > 0) return null;
    return routeDistanceKm(route as LocationId[]);
  }
}
