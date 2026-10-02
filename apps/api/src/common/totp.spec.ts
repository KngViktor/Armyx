import { test } from 'node:test';
import assert from 'node:assert/strict';
import { base32Decode, base32Encode, totpAt, verifyTotp } from './totp';

test('RFC 6238 test vector (SHA1, T=59s)', () => {
  const secret = base32Encode(Buffer.from('12345678901234567890'));
  // RFC value is 94287082 for 8 digits -> last 6 digits
  assert.equal(totpAt(secret, Math.floor(59 / 30)), '287082');
  assert.equal(base32Decode(secret).toString(), '12345678901234567890');
});

test('verify accepts current code and rejects wrong code', () => {
  const secret = base32Encode(Buffer.from('abcdefghijabcdefghij'));
  const now = Date.now();
  const code = totpAt(secret, Math.floor(now / 30_000));
  assert.notEqual(verifyTotp(secret, code, now), null);
  assert.equal(verifyTotp(secret, code === '000000' ? '111111' : '000000', now), null);
});
