import { Pipe, PipeTransform } from '@angular/core';

const BDT_FORMAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });

export function formatBdt(amount: number): string {
  return `${BDT_FORMAT.format(amount)} BDT`;
}

/** Formats an amount as e.g. `5,790 BDT`. */
@Pipe({ name: 'bdt', standalone: true })
export class BdtPipe implements PipeTransform {
  transform(amount: number): string {
    return formatBdt(amount);
  }
}
