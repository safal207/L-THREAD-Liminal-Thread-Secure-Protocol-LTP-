import fs from 'node:fs';
import path from 'node:path';

type Report = {
  schemaVersion: string;
  protocolVersion: string;
  toolingVersion?: string;
  overall: 'OK' | 'WARN' | 'FAIL';
  determinismHash?: string;
  summary?: { passed?: number; warnings?: number; failed?: number };
  suites?: Array<{
    id: string;
    result: 'OK' | 'WARN' | 'FAIL';
    checks?: Array<{ id: string; result: 'OK' | 'WARN' | 'FAIL'; details?: string }>;
  }>;
  timings?: { durationMs?: number };
};

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function loadReport(filePath: string): Report {
  const p = path.resolve(filePath);
  if (!fs.existsSync(p)) die(`Report not found: ${p}`);
  return JSON.parse(fs.readFileSync(p, 'utf-8'));
}

function printHeader(r: Report): void {
  console.log('LTP INSPECT');
  console.log(`Protocol: ${r.protocolVersion}`);
  console.log(`Overall: ${r.overall}`);
  if (r.determinismHash) console.log(`Determinism: ${r.determinismHash}`);
  if (r.timings?.durationMs != null)
    console.log(`Duration: ${(r.timings.durationMs / 1000).toFixed(1)}s`);
  console.log('');
}

function printTimeline(r: Report): void {
  if (!r.suites?.length) return;
  console.log('Timeline:');
  let t = 0;
  for (const s of r.suites) {
    console.log(`  [${t.toFixed(1)}s] ${s.id.padEnd(20)} ${s.result}`);
    t += 1.2; // placeholder; real timing stays in report
  }
  console.log('');
}

function printSuites(r: Report): void {
  if (!r.suites?.length) return;
  console.log('Suites:');
  for (const s of r.suites) {
    const checks = s.checks?.length ?? 0;
    console.log(`  - ${s.id.padEnd(20)} ${s.result} (${checks} checks)`);
  }
  console.log('');
}

function printWarnings(r: Report): void {
  const warns =
    r.suites?.flatMap((s) =>
      s.checks?.filter((c) => c.result === 'WARN').map((c) => `${s.id}: ${c.id}`) ?? []
    ) ?? [];
  if (!warns.length) return;
  console.log('Warnings:');
  for (const w of warns) console.log(`  - ${w}`);
  console.log('');
}

function main(): void {
  const file = process.argv[2];
  if (!file) die('Usage: ltp inspect-report <conformance-report.json>');

  const report = loadReport(file);

  if (report.schemaVersion !== 'v0.1') {
    die(`Unsupported report schema: ${report.schemaVersion} (expected v0.1)`);
  }

  printHeader(report);
  printTimeline(report);
  printSuites(report);
  printWarnings(report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
