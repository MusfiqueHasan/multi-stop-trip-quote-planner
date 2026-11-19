import { ServiceFees, TruckCategory, TruckCategoryId } from '../models/truck.model';

export const TRUCK_CATEGORIES: readonly TruckCategory[] = [
  { id: 'mini', label: 'Mini', capacityTonnes: 1.5, ratePerKm: 50, minimumFarePerTruck: 1200 },
  { id: 'medium', label: 'Medium', capacityTonnes: 3, ratePerKm: 85, minimumFarePerTruck: 2000 },
  { id: 'large', label: 'Large', capacityTonnes: 7, ratePerKm: 145, minimumFarePerTruck: 3500 },
];

export const SERVICE_FEES: ServiceFees = {
  loadingPerTruck: 600,
  unloadingPerTruck: 400,
};

export function getTruckCategory(id: TruckCategoryId): TruckCategory {
  const category = TRUCK_CATEGORIES.find((c) => c.id === id);
  if (!category) {
    throw new Error(`Unknown truck category: ${id}`);
  }
  return category;
}
