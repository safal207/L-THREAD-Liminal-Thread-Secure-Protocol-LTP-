import { buildCanonicalInput, canonicalFlow } from '../sdk/js/src/examples/canonicalFlow';

function main(): void {
  const input = buildCanonicalInput();
  const result = canonicalFlow(input);

  // eslint-disable-next-line no-console
  console.log('\nCanonical flow complete:', JSON.stringify(result, null, 2));
}

main();
