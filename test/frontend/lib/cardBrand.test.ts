import { detectBrand, formatCardNumber, formatExpiry, validateCard } from '../../../src/lib/cardBrand';

describe('card input helpers', () => {
  it.each([
    ['4111111111111111', 'Visa'],
    ['378282246310005', 'Amex'],
    ['5555555555554444', 'Mastercard'],
    ['6011111111111117', 'Discover'],
    ['999', 'Card'],
  ] as const)('detects %s as %s', (number, brand) => {
    expect(detectBrand(number)).toBe(brand);
  });

  it('formats card and expiry values while typing', () => {
    expect(formatCardNumber('3782 822463 10005')).toBe('3782 822463 10005');
    expect(formatCardNumber('4111-1111-1111-1111-99')).toBe('4111 1111 1111 1111');
    expect(formatExpiry('12345')).toBe('12/34');
  });

  it('rejects incomplete or invalid payment details', () => {
    expect(validateCard({ number: '4111', expiry: '12/99', cvv: '123', cardholder: 'Ada' })).toEqual({ valid: false, error: 'Enter a valid card number.' });
    expect(validateCard({ number: '4111111111111111', expiry: '13/99', cvv: '123', cardholder: 'Ada' })).toEqual({ valid: false, error: 'Enter a valid expiry (MM/YY).' });
    expect(validateCard({ number: '378282246310005', expiry: '12/99', cvv: '123', cardholder: 'Ada' })).toEqual({ valid: false, error: 'Enter the 4-digit security code.' });
  });

  it('accepts a future Visa card with a three-digit CVV', () => {
    expect(validateCard({ number: '4111111111111111', expiry: '12/99', cvv: '123', cardholder: 'Ada Lovelace' })).toEqual({ valid: true });
  });
});
