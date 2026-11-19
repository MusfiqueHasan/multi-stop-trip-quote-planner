/**
 * Helpers for the `datetime-local` input format (`YYYY-MM-DDTHH:mm`, optionally `:ss`).
 * Values are interpreted in the user's local time zone. We parse manually instead of
 * using `new Date(string)` so behaviour does not depend on browser parsing quirks.
 */
const LOCAL_DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

export function parseLocalDateTime(value: string): Date | null {
  const match = LOCAL_DATE_TIME_PATTERN.exec(value);
  if (!match) {
    return null;
  }
  const [year, month, day, hour, minute, second] = match.slice(1).map((part) => Number(part ?? 0));
  const date = new Date(year, month - 1, day, hour, minute, second);

  // Reject rollovers such as 2026-02-31 or 25:00, which Date would silently normalise.
  const roundTrips =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hour &&
    date.getMinutes() === minute;
  return roundTrips ? date : null;
}

/** Formats a Date as `YYYY-MM-DDTHH:mm` in local time. */
export function formatLocalDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** True only if `value` is a valid local date/time strictly later than `now`. */
export function isStrictlyAfter(value: string, now: Date): boolean {
  const date = parseLocalDateTime(value);
  return date !== null && date.getTime() > now.getTime();
}
