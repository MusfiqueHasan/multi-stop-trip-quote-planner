import { Component } from '@angular/core';

import { TripPlannerComponent } from './features/trip-planner/trip-planner.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [TripPlannerComponent],
  template: `
    <header class="app-header">
      <div class="app-header__inner">
        <span class="app-header__logo" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/></svg>
        </span>
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
