/**
 * Identifies a comparison for the duration of a browser session.
 *
 * The server used to mint these with `crypto.randomUUID()`, which is only
 * exposed in a secure context. MutaDiff is meant to be dropped on an internal
 * file server that may well speak plain HTTP, so the fallback is not defensive
 * padding: without it the wizard would throw on the first comparison.
 */
export function newComparisonId(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // `getRandomValues` is available outside a secure context, so a v4 can still
  // be assembled by hand: bits 4-7 of octet 6 carry the version, and the two
  // high bits of octet 8 the variant.
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
