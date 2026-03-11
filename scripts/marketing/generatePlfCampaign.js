#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function arg(name, fallback = '') {
  const idx = process.argv.indexOf(`--${name}`);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

const project = arg('project', 'LTP Newcomer Launch');
const owner = arg('owner', 'Unknown Owner');
const audience = arg('audience', 'Engineering + Security');

const root = process.cwd();
const templatesDir = path.join(root, 'docs', 'marketing', 'plf-kit', 'templates');
const scorecardTemplate = path.join(root, 'docs', 'marketing', 'plf-kit', 'scorecard-template.csv');

const ts = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join(root, 'artifacts', 'marketing', `plf-campaign-${ts}`);
fs.mkdirSync(outDir, { recursive: true });

for (const file of fs.readdirSync(templatesDir)) {
  const src = path.join(templatesDir, file);
  const dst = path.join(outDir, file);
  let content = fs.readFileSync(src, 'utf8');
  content = `> Project: ${project}\n> Owner: ${owner}\n> Audience: ${audience}\n\n` + content;
  fs.writeFileSync(dst, content);
}

fs.copyFileSync(scorecardTemplate, path.join(outDir, 'scorecard.csv'));

const summary = `# PLF Campaign Summary\n\n- Project: ${project}\n- Owner: ${owner}\n- Audience: ${audience}\n- Generated at: ${new Date().toISOString()}\n\n## Next step\nOpen day-1.md and schedule the first touchpoint.\n`;
fs.writeFileSync(path.join(outDir, 'campaign-summary.md'), summary);

console.log(`Generated PLF campaign at: ${path.relative(root, outDir)}`);
