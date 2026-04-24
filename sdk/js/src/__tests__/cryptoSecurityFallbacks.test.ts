import assert from 'node:assert/strict';
import { LtpClient } from '../client';
import { __setNodeCryptoLoaderForTests, generateNonce } from '../crypto';

type MinimalCrypto = {
  getRandomValues?: <T extends ArrayBufferView>(array: T) => T;
  randomUUID?: () => string;
};

function runTest(name: string, fn: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(fn)
    .then(() => console.log(`✔ ${name}`));
}

async function withOverriddenGlobalCrypto<T>(
  value: MinimalCrypto | undefined,
  fn: () => T | Promise<T>
): Promise<T> {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    enumerable: descriptor?.enumerable ?? true,
    writable: true,
    value,
  });

  try {
    return await fn();
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

async function testNonceUsesGetRandomValuesWhenRandomUuidMissing(): Promise<void> {
  const fakeCrypto: MinimalCrypto = {
    getRandomValues<T extends ArrayBufferView>(array: T): T {
      const view = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
      for (let i = 0; i < view.length; i += 1) {
        view[i] = (i + 1) & 0xff;
      }
      return array;
    },
  };

  await withOverriddenGlobalCrypto(fakeCrypto, async () => {
    const nonce = await generateNonce('mac-key', 'client-a', Date.now());
    assert.equal(typeof nonce, 'string');
    assert.equal(nonce.length, 64);
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
    ['nonce generation uses getRandomValues when randomUUID is unavailable', testNonceUsesGetRandomValuesWhenRandomUuidMissing],
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
