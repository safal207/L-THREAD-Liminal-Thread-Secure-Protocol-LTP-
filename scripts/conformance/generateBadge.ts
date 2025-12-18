import fs from 'node:fs';
import path from 'node:path';

type Overall = 'OK' | 'WARN' | 'FAIL';

const COLORS: Record<Overall, string> = {
  OK: '#2ecc71',
  WARN: '#f1c40f',
  FAIL: '#e74c3c',
};

export function generateBadge(overall: Overall, outPath: string): void {
  const color = COLORS[overall];
  const label = `LTP ${overall}`;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="120" height="20">
  <rect width="120" height="20" rx="4" fill="${color}"/>
  <text x="60" y="14" text-anchor="middle"
        font-family="Verdana, Arial"
        font-size="11" fill="#fff">${label}</text>
</svg>`.trim();

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, svg, 'utf-8');
}
