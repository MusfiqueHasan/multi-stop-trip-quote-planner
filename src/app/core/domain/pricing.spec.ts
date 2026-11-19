import { verificationTrip } from '../../../testing/test-doubles';
import { LOCATION_IDS } from '../models/location.model';
import { calculateQuote } from './pricing';
import { distanceBetween, routeDistanceKm } from './route-distance';

describe('pricing rules', () => {
  it('matches the verification example from the brief (A → B → C, 2 Medium, loading only)', () => {
    const quote = calculateQuote(verificationTrip());

    expect(quote.distanceKm).toBe(27);
    expect(quote.legs).toEqual([
      { from: 'A', to: 'B', distanceKm: 12 },
      { from: 'B', to: 'C', distanceKm: 15 },
    ]);
    expect(quote.farePerTruck).toBe(2295); // 27 km × 85
    expect(quote.transportCost).toBe(4590);
    expect(quote.serviceCost).toBe(1200);
    expect(quote.totalQuote).toBe(5790);
    expect(quote.minimumFareApplied).toBeFalse();
  });

  it('charges the per-truck minimum fare when distance × rate is lower', () => {
    // A → B = 12 km; Mini: 12 × 50 = 600 < 1,200 minimum.
    const quote = calculateQuote(
      verificationTrip({ dropOffs: ['B'], truckCategory: 'mini', truckCount: 3, cargoWeightTonnes: 1, loadingAssistance: false }),
    );

    expect(quote.farePerTruck).toBe(1200);
    expect(quote.minimumFareApplied).toBeTrue();
    expect(quote.transportCost).toBe(3600);
    expect(quote.totalQuote).toBe(3600);
  });

  it('follows the exact stop order and has no return leg to the pickup', () => {
    const inOrder = calculateQuote(verificationTrip({ dropOffs: ['B', 'C'] }));
    const reordered = calculateQuote(verificationTrip({ dropOffs: ['C', 'B'] }));

    expect(inOrder.distanceKm).toBe(12 + 15); // A-B, B-C
    expect(reordered.distanceKm).toBe(18 + 15); // A-C, C-B (no leg back to A)
    expect(reordered.totalQuote).not.toBe(inOrder.totalQuote);
  });

  it('charges both assistance fees per truck', () => {
    const quote = calculateQuote(
      verificationTrip({ dropOffs: ['D', 'E'], truckCategory: 'large', truckCount: 3, cargoWeightTonnes: 20, unloadingAssistance: true }),
    );
    // A-D 26 + D-E 17 = 43 km; 43 × 145 = 6,235 per truck.
    expect(quote.distanceKm).toBe(43);
    expect(quote.transportCost).toBe(6235 * 3);
    expect(quote.serviceFeesPerTruck).toBe(1000);
    expect(quote.serviceCost).toBe(3000);
    expect(quote.totalQuote).toBe(18705 + 3000);
  });

  it('uses symmetric distances for every pair', () => {
    for (const a of LOCATION_IDS) {
      for (const b of LOCATION_IDS) {
        if (a !== b) expect(distanceBetween(a, b)).toBe(distanceBetween(b, a));
      }
    }
    expect(routeDistanceKm(['E', 'D', 'C', 'B'])).toBe(17 + 22 + 15);
  });
});
