# 02 · Technical Specification

Implements the [PRD](01-PRD.md). Execution order is in the [plan](03-PLAN.md); decisions and verification are in the [implementation notes](04-IMPLEMENTATION-NOTES.md).

## 1. Architecture

Three layers. Dependencies only point downwards; the domain layer has no Angular imports.

```
┌──────────────────────────────────────────────────────────────────────┐
│ UI  (features/trip-planner)                                          │
│   TripPlannerComponent ── RouteStopsComponent (drag & drop)          │
│          │             └─ QuotePanelComponent (presentational)       │
│          ├─ trip-form.ts / .validators.ts / .errors.ts  (Reactive Forms)
│          ├─ QuoteStore   (latest-request-wins state, component scoped) │
│          └─ quote-view.ts (pure: state + form → what to display)       │
├──────────────────────────────────────────────────────────────────────┤
│ Services (core/services, core/draft)                                 │
│   QuoteService (async, injectable latency/scheduler) · Clock          │
│   DraftStorageService (localStorage) · draft-sanitizer (pure)         │
├──────────────────────────────────────────────────────────────────────┤
│ Domain (core/domain, core/models, core/data) — framework-free        │
│   pricing.ts · route-distance.ts · trip-rules.ts · date-time.ts       │
│   trip-key.ts · typed models · static locations / trucks / distances  │
└──────────────────────────────────────────────────────────────────────┘
```

## 2. Data model (`core/models`)

| Type | Purpose |
| --- | --- |
| `LocationId = 'A' \| 'B' \| 'C' \| 'D' \| 'E'` | Derived from a `const` tuple, so the union and runtime guard `isLocationId` share one source. |
| `TruckCategoryId = 'mini' \| 'medium' \| 'large'` | Same pattern, `isTruckCategoryId`. |
| `TripDraft` | What the form holds and what is saved: every field nullable, drop-offs may contain empty slots. |
| `TripRequest` | A complete, validated trip. Only produced by `readTripRequest(form)` when the form is valid. |
| `QuoteBreakdown` | Legs, distance, fare per truck, minimum-fare flag, subtotals, total. |
| `Quote` | `{ requestId, request, requestKey, breakdown }` — a result always carries the inputs that produced it. |
| `QuoteState` | Discriminated union: `idle` · `pending` · `success` · `rejected`. |

## 3. Business rules (`core/domain`)

| Rule | Function | PRD |
| --- | --- | --- |
| Distance lookup, symmetric | `distanceBetween(a, b)` via unordered `pairKey` | FR-11 |
| Route distance, user order, no return leg | `routeLegs`, `routeDistanceKm` | FR-12 |
| Pricing formulas | `calculateQuote(trip)` | FR-13 |
| No repeated location | `findDuplicateLocations` | FR-8 |
| Capacity | `maxCargoCapacityTonnes(category, count)` | FR-9 |
| Strictly-future pickup | `isStrictlyAfter(value, now)`; `parseLocalDateTime` rejects rollovers like `02-31` | FR-6 |
| Full request check (used by the service) | `validateTripRequest(trip, now)` | FR-10, FR-17 |
| Input fingerprint | `tripKey(trip)` — fixed-order JSON of every pricing input | FR-20 |

The reactive-form validators and `QuoteService` both call these functions, so the UI and the "server" can't disagree.

## 4. Form (`features/trip-planner/trip-form*.ts`)

Typed `FormGroup<TripFormControls>`:

| Control | Validators |
| --- | --- |
| `pickup` | required |
| `dropOffs: FormArray` | min length 1, max length 3; each item required |
| `truckCategory` | required |
| `truckCount` | required, integer, min 1, max 5 |
| `cargoWeightTonnes` | required, positive |
| `pickupDateTime` | required, `futureDateTimeValidator(clock)` |
| `loadingAssistance`, `unloadingAssistance` | non-nullable booleans |
| *group* | `uniqueLocationsValidator`, `cargoCapacityValidator` |

- **Re-checking "now" (FR-6, FR-25):** `requestQuote()` calls `pickupDateTime.updateValueAndValidity()` before reading the form. It is also re-run every 30 s, on window focus, and after a draft is restored.
- **Reordering (FR-3):** CDK `cdkDropList` + `cdkDragHandle`; `moveDropOff()` moves the existing `FormControl`s (no re-creation). ↑/↓ buttons are a keyboard-accessible extra.
- **Messages (FR-10):** `trip-form.errors.ts` maps error keys to sentences; `collectTripIssues()` builds the list shown when a quote is blocked.

## 5. Asynchronous quotes

