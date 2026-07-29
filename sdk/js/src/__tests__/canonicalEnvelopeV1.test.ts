import { readFileSync } from 'fs';
import { resolve } from 'path';
import { serializeCanonical } from '../crypto';

const root = resolve(__dirname, '../../../../');
const fixture = JSON.parse(readFileSync(resolve(root, 'tests/security/canonical-envelope-v1.json'), 'utf8'));
const expected = readFileSync(resolve(root, 'tests/security/canonical-envelope-v1.txt'), 'utf8').trimEnd();

const actual = serializeCanonical(fixture);
if (actual !== expected) {
  throw new Error(`Canonical Envelope v1 mismatch\nexpected: ${expected}\nactual:   ${actual}`);
}

let rejected = false;
try {
  serializeCanonical({ ...fixture, payload: { unsafe: Number.MAX_SAFE_INTEGER + 1 } });
} catch {
  rejected = true;
}
if (!rejected) {
  throw new Error('Canonical Envelope v1 must reject unsafe integers');
}

console.log('✓ Canonical Envelope v1 JavaScript golden vector');
