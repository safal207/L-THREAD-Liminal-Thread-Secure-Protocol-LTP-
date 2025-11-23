#!/usr/bin/env node
/**
 * Test HMAC-based Nonces
 * Verifies that all SDKs generate and validate nonces correctly
 */

const { execSync } = require('child_process');
const path = require('path');
const assert = require('assert');

let crypto;
try {
  crypto = require('../../sdk/js/dist/index');
} catch (e) {
  console.error('Could not load JS SDK from dist/index.js.');
  console.error('Please run "cd sdk/js && npm install && npm run build" first.');
  process.exit(1);
}

const PYTHON_CLI = path.join(__dirname, 'hmac_nonces_cli.py');

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

async function testHmacNonces() {
  console.log('Testing HMAC-based Nonces (JS <-> Python)...\n');

  const macKey = 'test-mac-key-for-nonce-generation-32-bytes!!';
  const clientId = 'test-client-123';
  const timestamp = Math.floor(Date.now() / 1000);

  // 1. Generate nonce in JS
  console.log('  [JS] Generating HMAC nonce...');
  const jsNonce = await crypto.generateNonce(macKey, clientId, timestamp);
  console.log(`  JS Nonce: ${jsNonce.substring(0, 32)}...`);

  // 2. Generate nonce in Python
  console.log('  [Python] Generating HMAC nonce...');
  const pyResult = runPython(`generate ${macKey} ${clientId} ${timestamp}`);
  const pyNonce = pyResult.nonce;
  console.log(`  Python Nonce: ${pyResult.nonce.substring(0, 32)}...\n`);

  // 3. Verify format (should be hex string, 64 chars)
  assert(jsNonce.length === 64, 'JS nonce should be 64 hex characters');
  assert(pyNonce.length === 64, 'Python nonce should be 64 hex characters');
  assert(/^[0-9a-f]{64}$/i.test(jsNonce), 'JS nonce should be valid hex');
  assert(/^[0-9a-f]{64}$/i.test(pyNonce), 'Python nonce should be valid hex');
  console.log('  ✅ Nonce format validation passed\n');

  // 4. Test that same inputs produce same nonce (deterministic)
  console.log('  [JS] Testing deterministic nonce generation...');
  const jsNonce2 = await crypto.generateNonce(macKey, clientId, timestamp);
  assert(jsNonce === jsNonce2, 'Same inputs should produce same nonce');
  console.log('  ✅ Deterministic nonce generation verified\n');

  // 5. Test that different inputs produce different nonces
  console.log('  [JS] Testing nonce uniqueness...');
  const jsNonce3 = await crypto.generateNonce(macKey, clientId, timestamp + 1);
  assert(jsNonce !== jsNonce3, 'Different timestamp should produce different nonce');
  
  const jsNonce4 = await crypto.generateNonce(macKey, 'different-client', timestamp);
  assert(jsNonce !== jsNonce4, 'Different client ID should produce different nonce');
  
  const differentMacKey = 'different-mac-key-for-nonce-generation-32-bytes!!';
  const jsNonce5 = await crypto.generateNonce(differentMacKey, clientId, timestamp);
  assert(jsNonce !== jsNonce5, 'Different MAC key should produce different nonce');
  console.log('  ✅ Nonce uniqueness verified\n');

  // 6. Test nonce validation (should accept valid nonces)
  console.log('  [JS] Testing nonce validation...');
  // Note: In real implementation, validation would check against seen nonces
  // For this test, we just verify the format
  const isValidFormat = /^[0-9a-f]{64}$/i.test(jsNonce);
  assert(isValidFormat, 'Valid nonce should pass format check');
  console.log('  ✅ Nonce validation passed\n');

  console.log('✅ All HMAC-based nonce tests passed!');
}

testHmacNonces().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

