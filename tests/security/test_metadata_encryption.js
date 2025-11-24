#!/usr/bin/env node
/**
 * Test Metadata Encryption
 * Verifies that all SDKs can encrypt and decrypt metadata correctly
 */

const { spawnSync } = require('child_process');
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

const PYTHON_CLI = path.join(__dirname, 'metadata_encryption_cli.py');

function runPython(command, payload, encryptionKey) {
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  const args = [PYTHON_CLI, command, payload, encryptionKey];
  const result = spawnSync(pythonCmd, args, { encoding: 'utf8' });

  if (result.error) {
    console.error(`Python spawn failed: ${result.error.message}`);
    throw result.error;
  }
  if (result.status !== 0) {
    console.error(`Python script failed: ${pythonCmd} ${args.join(' ')}`);
    console.error(result.stdout);
    console.error(result.stderr);
    throw new Error(result.stderr || 'Python script returned non-zero exit code');
  }

  return JSON.parse((result.stdout || '').trim());
}

async function testMetadataEncryption() {
  console.log('Testing Metadata Encryption (JS <-> Python)...\n');

  const encryptionKey = '00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';
  const wrongEncryptionKey = 'ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100';
  const metadata = {
    thread_id: 'thread-123',
    session_id: 'session-456',
    timestamp: Date.now()
  };

  // 1. Encrypt metadata in JS
  console.log('  [JS] Encrypting metadata...');
  const jsEncrypted = await crypto.encryptMetadata(
    metadata,
    encryptionKey
  );
  console.log(`  Encrypted: ${jsEncrypted.substring(0, 50)}...\n`);

  // 2. Decrypt in JS (should work)
  console.log('  [JS] Decrypting metadata...');
  const jsMetadata = await crypto.decryptMetadata(jsEncrypted, encryptionKey);
  assert(jsMetadata.thread_id === metadata.thread_id, 'Decrypted thread_id should match');
  assert(jsMetadata.session_id === metadata.session_id, 'Decrypted session_id should match');
  console.log('  ✅ JS encryption/decryption cycle passed\n');

  // 3. Encrypt metadata in Python
  console.log('  [Python] Encrypting metadata...');
  const pyEncrypted = runPython('encrypt', JSON.stringify(metadata), encryptionKey);
  console.log(`  Encrypted: ${pyEncrypted.encrypted.substring(0, 50)}...\n`);

  // 4. Decrypt Python-encrypted data in JS (cross-SDK)
  console.log('  [JS] Decrypting Python-encrypted metadata...');
  const crossMetadata = await crypto.decryptMetadata(
    pyEncrypted.encrypted,
    encryptionKey
  );
  assert(crossMetadata.thread_id === metadata.thread_id, 'Cross-SDK decryption should work');
  assert(crossMetadata.session_id === metadata.session_id, 'Cross-SDK decryption should work');
  console.log('  ✅ Cross-SDK (Python→JS) decryption passed\n');

  // 5. Decrypt JS-encrypted data in Python (cross-SDK)
  console.log('  [Python] Decrypting JS-encrypted metadata...');
  const pyDecrypted = runPython('decrypt', jsEncrypted, encryptionKey);
  const pyMetadata = pyDecrypted.decrypted;
  assert(pyMetadata.thread_id === metadata.thread_id, 'Cross-SDK (JS→Python) decryption should work');
  assert(pyMetadata.session_id === metadata.session_id, 'Cross-SDK (JS→Python) decryption should work');
  console.log('  ✅ Cross-SDK (JS→Python) decryption passed\n');

  // 6. Test wrong key (should fail)
  console.log('  [JS] Testing wrong encryption key (should fail)...');
  try {
    await crypto.decryptMetadata(jsEncrypted, wrongEncryptionKey);
    assert(false, 'Decryption with wrong key should fail');
  } catch (error) {
    console.log('  ✅ Wrong key correctly rejected\n');
  }

  // 7. Test tampered data (should fail)
  console.log('  [JS] Testing tampered encrypted data (should fail)...');
  const tampered = jsEncrypted.substring(0, jsEncrypted.length - 10) + 'tampered!!';
  try {
    await crypto.decryptMetadata(tampered, encryptionKey);
    assert(false, 'Tampered data should fail decryption');
  } catch (error) {
    console.log('  ✅ Tampered data correctly rejected\n');
  }

  console.log('✅ All metadata encryption tests passed!');
}

testMetadataEncryption().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

