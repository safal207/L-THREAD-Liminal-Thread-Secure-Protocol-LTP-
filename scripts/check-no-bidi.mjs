#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import process from 'process';

const BIDI_REGEX = /[\u202A-\u202E\u2066-\u2069\u200B]/;
const DIRS_TO_SCAN = ['docs', 'specs', 'governance', 'positioning', 'adoption'];
const EXTENSIONS_TO_SCAN = ['.md'];

let filesWithBidi = [];

function scanDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      scanDir(filePath);
    } else if (EXTENSIONS_TO_SCAN.includes(path.extname(filePath))) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (BIDI_REGEX.test(content)) {
        filesWithBidi.push(filePath);
      }
    }
  }
}

console.log(`Scanning for hidden Unicode characters in ${DIRS_TO_SCAN.join(', ')}...`);

for (const dir of DIRS_TO_SCAN) {
  if (fs.existsSync(dir)) {
    scanDir(dir);
  }
}

if (filesWithBidi.length > 0) {
  console.error('ERROR: Found hidden Unicode (bidi/zero-width) characters in the following files:');
  for (const file of filesWithBidi) {
    console.error(`- ${file}`);
  }
  console.error('\nPlease remove these characters to pass the check.');
  process.exit(1);
} else {
  console.log('Docs hygiene check passed. No hidden Unicode characters found.');
  process.exit(0);
}
