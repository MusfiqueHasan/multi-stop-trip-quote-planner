# 03 · Implementation Plan

Built in the order below: domain first (pure, easy to test), then services, then UI. Each step lists the PRD items it covers and how it was checked.

| # | Step | Covers | Done when | Status |
| --- | --- | --- | --- | --- |
| 1 | Scaffold Angular 18 (standalone, strict, SCSS, no SSR); add `@angular/cdk` 18 | NFR-1, NFR-4 | `ng build` passes | ✅ |
| 2 | Typed models + static data (locations, distances, trucks, fees) | FR-11, NFR-3 | No `any` in core | ✅ |
| 3 | Domain: distances, pricing, rules, local date/time, trip key | FR-8, 9, 12, 13, 20 | `pricing.spec` reproduces AC-1 | ✅ |
| 4 | `Clock` + `QuoteService` with injectable latency/scheduler | FR-15, 16 | Emits only after latency under `fakeAsync` | ✅ |
| 5 | `QuoteStore` (switchMap + request ids) and `deriveQuoteView` | FR-17–20 | Out-of-order tests pass both ways | ✅ |
| 6 | Draft sanitizer + `DraftStorageService` | FR-21–24 | Malformed-data tests pass | ✅ |
| 7 | Typed reactive form, validators, error messages | FR-4–10 | `trip-form.spec` passes | ✅ |
| 8 | UI: route editor with drag-and-drop, truck/cargo, schedule/services, fare panel, draft actions | FR-1–3, 14, NFR-6 | Works in a real browser | ✅ |
| 9 | Wire time re-validation (request, 30 s, focus, restore) | FR-6, FR-25 | Component test: time passes → quote blocked | ✅ |
| 10 | Component integration tests | AC-1–AC-6 | 35/35 specs pass headless | ✅ |
| 11 | Visual pass: route drawn as a road, dark fare slip, mobile layout | NFR-6 | Screenshots in `docs/screenshots` | ✅ |
| 12 | Docs: PRD, spec, plan, notes, README | NFR-7 | This folder + README | ✅ |

## Definition of done

- `npm run build` succeeds with no warnings.
- `npm run test:ci` passes.
- Manual browser run: verification example shows 5,790 BDT; drag reorders stops; reload restores the draft without a quote; no console errors.

## Possible follow-ups (not required by the brief)

- Persist a quote alongside a draft but mark it stale on restore (currently quotes are intentionally not stored).
- Cancel the pending request automatically when the trip changes (today it completes and is shown as outdated).
- E2E suite (Playwright) in CI for drag-and-drop on touch devices.
- i18n for Bangla labels and BDT formatting.
