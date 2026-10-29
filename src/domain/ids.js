import { randomInt, randomUUID } from 'node:crypto';

const REFERENCE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function newId() {
  return randomUUID();
}

export function newReference() {
  let reference = '';
  for (let index = 0; index < 8; index += 1) {
    reference += REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)];
  }
  // Split into pairs to make the code easier to read aloud.
  return reference.match(/.{1,4}/g).join('-');
}