### QuoteService (FR-15, FR-16)
`getQuote(trip): Observable<QuoteBreakdown>` — cold, single emission. Validates on subscribe with the injected `Clock`, waits `timer(QUOTE_LATENCY(), QUOTE_SCHEDULER)`, then emits or errors with `QuoteRejectedError`.

| Token | Default | In tests |
| --- | --- | --- |
| `QUOTE_LATENCY: () => number` | uniform integer in [300, 1200] | `latencySequence(1200, 300)` for deterministic out-of-order completion |
| `QUOTE_SCHEDULER` | `asyncScheduler` | left as is; driven by `fakeAsync` / `tick` |
| `Clock` | `new Date()` | `FakeClock` |

### QuoteStore (FR-18, FR-19)
Component-scoped. `request(trip)` assigns an increasing `requestId` and pushes a command into a `Subject` piped through `switchMap`:

```
request(n) ─► switchMap ─► getQuote(n) ─► startWith(pending n) ─► success n | rejected n
                  └─ unsubscribes request(n-1): its response can never arrive
```

A second guard drops any emission whose id isn't the latest. `reset()` cancels in-flight work (used by "Clear draft").

### Display rule (FR-20) — `deriveQuoteView()`
Pure function of `(QuoteState, currentFormKey, formValid, invalidAttempt, issues)`:

| Condition | View |
| --- | --- |
| user just tried to quote an invalid form, and it's still invalid | `invalid` (lists issues) |
| `idle` | `empty` |
| `pending` | `pending` (+ "you changed the trip" note if keys differ) |
| `rejected` | `rejected` (reasons) |
| `success` and key matches and form valid now | `ready` (figures shown) |
| `success` otherwise | `outdated` (figures hidden) |

## 6. Drafts (FR-21 – FR-26)

Storage key `trip-quote-planner.draft`; payload `{ version: 1, savedAt: ISO, trip: TripDraft }`. Quotes are never stored.

`parseStoredDraft(raw)` never throws:

| Input | Result |
| --- | --- |
| `null` / empty | `none` |
| invalid JSON, non-object, wrong `version`, `trip` not an object | `discarded` (+ message; storage cleared) |
| otherwise | `restored`, each field checked on its own: unknown IDs, wrong types, duplicates (incl. drop-off = pickup), counts outside 1–5, non-positive weights, unparsable dates are cleared with a message; drop-offs capped at 3 |

After restore the component marks filled controls as touched (so a past pickup time shows its error) and the quote panel starts `empty`. `DRAFT_STORAGE` is an injection token (`localStorage`, or `null` if blocked); save errors (quota, blocked) are shown, not thrown.

## 7. UI states (NFR-6)

| Situation | What the user sees |
| --- | --- |
| No quote yet | "No estimate yet" with the next step |
| Waiting | Spinner + "Calculating your quote…"; button reads "Get updated quote" |
| Blocked | Red panel listing what to fix; fields highlighted |
| Stale | "Trip changed — estimate no longer valid", figures hidden |
| Ready | Breakdown, big total, "Quoted for" summary of the exact inputs |
| Draft | Status line: not saved / unsaved changes / saved at time; banner on save, restore, clear and errors |
| Disabled actions | Add drop-off at 3 stops, remove at 1 stop, move up/down at the ends, Clear when there's nothing to clear — each with a title/hint |

## 8. Traceability

| PRD | Code | Tests |
| --- | --- | --- |
| FR-1, 2, 3 | `route-stops.component.*`, `moveDropOff` | `trip-form.spec` (reorder, resize); browser drag check |
| FR-4, 5, 9 | `trip-form.validators.ts`, `trip-rules.ts` | `trip-form.spec` (capacity boundary, ranges) |
| FR-6, 25 | `futureDateTimeValidator`, `requestQuote()`, `restoreDraft()` | `trip-form.spec`, `trip-planner.component.spec` (time passes before request; restored past date) |
| FR-8 | `uniqueLocationsValidator` | `trip-form.spec`, `draft-sanitizer.spec` |
| FR-11–14 | `pricing.ts`, `route-distance.ts`, `quote-panel` | `pricing.spec` (AC-1, minimum fare, order, fees, symmetry) |
| FR-15–19 | `quote.service.ts`, `quote.store.ts` | `quote.store.spec` (out-of-order both ways, latency bounds, rejection, reset) |
| FR-20 | `quote-view.ts` | `quote.store.spec`, `trip-planner.component.spec` |
| FR-21–26 | `draft-sanitizer.ts`, `draft-storage.service.ts` | `draft-sanitizer.spec`, `trip-planner.component.spec` |
