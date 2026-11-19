import { Component } from '@angular/core';

import { TripPlannerComponent } from './features/trip-planner/trip-planner.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [TripPlannerComponent],
  template: `
    <header class="app-header">
      <div class="app-header__inner">
        <svg class="app-header__logo" width="52" height="52" viewBox="0 0 64 64" aria-hidden="true">
          <rect width="64" height="64" rx="15" fill="#F2B705"/>
          <rect x="7" y="17" width="29" height="23" rx="3.5" fill="#0E2A47"/>
          <path d="M38 23h9.6a3 3 0 0 1 2.4 1.2l5.4 7.2a3 3 0 0 1 .6 1.8V40H38z" fill="#0E2A47"/>
          <path d="M41.5 26.5h5.6l3.9 5.2h-9.5z" fill="#F2B705"/>
          <circle cx="17" cy="43" r="6" fill="#0E2A47" stroke="#F2B705" stroke-width="3"/>
          <circle cx="47" cy="43" r="6" fill="#0E2A47" stroke="#F2B705" stroke-width="3"/>
          <rect x="7" y="53" width="11" height="3.5" rx="1.75" fill="#0E2A47"/>
          <rect x="26.5" y="53" width="11" height="3.5" rx="1.75" fill="#0E2A47"/>
          <rect x="46" y="53" width="11" height="3.5" rx="1.75" fill="#0E2A47"/>
        </svg>
        <div>
          <p class="app-header__product">Trip Quote Planner</p>
          <h1 class="app-header__title">Plan a multi-stop truck trip</h1>
          <p class="app-header__subtitle">One pickup, up to three drop-offs, and a fare estimate in BDT before you book.</p>
        </div>
      </div>
    </header>
    <main class="app-main">
      <app-trip-planner />
    </main>
  `,
})
export class AppComponent {}
