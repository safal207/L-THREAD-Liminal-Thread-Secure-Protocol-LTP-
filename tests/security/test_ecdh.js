const { execSync } = require('child_process');
const path = require('path');
const assert = require('assert');

// Try to load crypto from built SDK
let crypto;
try {
  // Try loading from dist (if built)
  crypto = require('../../sdk/js/dist/index');
} catch (e) {
  console.error('Could not load JS SDK from dist/index.js.');
  console.error('Please run "cd sdk/js && npm install && npm run build" first.');
  console.error('Error:', e.message);
  process.exit(1);
}

const PYTHON_CLI = path.join(__dirname, 'ecdh_cli.py');

function runPython(args) {
  // Ensure we use python3 or python depending on env
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

async function testEcdh() {
  console.log('Testing ECDH Compatibility (JS <-> Python)...');

  // 1. Generate keys in JS
  console.log('  Generating JS keys...');
  const jsKeys = await crypto.generateKeyPair();
  
  // 2. Generate keys in Python
  console.log('  Generating Python keys...');
  const pyKeys = runPython('generate');

  // 3. JS derives secret using JS private + Python public
  console.log('  JS deriving secret...');
  const jsSecret = await crypto.deriveSharedSecret(jsKeys.privateKey, pyKeys.public);

  // 4. Python derives secret using Python private + JS public
  console.log('  Python deriving secret...');
  const pyResult = runPython(`derive ${pyKeys.private} ${jsKeys.publicKey}`);
  const pySecret = pyResult.secret;

  // 5. Compare
  console.log(`  JS Secret:     ${jsSecret.substring(0, 16)}...`);
  console.log(`  Python Secret: ${pySecret.substring(0, 16)}...`);

  if (jsSecret === pySecret) {
    console.log('✅ Secrets match! ECDH is compatible.');
  } else {
    console.error('❌ Secrets DO NOT match!');
    console.error(`JS: ${jsSecret}`);
    console.error(`PY: ${pySecret}`);
    process.exit(1);
  }
}

testEcdh().catch(err => {
  console.error(err);
  process.exit(1);
});

