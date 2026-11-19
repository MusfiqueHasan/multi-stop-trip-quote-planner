import { Clock } from '../app/core/services/clock';
import { TripRequest } from '../app/core/models/trip.model';

/** Clock whose "now" is set explicitly by the test. */
export class FakeClock extends Clock {
  constructor(private current: Date) {
    super();
  }

  override now(): Date {
    return new Date(this.current.getTime());
  }

  set(date: Date): void {
    this.current = date;
  }

  advanceMinutes(minutes: number): void {
    this.current = new Date(this.current.getTime() + minutes * 60_000);
  }
}

/** In-memory Web Storage implementation. */
export class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

/** Returns latencies from a fixed list, in order (last value repeats). */
export function latencySequence(...values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

/** Fixed reference time used across tests: 19 Nov 2026, 10:00 local. */
export const NOW = new Date(2026, 10, 19, 10, 0, 0);

/** The verification example from the brief: A → B → C, 2 × Medium, 5 t, loading only. */
export function verificationTrip(overrides: Partial<TripRequest> = {}): TripRequest {
  return {
    pickup: 'A',
    dropOffs: ['B', 'C'],
    truckCategory: 'medium',
    truckCount: 2,
    cargoWeightTonnes: 5,
    pickupDateTime: '2026-11-20T09:30',
    loadingAssistance: true,
    unloadingAssistance: false,
    ...overrides,
  };
}
