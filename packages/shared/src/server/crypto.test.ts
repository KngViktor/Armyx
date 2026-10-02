import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { FieldCrypto } from './crypto';

test('encrypt/decrypt round trip and key rotation', () => {
  const k1 = randomBytes(32), k2 = randomBytes(32), bi = randomBytes(32);
  const old = new FieldCrypto({ keys: { 1: k1 }, currentVersion: 1, blindIndexKey: bi });
  const blob = old.encryptJson({ nin: '12345678901' });
  const rotated = new FieldCrypto({ keys: { 1: k1, 2: k2 }, currentVersion: 2, blindIndexKey: bi });
  assert.deepEqual(rotated.decryptJson(blob), { nin: '12345678901' });
  assert.equal(rotated.encrypt('x')[0], 2);
  assert.ok(old.blindIndex(' A@B.ng ').equals(rotated.blindIndex('a@b.ng')));
});

test('tampering is detected', () => {
  const c = new FieldCrypto({ keys: { 1: randomBytes(32) }, currentVersion: 1, blindIndexKey: randomBytes(32) });
  const blob = c.encrypt('secret');
  blob[blob.length - 1] ^= 1;
  assert.throws(() => c.decrypt(blob));
});
