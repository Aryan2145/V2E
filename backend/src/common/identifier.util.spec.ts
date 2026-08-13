import {
  classifyIdentifier,
  normalizeNationalNumber,
  resolvePhoneForSave,
  validatePhonePair,
} from './identifier.util';

describe('identifier.util — phone normalisation', () => {
  it('keeps a plain 10-digit Indian number as-is', () => {
    expect(normalizeNationalNumber('9876543210', '+91')).toBe('9876543210');
  });

  it('strips spaces, dashes and brackets', () => {
    expect(normalizeNationalNumber('98765 43210', '+91')).toBe('9876543210');
    expect(normalizeNationalNumber('(987) 654-3210', '+91')).toBe('9876543210');
  });

  it('strips a pasted +91 country-code prefix', () => {
    expect(normalizeNationalNumber('+91 98765 43210', '+91')).toBe('9876543210');
    expect(normalizeNationalNumber('919876543210', '+91')).toBe('9876543210');
  });

  it('strips a single leading trunk 0', () => {
    expect(normalizeNationalNumber('09876543210', '+91')).toBe('9876543210');
  });

  it('normalises per-country (UAE is 9 digits, +971)', () => {
    expect(normalizeNationalNumber('+971 50 123 4567', '+971')).toBe('501234567');
    expect(normalizeNationalNumber('971501234567', '+971')).toBe('501234567');
  });
});

describe('identifier.util — classifyIdentifier', () => {
  it('treats a value with @ as email (trim only, case preserved)', () => {
    expect(classifyIdentifier(' John@Acme.com ')).toEqual({ kind: 'email', value: 'John@Acme.com' });
  });

  it('treats a value without @ as a phone, defaulting to +91', () => {
    expect(classifyIdentifier('9876543210')).toEqual({ kind: 'phone', countryCode: '+91', value: '9876543210' });
  });

  it('honours an explicit country code and normalises the pasted prefix', () => {
    expect(classifyIdentifier('+91 98765 43210', '+91')).toEqual({
      kind: 'phone',
      countryCode: '+91',
      value: '9876543210',
    });
  });
});

describe('identifier.util — validation (the API save path)', () => {
  it('accepts an exactly-correct number', () => {
    expect(validatePhonePair('+91', '9876543210')).toEqual({ country_code: '+91', phone: '9876543210' });
  });

  it('rejects a 5-digit number for +91 with a clear message', () => {
    expect(() => validatePhonePair('+91', '12345')).toThrow(/10 digit number for India/i);
  });

  it('rejects an unsupported country code', () => {
    expect(() => validatePhonePair('+999', '12345')).toThrow(/valid country code/i);
  });

  it('resolvePhoneForSave returns both-null when no number is entered', () => {
    expect(resolvePhoneForSave('+91', '')).toEqual({ country_code: null, phone: null });
    expect(resolvePhoneForSave('+91', undefined)).toEqual({ country_code: null, phone: null });
  });

  it('resolvePhoneForSave validates a supplied number and returns the pair', () => {
    expect(resolvePhoneForSave('+91', '098765 43210')).toEqual({ country_code: '+91', phone: '9876543210' });
  });

  it('resolvePhoneForSave rejects a too-short number (API rejects it, not just the form)', () => {
    expect(() => resolvePhoneForSave('+91', '12345')).toThrow(/10 digit number for India/i);
  });
});
