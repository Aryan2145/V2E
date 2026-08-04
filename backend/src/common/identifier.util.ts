/**
 * Login identity helpers. A user signs in with EITHER an email OR a phone number.
 * Phones are normalised to digits-only so "+91 98765-43210" and "9876543210" (when
 * entered the same way) match, and so uniqueness is on a canonical form. We keep the
 * full digit string (incl. any country code) — enter numbers consistently.
 */

/** Strip everything except digits. '' if nothing usable. */
export function normalizePhone(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\D/g, '');
}

/** A value is treated as an email if it contains '@'. */
export function looksLikeEmail(raw: string | null | undefined): boolean {
  return !!raw && raw.includes('@');
}

export type IdentifierKind = 'email' | 'phone';

/**
 * Classify a typed login identifier as an email or a phone, and return the canonical
 * value to match on (trimmed email, or digits-only phone).
 */
export function classifyIdentifier(
  raw: string | null | undefined,
): { kind: IdentifierKind; value: string } {
  const trimmed = (raw ?? '').trim();
  if (looksLikeEmail(trimmed)) return { kind: 'email', value: trimmed };
  return { kind: 'phone', value: normalizePhone(trimmed) };
}
