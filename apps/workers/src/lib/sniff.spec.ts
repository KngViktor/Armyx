import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sniff } from './sniff';

test('sniff detects real file types and rejects disguised files', () => {
  assert.equal(sniff(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0])), 'image/jpeg');
  assert.equal(sniff(Buffer.from('%PDF-1.7\n')), 'application/pdf');
  assert.equal(sniff(Buffer.from('MZ\x90\x00 executable')), null);
});
