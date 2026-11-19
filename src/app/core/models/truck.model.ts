export const TRUCK_CATEGORY_IDS = ['mini', 'medium', 'large'] as const;

export type TruckCategoryId = (typeof TRUCK_CATEGORY_IDS)[number];

export interface TruckCategory {
  readonly id: TruckCategoryId;
  readonly label: string;
  /** Maximum cargo a single truck of this category can carry, in tonnes. */
  readonly capacityTonnes: number;
  /** Price per kilometre, per truck, in BDT. */
  readonly ratePerKm: number;
  /** Minimum fare charged per truck regardless of distance, in BDT. */
  readonly minimumFarePerTruck: number;
}

/** Optional service fees, each charged per truck, in BDT. */
export interface ServiceFees {
  readonly loadingPerTruck: number;
  readonly unloadingPerTruck: number;
}

export function isTruckCategoryId(value: unknown): value is TruckCategoryId {
  return typeof value === 'string' && (TRUCK_CATEGORY_IDS as readonly string[]).includes(value);
}
