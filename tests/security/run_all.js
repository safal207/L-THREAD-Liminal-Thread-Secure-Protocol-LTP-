#!/usr/bin/env node
/**
 * Run all security feature tests
 */

const { spawn } = require('child_process');
const path = require('path');

const tests = [
  { name: 'ECDH Key Exchange', file: 'test_ecdh.js' },
  { name: 'Authenticated ECDH', file: 'test_authenticated_ecdh.js' },
  { name: 'HMAC-based Nonces', file: 'test_hmac_nonces.js' },
  { name: 'Metadata Encryption', file: 'test_metadata_encryption.js' },
  { name: 'Hash Chaining', file: 'test_hash_chaining.js' },
];

async function runTest(test) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Running: ${test.name}`);
    console.log('='.repeat(60));

    const testPath = path.join(__dirname, test.file);
    const proc = spawn('node', [testPath], {
      stdio: 'inherit',
      shell: true
    });

    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ ${test.name} passed\n`);
        resolve();
      } else {
        console.error(`❌ ${test.name} failed with code ${code}\n`);
        reject(new Error(`${test.name} failed`));
      }
    });

    proc.on('error', (err) => {
      console.error(`Failed to run ${test.name}:`, err);
      reject(err);
    });
  });
}

async function runAllTests() {
  console.log('🧪 Running all security feature tests...\n');

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      await runTest(test);
      passed++;
    } catch (error) {
      failed++;
      // Continue with other tests
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📦 Total:  ${tests.length}`);

  if (failed > 0) {
    console.log('\n❌ Some tests failed. Please check the output above.');
    process.exit(1);
  } else {
    console.log('\n🎉 All security tests passed!');
    process.exit(0);
  }
}

runAllTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

