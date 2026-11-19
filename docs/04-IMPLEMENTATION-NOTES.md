# 04 · Implementation Notes

Decisions, issues found while building, and how correctness was verified. Requirements are in the [PRD](01-PRD.md); design in the [spec](02-SPEC.md).

## Key technical decisions

**D1. Pure domain layer, shared by form and service.**
Pricing, distances and trip rules are plain TypeScript functions with no Angular imports. Form validators and `QuoteService` both call them. This keeps the business rules unit-testable in isolation and guarantees the UI and the "server" agree.

**D2. Two trip types: `TripDraft` and `TripRequest`.**
The form and saved drafts use `TripDraft` (everything nullable). Only a valid form can produce a `TripRequest` (`readTripRequest`). The pricing and quote code accepts only `TripRequest`, so an incomplete trip can't be priced by mistake — the type system enforces it.

**D3. "Latest request wins" with `switchMap` plus request ids.**
`switchMap` unsubscribes the previous request when a new one starts, so an older response can never overwrite a newer one, and `startWith(pending)` means the spinner always belongs to the latest request. A request-id check drops anything that isn't the latest as a second, independent guard. I chose this over `concatMap`/queueing (slower, shows stale results) and over a manual `Map` of in-flight promises (more code, same behaviour).

**D4. Quotes carry their inputs; validity is derived, not stored.**
Each result stores the request and its `tripKey`. `deriveQuoteView()` shows figures only if that key equals the form's current key **and** the form is valid right now. There is no "invalidate the quote" bookkeeping on every form change to forget, which is how stale quotes usually leak.

**D5. Editing during a pending request doesn't cancel it.**
The brief lets users edit while a quote is pending. The request finishes, but its result is shown as outdated if the trip changed; the pending panel says so. Requesting again supersedes it. An invalid "Get quote" click doesn't cancel the pending request either — only valid requests decide what's displayed (FR-19).

**D6. Time is injected.**
`Clock`, `QUOTE_LATENCY` and `QUOTE_SCHEDULER` are injection tokens. Tests use a `FakeClock`, a fixed latency sequence and `fakeAsync`/`tick`, so nothing waits for real timers and out-of-order completion is reproducible.

**D7. "Now" is re-checked, not remembered.**
The pickup-time validator reads the clock each time it runs. It is re-run when a quote is requested (the requirement), every 30 s, on window focus, and after restoring a draft. The service re-validates too.

**D8. Drafts: repair field by field, discard only when unreadable.**
Invalid JSON or an unknown schema version is discarded (and removed so the warning doesn't repeat). Otherwise each field is validated independently and only the bad ones are cleared, with a message for each, so the user keeps as much work as possible. A schema `version` allows future migrations.

**D9. Drag-and-drop with Angular CDK.**
`@angular/cdk` is the official, free Angular library; writing pointer/touch drag handling by hand would add risk for no benefit. Drag moves the existing `FormControl`s so touched/dirty state moves with the stop. ↑/↓ buttons are provided as the keyboard-accessible alternative; drag remains the primary interaction.

**D10. Signals for view state, Reactive Forms for input.**
`form.events` (new in Angular 18) feeds one snapshot signal; `quoteView`, draft status and hints are `computed` from it. The quote panel is `OnPush` and purely presentational.

**D11. Self-contained UI.**
Fonts (Figtree, Bricolage Grotesque) are bundled via `@fontsource` packages, so the app makes no network requests at runtime. The visual idea — the route drawn as a road with leg distances between stops — is also functional: it shows order and per-leg distance while editing.

## Issues encountered

| Issue | Resolution |
| --- | --- |
| The machine's default Node (24) is outside Angular 18's supported range; `ng version` reports "Unsupported". | Used Node 20 LTS; added `.nvmrc` and `engines` in `package.json`, documented in the README. |
| `new Date('2026-02-31T10:00')` silently rolls over to March, and string parsing differs between browsers. | `parseLocalDateTime` parses the `datetime-local` format manually and rejects values that don't round-trip. |
| A pickup time valid when typed becomes invalid later without any input event, so Angular never re-validates it. | Explicit re-validation at request time (+ interval/focus/restore). Covered by a component test that advances the fake clock. |
| Angular dev warning `NG0956` (whole `@for` list re-created). Caused by rebuilding all drop-off controls on restore/reset, and by tracking message lists by text. | `applyDraft` now resizes the `FormArray` and reuses controls; message lists track by `$index`. Test run is warning-free. |
| Capacity error appeared while weight or truck count were still invalid, giving two errors for one problem. | `cargoCapacityValidator` only runs once category, count and weight are individually valid. |
| Type narrowing on a discriminated union in templates (`view().kind === 'ready'`) doesn't narrow signal calls. | Used Angular 18's `@let v = view()` and narrowed on `v`, avoiding `$any`. |
| `<legend>` isn't a grid item, so the section's `gap` didn't apply under the heading. | Explicit margin on the legend. |
| On phones the fare panel is below the form, so pressing "Get quote" seemed to do nothing. | On the stacked layout the panel scrolls into view after a request (respects reduced motion). |

## Verification

**Automated — 34 specs, Karma + Jasmine, ChromeHeadless (`npm run test:ci`):**

| Spec | What it proves |
| --- | --- |
| `core/domain/pricing.spec.ts` (5) | AC-1 exactly (27 km / 4,590 / 1,200 / 5,790); minimum fare; stop order changes distance and there's no return leg; both fees × trucks; distance symmetry for every pair. |
| `features/trip-planner/trip-form.spec.ts` (7) | Valid form → `TripRequest`; duplicates (pickup vs drop-off, drop-off vs drop-off); capacity boundary (equal OK, above fails); weight and truck-count ranges; "equal to now" is invalid and a stale time fails after the clock moves; reorder keeps control identity; draft resize. |
| `core/draft/draft-sanitizer.spec.ts` (8) | Missing data; invalid JSON / wrong shape / wrong version discarded; wrong types and unknown IDs cleared; duplicates removed and drop-offs capped; truck counts 0, 6, −1, 2.5, "3", `true` rejected; incomplete drafts and past dates kept; storage round-trip; quota error reported, not thrown. |
| `features/trip-planner/quote.store.spec.ts` (8) | Pending → success after latency; **slow-then-fast** requests show only the newer quote and the older one never overwrites it; **fast-then-slow** keeps the spinner for the latest request; rejection when pickup time has passed; reset cancels; quote shown as outdated for changed inputs or a now-invalid form; latency always in 300–1,200 ms; nothing emitted before latency. |
| `features/trip-planner/trip-planner.component.spec.ts` (6) | Full DOM flow for AC-1, then "outdated" after an edit; re-request while pending (AC-2); time passes before clicking → service not called, error shown (AC-4); capacity error blocks the quote; save incomplete draft → "reload" restores it with no quote and flags the passed pickup time (AC-6); corrupted draft handled and Clear works (AC-5). |

**Manual, in Chrome (scripted with puppeteer-core outside the repo):**
- Filled the verification trip with C before B, **dragged** B above C with the mouse → order became B, C.
- Got the quote: 27 km and **5,790 BDT** displayed.
- Saved, reloaded: inputs restored, notice shown, fare panel empty.
- 390 px wide layout checked; no console errors.
- Screenshots: [`docs/screenshots`](screenshots).

**Build:** `npm run build` (production) completes without warnings.
