# 01 · Product Requirements (PRD)

**Product:** Multi-Stop Trip Quote Planner
**Source brief:** Web-App Engineer take-home assessment (`Web-App-Engineer-Task.pdf`)
**Status:** Implemented

## 1. Problem

A customer of a fictional logistics app wants to know what a truck trip with several drop-offs will cost before booking. Today they can't configure a multi-stop route, see a fare breakdown, or come back later to an unfinished trip.

## 2. Users and primary job

| User | Job to be done |
| --- | --- |
| Logistics customer (desktop or phone) | Configure a trip with one pickup and up to three drop-offs, get a trustworthy fare estimate, and save an unfinished trip to finish later. |

## 3. Goals

- G1. A user can configure a valid trip and get a fare estimate that follows the published pricing rules.
- G2. An estimate is never shown as valid for trip details other than the ones it was calculated for.
- G3. A user can save an incomplete trip and get it back after a refresh, safely.
- G4. Validation, loading, empty and saved states are clear without reading documentation.

## 4. Non-goals (out of scope)

Real booking, payments, authentication, external REST APIs, maps/geocoding, GPS tracking, route maps, server-side rendering, cloud deployment.

## 5. Functional requirements

IDs are referenced from the [technical spec](02-SPEC.md) and the [plan](03-PLAN.md).

### Trip configuration
| ID | Requirement |
| --- | --- |
| FR-1 | Select exactly one pickup location. |
| FR-2 | Select 1–3 ordered drop-off locations; add and remove drop-offs. |
| FR-3 | Reorder drop-offs with **drag-and-drop** (buttons alone are not enough). |
| FR-4 | Select a truck category (Mini, Medium, Large) and number of trucks (integer 1–5). |
| FR-5 | Enter total cargo weight in tonnes (positive number). |
| FR-6 | Choose a pickup date/time strictly later than the current local date/time; re-check it **when a quote is requested**, not only when edited. |
| FR-7 | Toggle optional loading and unloading assistance. |
| FR-8 | The same location must not appear twice anywhere in one trip. |
| FR-9 | Cargo weight must not exceed category capacity × number of trucks. |
| FR-10 | Show useful validation messages and prevent invalid quotes. |

### Locations, distances and pricing
| ID | Requirement |
| --- | --- |
| FR-11 | Use the five fixed locations (A–E) and the symmetric distance table from the brief. No mapping API. |
| FR-12 | Route distance = sum of consecutive legs in the user's order. No return leg. |
| FR-13 | `farePerTruck = max(distanceKm × ratePerKm, minimumFare)`; `transportCost = farePerTruck × trucks`; `serviceCost = selectedFeesPerTruck × trucks`; `total = transport + services`. |
| FR-14 | Display distance, transport subtotal, optional-service subtotal and grand total. |

### Asynchronous quotes
| ID | Requirement |
| --- | --- |
| FR-15 | A client-side `QuoteService` calculates the estimate asynchronously with a 300–1,200 ms simulated delay; later requests can finish before earlier ones. |
| FR-16 | Timing must be testable without waiting for real timeouts. |
| FR-17 | Represent pending, successful and invalid states. |
| FR-18 | Users may edit the trip and request again while a quote is pending (if the form is valid). |
| FR-19 | The most recent valid request decides what is displayed; the loading indicator reflects the latest request. |
| FR-20 | An estimate is never displayed as valid for inputs different from the ones that produced it. |

### Drafts
| ID | Requirement |
| --- | --- |
| FR-21 | Save the current trip locally, even when incomplete or invalid. |
| FR-22 | Restore the saved trip after refresh / reopen. |
| FR-23 | Clear the draft and start again. |
| FR-24 | Handle missing or malformed saved data safely: invalid JSON, wrong types, unknown location IDs, duplicate locations, out-of-range truck counts. |
| FR-25 | Re-validate a restored pickup date against the current local time. |
| FR-26 | A restored draft never restores a quote; a new estimate must be requested. |

## 6. Non-functional requirements

| ID | Requirement |
| --- | --- |
| NFR-1 | Angular 18, TypeScript, Angular Reactive Forms. Browser-only SPA. |
| NFR-2 | Clear separation of UI, data models, validation and calculation logic. |
| NFR-3 | Typed core domain (no `any`). |
| NFR-4 | No backend, database, hosted service, map provider, paid library or credentials. |
| NFR-5 | At least three meaningful automated tests, including business rules and an async/state-consistency scenario. |
| NFR-6 | Usable, responsive UI; validation, disabled actions, loading, empty states and draft feedback are understandable. |
| NFR-7 | README with setup/run/test, technical decisions, issues, verification, and AI disclosure. |

## 7. Acceptance criteria

- AC-1 (verification example): Pickup A → B → C, 2 Medium trucks, 5 t, loading only → **27 km, transport 4,590 BDT, services 1,200 BDT, total 5,790 BDT**.
- AC-2: Request quote 1 (slow), change the trip, request quote 2 (fast): quote 2 is shown; quote 1 never overwrites it; spinner stays on while the latest request is pending.
- AC-3: Changing any input after a quote appears hides the figures and shows "estimate no longer valid".
- AC-4: A pickup time that was valid when typed but has since passed blocks the quote at request time.
- AC-5: A corrupted or tampered draft never crashes the app; invalid fields are cleared with an explanation.
- AC-6: Reloading with a saved draft restores the inputs and shows no estimate.
