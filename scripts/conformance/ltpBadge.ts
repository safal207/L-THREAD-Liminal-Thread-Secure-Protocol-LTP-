import fs from 'node:fs';
import path from 'node:path';
import type { ConformanceReportV01 } from './generateConformanceReport';
import { generateBadge } from './generateBadge';

type Overall = 'OK' | 'WARN' | 'FAIL';

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

const reportPath = process.argv[2];
if (!reportPath) {
  die('Usage: ltp badge <conformance-report.json>');
}

const absoluteReportPath = path.resolve(reportPath);
const reportContent = fs.readFileSync(absoluteReportPath, 'utf-8');
const report = JSON.parse(reportContent) as ConformanceReportV01;

if (report.schemaVersion !== 'v0.1') {
  die(`Unsupported schema: ${report.schemaVersion}`);
}

const overall = report.overall as Overall;
if (!['OK', 'WARN', 'FAIL'].includes(overall)) {
  die(`Unsupported overall status: ${report.overall}`);
}

const out = path.resolve('artifacts/ltp-badge.svg');
generateBadge(overall, out);

console.log(`LTP_BADGE_PATH=${out}`);
