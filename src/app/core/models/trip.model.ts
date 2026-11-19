import { LocationId } from './location.model';
import { TruckCategoryId } from './truck.model';

export const MIN_DROP_OFFS = 1;
export const MAX_DROP_OFFS = 3;
export const MIN_TRUCKS = 1;
export const MAX_TRUCKS = 5;

/**
 * A complete, validated trip that can be priced.
 * Only ever produced from a valid form (or validated input), never from a raw draft.
 */
export interface TripRequest {
  readonly pickup: LocationId;
  /** Ordered drop-off stops; the route is pickup → dropOffs[0] → dropOffs[1] → … */
  readonly dropOffs: readonly LocationId[];
  readonly truckCategory: TruckCategoryId;
  readonly truckCount: number;
  readonly cargoWeightTonnes: number;
  /** Local date/time in `YYYY-MM-DDTHH:mm` format (the `datetime-local` input format). */
  readonly pickupDateTime: string;
  readonly loadingAssistance: boolean;
  readonly unloadingAssistance: boolean;
}

/**
 * A possibly incomplete trip configuration, as edited in the form and saved as a draft.
 * Every field may be empty; `dropOffs` may contain empty slots.
 */
export interface TripDraft {
  readonly pickup: LocationId | null;
  readonly dropOffs: readonly (LocationId | null)[];
  readonly truckCategory: TruckCategoryId | null;
  readonly truckCount: number | null;
  readonly cargoWeightTonnes: number | null;
  readonly pickupDateTime: string | null;
  readonly loadingAssistance: boolean;
  readonly unloadingAssistance: boolean;
}

export const EMPTY_TRIP_DRAFT: TripDraft = {
  pickup: null,
  dropOffs: [null],
  truckCategory: null,
  truckCount: 1,
  cargoWeightTonnes: null,
  pickupDateTime: null,
  loadingAssistance: false,
  unloadingAssistance: false,
};
