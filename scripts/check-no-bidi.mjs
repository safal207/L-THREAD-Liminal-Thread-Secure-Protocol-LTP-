#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import process from 'process';

const BIDI_REGEX = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069]/;
const DIRS_TO_SCAN = ['docs', 'specs', 'governance', 'positioning', 'adoption', 'tools', 'fixtures', 'examples', 'src', '.github'];
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'artifacts', 'reports', 'coverage']);
const EXTENSIONS_TO_SCAN = ['.md', '.json', '.jsonl', '.ts', '.js', '.yaml', '.yml'];

let filesWithBidi = [];
let missingFiles = [];

function runProvidedScan(targets) {
  console.log('Scanning provided files for hidden Unicode characters...');
  for (const target of targets) {
    if (!fs.existsSync(target)) {
      missingFiles.push(target);
      continue;
    }

    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      scanDir(target);
    } else {
      scanFile(target, false);
    }
  }
}

function runDefaultScan() {
  console.log(`Scanning for hidden Unicode characters in ${DIRS_TO_SCAN.join(', ')}...`);
  for (const dir of DIRS_TO_SCAN) {
    if (fs.existsSync(dir)) {
      scanDir(dir);
    }
  }
}

function scanFile(filePath, enforceExtensionFilter = true) {
  if (enforceExtensionFilter && !EXTENSIONS_TO_SCAN.includes(path.extname(filePath))) {
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  if (BIDI_REGEX.test(content)) {
    filesWithBidi.push(filePath);
  }
}

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (SKIP_DIRS.has(file)) continue;
      scanDir(filePath);
    } else {
      scanFile(filePath);
    }
  }
}

const providedPaths = process.argv.slice(2);

if (providedPaths.length > 0) {
  runProvidedScan(providedPaths);
} else {
  runDefaultScan();
}

if (missingFiles.length > 0) {
  console.error('ERROR: The following files were not found:');
  for (const file of missingFiles) {
    console.error(`- ${file}`);
  }
}

if (filesWithBidi.length > 0) {
  console.error('ERROR: Found hidden Unicode (bidi/zero-width) characters in the following files:');
  for (const file of filesWithBidi) {
    console.error(`- ${file}`);
  }
  console.error('\nPlease remove these characters to pass the check.');
}

if (missingFiles.length > 0 || filesWithBidi.length > 0) {
  process.exit(1);
}

console.log('Docs hygiene check passed. No hidden Unicode characters found.');
process.exit(0);
