#!/usr/bin/env node
/**
 * Cross-SDK type consistency checker.
 * Ensures that all SDKs expose identical fields for core LTP structures.
 *
 * Types verified:
 *  - HandshakeInit / handshake_init
 *  - HandshakeAck / handshake_ack
 *  - LtpEnvelope / ltp_envelope
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');

const targets = [
  {
    name: 'HandshakeInit',
    ts: { file: 'sdk/js/src/types.ts', interface: 'HandshakeInitMessage' },
    py: { file: 'sdk/python/ltp_client/types.py', class: 'HandshakeInit' },
    ex: { file: 'sdk/elixir/lib/ltp/types.ex', type: 'handshake_init' },
    rs: { file: 'sdk/rust/ltp-client/src/types.rs', struct: 'HandshakeInit' },
  },
  {
    name: 'HandshakeAck',
    ts: { file: 'sdk/js/src/types.ts', interface: 'HandshakeAckMessage' },
    py: { file: 'sdk/python/ltp_client/types.py', class: 'HandshakeAck' },
    ex: { file: 'sdk/elixir/lib/ltp/types.ex', type: 'handshake_ack' },
    rs: { file: 'sdk/rust/ltp-client/src/types.rs', struct: 'HandshakeAck' },
  },
  {
    name: 'LtpEnvelope',
    ts: { file: 'sdk/js/src/types.ts', interface: 'LtpEnvelope' },
    py: { file: 'sdk/python/ltp_client/types.py', class: 'LtpEnvelope' },
    ex: { file: 'sdk/elixir/lib/ltp/types.ex', type: 'ltp_envelope' },
    rs: { file: 'sdk/rust/ltp-client/src/types.rs', struct: 'LtpEnvelope' },
  },
];

function readFile(relPath) {
  try {
    return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
  } catch (err) {
    console.error(`Error reading file ${relPath}: ${err.message}`);
    throw err;
  }
}

function parseTsInterface({ file, interface: interfaceName }) {
  const content = readFile(file);
  const regex = new RegExp(`interface\\s+${interfaceName}(?:<[^>]+>)?\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const match = content.match(regex);
  if (!match) {
    throw new Error(`Could not locate TypeScript interface ${interfaceName} in ${file}`);
  }
  const body = match[1];
  const fields = [];
  let depth = 0;
  body.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/**')) {
      depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
      return;
    }
    if (depth === 0) {
      const fieldMatch = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\??:/);
      if (fieldMatch) {
        fields.push(fieldMatch[1]);
      }
    }
    depth += (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
  });
  return fields;
}

function parsePythonDataclass({ file, class: className }) {
  const content = readFile(file);
  const lines = content.split(/\r?\n/);
  const classIndex = lines.findIndex((line) => line.trim().startsWith(`class ${className}`));
  if (classIndex === -1) {
    throw new Error(`Could not locate Python dataclass ${className} in ${file}`);
  }

  // Determine indentation level of class body
  let bodyIndent = null;
  for (let i = classIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) {
      continue;
    }
    const indentMatch = line.match(/^(\s+)/);
    if (indentMatch) {
      bodyIndent = indentMatch[1];
      break;
    } else {
      break;
    }
  }
  if (bodyIndent === null) {
    return [];
  }

  const fields = [];
  let inDocstring = false;

  for (let i = classIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    
    // Check if we hit another class or function definition at top level
    if ((line.startsWith('class ') || line.startsWith('def ')) && !line.startsWith(' ')) {
        break;
    }

    // Check if we are inside the class body
    if (line.length > 0 && !line.startsWith(bodyIndent) && line.trim().length > 0) {
       // Non-empty line that doesn't start with bodyIndent -> end of class
       break;
    }

    const trimmed = line.trim();
    
    if (trimmed.startsWith('"""')) {
      // Toggle docstring
      if (trimmed.length > 3 && trimmed.endsWith('"""') && trimmed !== '"""') {
          // Single line docstring
      } else {
          inDocstring = !inDocstring;
      }
      continue;
    }
    if (inDocstring) {
      continue;
    }

    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('@')) {
      continue;
    }
    
    // Stop at methods
    if (trimmed.startsWith('def ')) {
      // But don't break the whole loop, just skip methods? 
      // Usually methods are at the end, but technically fields can come after methods in Python (though rare/bad style for dataclasses).
      // However, for this check, we assume fields are before methods or we just parse everything that looks like a field.
      // But `result: ...` inside `def` looked like a field.
      // We need to skip the method body.
      
      // Since we rely on indentation, and methods are indented, 
      // and code inside methods is further indented...
      
      // If we see `def`, we should probably assume we are done with fields in a dataclass.
      break; 
    }

    const fieldMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:/);
    if (fieldMatch) {
      fields.push(fieldMatch[1]);
    }
  }
  return fields;
}

function parseElixirType({ file, type: typeName }) {
  const content = readFile(file);
  const regex = new RegExp(`@type\\s+${typeName}\\s*::\\s*%\\{([\\s\\S]*?)\\n\\s*\\}`, 'm');
  const match = content.match(regex);
  if (!match) {
    throw new Error(`Could not locate Elixir type ${typeName} in ${file}`);
  }
  const body = match[1];
  const fields = [];
  body.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      return;
    }
    const fieldMatch = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:/);
    if (fieldMatch) {
      fields.push(fieldMatch[1]);
    }
  });
  return fields;
}

function parseRustStruct({ file, struct }) {
  const content = readFile(file);
  const regex = new RegExp(`struct\\s+${struct}(?:<[^>]+>)?\\s*\\{([\\s\\S]*?)\\n\\}`, 'm');
  const match = content.match(regex);
  if (!match) {
    throw new Error(`Could not locate Rust struct ${struct} in ${file}`);
  }
  const body = match[1];
  const fields = [];
  body.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
      return;
    }
    const fieldMatch = trimmed.match(/^pub\s+(?:r#)?([A-Za-z_][A-Za-z0-9_]*)/);
    if (fieldMatch) {
      const name = fieldMatch[1] === 'type' ? 'type' : fieldMatch[1];
      fields.push(name);
    }
  });
  return fields;
}

function normalizeFields(fields) {
  return Array.from(new Set(fields.map((f) => f.replace(/['"]/g, '').trim()))).sort();
}

function compareSets(typeName, sets) {
  const [firstSdk, ...restSdks] = Object.entries(sets);
  const baseFields = new Set(firstSdk[1]);
  const errors = [];

  restSdks.forEach(([sdk, fieldList]) => {
    const sdkFields = new Set(fieldList);
    const missing = [...baseFields].filter((field) => !sdkFields.has(field));
    const extra = [...sdkFields].filter((field) => !baseFields.has(field));
    if (missing.length || extra.length) {
      errors.push({ sdk, missing, extra });
    }
  });

  return errors;
}

function main() {
  let hasErrors = false;
  targets.forEach((target) => {
    const tsFields = normalizeFields(parseTsInterface(target.ts));
    const pyFields = normalizeFields(parsePythonDataclass(target.py));
    const exFields = normalizeFields(parseElixirType(target.ex));
    const rsFields = normalizeFields(parseRustStruct(target.rs));

    const errors = compareSets(target.name, {
      TypeScript: tsFields,
      Python: pyFields,
      Elixir: exFields,
      Rust: rsFields,
    });

    if (errors.length === 0) {
      console.log(`✅ ${target.name}: all SDKs expose identical fields (${tsFields.length} fields)`);
    } else {
      hasErrors = true;
      console.error(`❌ ${target.name}: field mismatch detected`);
      errors.forEach((err) => {
        if (err.missing.length) {
          console.error(`  - ${err.sdk} missing fields: ${err.missing.join(', ')}`);
        }
        if (err.extra.length) {
          console.error(`  - ${err.sdk} has extra fields: ${err.extra.join(', ')}`);
        }
      });
    }
  });

  if (hasErrors) {
    process.exitCode = 1;
  } else {
    console.log('\nAll core types are consistent across SDKs 🎉');
  }
}

main();
