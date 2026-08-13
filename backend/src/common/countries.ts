/**
 * Supported dialling countries for phone login. `code` is stored WITH the plus
 * ("+91"); `nationalDigits` is exactly how many digits the national number must
 * have for that country (no country code, no trunk 0). This one table drives both
 * normalisation (stripping a pasted prefix) and validation (exact digit count).
 *
 * Keep this list in sync with the frontend mirror in `frontend/lib/phone.ts`.
 */
export interface Country {
  code: string; // "+91"
  name: string; // "India"
  nationalDigits: number; // 10
}

export const COUNTRIES: Country[] = [
  { code: '+91', name: 'India', nationalDigits: 10 },
  { code: '+971', name: 'UAE', nationalDigits: 9 },
  { code: '+1', name: 'USA/Canada', nationalDigits: 10 },
  { code: '+44', name: 'UK', nationalDigits: 10 },
  { code: '+65', name: 'Singapore', nationalDigits: 8 },
  { code: '+61', name: 'Australia', nationalDigits: 9 },
];

/** The default country shown/assumed everywhere (matches the frontend default). */
export const DEFAULT_COUNTRY_CODE = '+91';

/** Look up a country by its "+.." code. Returns undefined if not supported. */
export function findCountry(code?: string | null): Country | undefined {
  if (!code) return undefined;
  const trimmed = code.trim();
  return COUNTRIES.find((c) => c.code === trimmed);
}
