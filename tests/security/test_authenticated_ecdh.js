#!/usr/bin/env node
/**
 * Test Authenticated ECDH (signEcdhPublicKey/verifyEcdhPublicKey)
 * Verifies that all SDKs can sign and verify ECDH public keys correctly
 */

const { execSync } = require('child_process');
const path = require('path');
const assert = require('assert');

// Try to load crypto from built SDK
let crypto;
try {
  crypto = require('../../sdk/js/dist/index');
} catch (e) {
  console.error('Could not load JS SDK from dist/index.js.');
  console.error('Please run "cd sdk/js && npm install && npm run build" first.');
  process.exit(1);
}

const PYTHON_CLI = path.join(__dirname, 'authenticated_ecdh_cli.py');

function runPython(args) {
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  const cmd = `${pythonCmd} "${PYTHON_CLI}" ${args}`;
  try {
    const output = execSync(cmd, { encoding: 'utf8' });
    return JSON.parse(output.trim());
  } catch (e) {
    console.error(`Python script failed: ${cmd}`);
    console.error(e.stdout);
    console.error(e.stderr);
    throw e;
  }
}

async function testAuthenticatedEcdh() {
  console.log('Testing Authenticated ECDH (JS <-> Python)...\n');

  const secretKey = 'test-secret-key-for-hmac-signing-32-bytes!!';
  const clientId = 'test-client-123';
  const timestamp = Math.floor(Date.now() / 1000);

  // 1. Generate ECDH keys in JS
  console.log('  [JS] Generating ECDH key pair...');
  const jsKeys = await crypto.generateKeyPair();

  // 2. Sign ECDH public key in JS
  console.log('  [JS] Signing ECDH public key...');
  const jsSignature = await crypto.signEcdhPublicKey(
    jsKeys.publicKey,
    clientId,
    timestamp,
    secretKey
  );

  // 3. Verify signature in JS (should pass)
  console.log('  [JS] Verifying signature...');
  const jsVerifyResult = await crypto.verifyEcdhPublicKey(
    jsKeys.publicKey,
    clientId,
    timestamp,
    jsSignature,
    secretKey
  );

  assert(jsVerifyResult.valid, 'JS signature verification should pass');
  console.log('  ✅ JS signature verification passed\n');

  // 4. Generate ECDH keys in Python
  console.log('  [Python] Generating ECDH key pair...');
  const pyKeys = runPython('generate');

  // 5. Sign ECDH public key in Python
  console.log('  [Python] Signing ECDH public key...');
  const pyResult = runPython(`sign ${pyKeys.public} ${clientId} ${timestamp} ${secretKey}`);
  const pySignature = pyResult.signature;

  // 6. Verify Python signature in JS
  console.log('  [JS] Verifying Python signature...');
  const crossVerifyResult = await crypto.verifyEcdhPublicKey(
    pyKeys.public,
    clientId,
    timestamp,
    pySignature,
    secretKey
  );

  assert(crossVerifyResult.valid, 'Cross-SDK signature verification should pass');
  console.log('  ✅ Cross-SDK (Python→JS) signature verification passed\n');

  // 7. Verify JS signature in Python
  console.log('  [Python] Verifying JS signature...');
  const pyVerifyResult = runPython(`verify ${jsKeys.publicKey} ${clientId} ${timestamp} ${jsSignature} ${secretKey}`);
  assert(pyVerifyResult.valid, 'Cross-SDK (JS→Python) signature verification should pass');
  console.log('  ✅ Cross-SDK (JS→Python) signature verification passed\n');

  // 8. Test invalid signature (should fail)
  console.log('  [JS] Testing invalid signature (should fail)...');
  const invalidResult = await crypto.verifyEcdhPublicKey(
    jsKeys.publicKey,
    clientId,
    timestamp,
    'invalid-signature',
    secretKey
  );
  assert(!invalidResult.valid, 'Invalid signature should be rejected');
  console.log('  ✅ Invalid signature correctly rejected\n');

  // 9. Test wrong secret key (should fail)
  console.log('  [JS] Testing wrong secret key (should fail)...');
  const wrongKeyResult = await crypto.verifyEcdhPublicKey(
    jsKeys.publicKey,
    clientId,
    timestamp,
    jsSignature,
    'wrong-secret-key'
  );
  assert(!wrongKeyResult.valid, 'Signature with wrong key should be rejected');
  console.log('  ✅ Wrong secret key correctly rejected\n');

  console.log('✅ All Authenticated ECDH tests passed!');
}

testAuthenticatedEcdh().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

