import { Quote, QuoteState } from '../../core/models/quote.model';

/** What the quote panel should show. Derived, never stored. */
export type QuoteView =
  | { readonly kind: 'empty' }
  | { readonly kind: 'invalid'; readonly issues: readonly string[] }
  | { readonly kind: 'pending'; readonly inputsChanged: boolean }
  | { readonly kind: 'ready'; readonly quote: Quote }
  | { readonly kind: 'outdated' }
  | { readonly kind: 'rejected'; readonly reasons: readonly string[]; readonly inputsChanged: boolean };

export interface QuoteViewInputs {
  readonly state: QuoteState;
  /** Canonical key of what is in the form right now. */
  readonly currentKey: string;
  /** Whether the form is currently valid (including the pickup time against "now"). */
  readonly formValid: boolean;
  /** True after the user tried to request a quote with an invalid form. */
  readonly invalidAttempt: boolean;
  readonly issues: readonly string[];
}

/**
 * Single place that decides what the user sees. The key rule: a successful quote is
 * shown as valid only if it was produced for exactly the current inputs AND those
 * inputs are still valid now. Anything else is "outdated".
 */
export function deriveQuoteView(inputs: QuoteViewInputs): QuoteView {
  const { state, currentKey, formValid, invalidAttempt, issues } = inputs;

  if (invalidAttempt && !formValid) {
    return { kind: 'invalid', issues };
  }

  switch (state.status) {
    case 'idle':
      return { kind: 'empty' };
    case 'pending':
      return { kind: 'pending', inputsChanged: state.requestKey !== currentKey };
    case 'rejected':
      return { kind: 'rejected', reasons: state.reasons, inputsChanged: state.requestKey !== currentKey };
    case 'success':
      return state.quote.requestKey === currentKey && formValid
        ? { kind: 'ready', quote: state.quote }
        : { kind: 'outdated' };
  }
}
