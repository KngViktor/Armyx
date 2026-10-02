/**
 * Application IDs look like `NA-26-RRI-7K3M9QX2-4` :
 *   NA - <yy> - <exercise code> - <8 chars Crockford base32> - <check char>
 * They are generated without a DB round-trip (so the API can respond instantly
 * while the write is queued) and carry a check character so typos are caught
 * before hitting the status lookup endpoint.
 */
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32 (no I, L, O, U)

function checkChar(body: string): string {
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const idx = ALPHABET.indexOf(body[i]!);
    const v = idx >= 0 ? idx : body.charCodeAt(i);
    sum += v * (i + 1);
  }
  return ALPHABET[sum % 32]!;
}

/** `randomBytes` is injected so this works in Node (crypto) and in tests. */
export function generateApplicationId(exerciseCode: string, year: number, randomBytes: Uint8Array): string {
  if (randomBytes.length < 8) throw new Error('need 8 random bytes');
  let token = '';
  for (let i = 0; i < 8; i++) token += ALPHABET[randomBytes[i]! % 32];
  const body = `NA-${String(year).slice(-2)}-${exerciseCode}-${token}`;
  return `${body}-${checkChar(body)}`;
}

export function isValidApplicationId(id: string): boolean {
  const m = /^(NA-\d{2}-[A-Z0-9-]{3,20}-[0-9A-HJKMNP-TV-Z]{8})-([0-9A-HJKMNP-TV-Z])$/.exec(id.toUpperCase());
  return !!m && checkChar(m[1]!) === m[2];
}
