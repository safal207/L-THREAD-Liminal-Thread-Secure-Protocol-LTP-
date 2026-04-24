import assert from 'node:assert/strict';
import { LtpClient } from '../client';
import { __setNodeCryptoLoaderForTests, generateNonce } from '../crypto';

function runTest(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`✔ ${name}`));
}

function withOverriddenGlobalCrypto<T>(value: Crypto | undefined, fn: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    enumerable: descriptor?.enumerable ?? true,
    writable: true,
    value,
  });

  try {
    return fn();
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, 'crypto', descriptor);
    } else {
      delete (globalThis as Record<string, unknown>).crypto;
    }
  }
}

async function testNonceFailsClosedWithoutCsprng(): Promise<void> {
  await withOverriddenGlobalCrypto(undefined, async () => {
    __setNodeCryptoLoaderForTests(() => null);
    try {
      await assert.rejects(
        generateNonce('mac-key', 'client-a', Date.now()),
        /Cryptographically secure randomness is required for nonce generation/
      );
    } finally {
      __setNodeCryptoLoaderForTests(null);
    }
  });
}

function testClientUuidFailsClosedWithoutCsprng(): void {
  const client = new LtpClient('ws://localhost:8080', { clientId: 'security-test-client' }) as any;
  const originalGetNodeCryptoModule = client.getNodeCryptoModule;
  client.getNodeCryptoModule = () => null;

  try {
    assert.throws(
      () => client.generateUUIDv4(),
      /Cryptographically secure randomness is required for UUID generation/
    );
    assert.throws(
      () => client.generateSecureRandomHex(16),
      /Cryptographically secure randomness is required for UUID generation/
    );
  } finally {
    client.getNodeCryptoModule = originalGetNodeCryptoModule;
  }
}

(async () => {
  const tests: Array<[string, () => void | Promise<void>]> = [
    ['nonce generation fails closed when CSPRNG is unavailable', testNonceFailsClosedWithoutCsprng],
    ['client UUID/random generation does not silently downgrade to Math.random', testClientUuidFailsClosedWithoutCsprng],
  ];

  for (const [name, testFn] of tests) {
    try {
      await runTest(name, testFn);
    } catch (error) {
      console.error(`✖ ${name}`);
      console.error(error);
      process.exitCode = 1;
      break;
    }
  }
})();
