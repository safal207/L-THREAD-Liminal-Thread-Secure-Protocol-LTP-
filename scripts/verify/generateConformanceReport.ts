import fs from 'node:fs';
import path from 'node:path';

export function ensureDirForFile(filePath: string): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
}

export async function generateConformanceReport(opts: {
  outPath: string;
  report: unknown;
}): Promise<string> {
  const outPath = path.resolve(opts.outPath);
  ensureDirForFile(outPath);

  const json = JSON.stringify(opts.report, null, 2);
  fs.writeFileSync(outPath, `${json}\n`, 'utf-8');

  // eslint-disable-next-line no-console
  console.log(`LTP_REPORT_PATH=${outPath}`);

  return outPath;
}
