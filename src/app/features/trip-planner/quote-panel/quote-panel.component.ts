import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { locationName } from '../../../core/data/locations.data';
import { getTruckCategory } from '../../../core/data/trucks.data';
import { parseLocalDateTime } from '../../../core/domain/date-time';
import { Quote } from '../../../core/models/quote.model';
import { BdtPipe } from '../../../shared/bdt.pipe';
import { QuoteView } from '../quote-view';

const PICKUP_FORMAT = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export interface QuotedTripSummary {
  readonly route: string;
  readonly legs: string;
  readonly trucks: string;
  readonly rate: string;
  readonly cargo: string;
  readonly pickupAt: string;
  readonly services: string;
}

/** Presentational: renders whatever QuoteView it is given. Contains no business logic. */
@Component({
  selector: 'app-quote-panel',
  standalone: true,
  imports: [BdtPipe],
  templateUrl: './quote-panel.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuotePanelComponent {
  readonly view = input.required<QuoteView>();

  /** Human-readable description of the exact inputs the displayed quote was produced for. */
  readonly summary = computed<QuotedTripSummary | null>(() => {
    const view = this.view();
    return view.kind === 'ready' ? summarise(view.quote) : null;
  });
}

function summarise({ request: trip, breakdown }: Quote): QuotedTripSummary {
  const category = getTruckCategory(trip.truckCategory);
  const pickupDate = parseLocalDateTime(trip.pickupDateTime);
  const services = [trip.loadingAssistance ? 'Loading' : null, trip.unloadingAssistance ? 'Unloading' : null].filter(
    (s): s is string => s !== null,
  );
  return {
    route: [trip.pickup, ...trip.dropOffs].map(locationName).join(' → '),
    legs: breakdown.legs.map((leg) => `${leg.from}→${leg.to} ${leg.distanceKm} km`).join(', '),
    trucks: `${trip.truckCount} × ${category.label} (${category.capacityTonnes} t each)`,
    rate: `${category.ratePerKm} BDT/km per truck, minimum ${category.minimumFarePerTruck.toLocaleString('en-US')} BDT`,
    cargo: `${trip.cargoWeightTonnes} t`,
    pickupAt: pickupDate ? PICKUP_FORMAT.format(pickupDate) : trip.pickupDateTime,
    services: services.length > 0 ? `${services.join(' + ')} assistance` : 'None',
  };
}
