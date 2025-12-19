import fs from 'node:fs';
import path from 'node:path';
import { BranchInsight, InspectSummary, LtpFrame } from './types';

const CONTRACT = {
  name: 'ltp-inspect',
  version: '1.0',
  schema: 'docs/contracts/ltp-inspect.v1.schema.json',
} as const;

const TOOL = {
  name: 'ltp:inspect',
  build: process.env.LTP_BUILD ?? 'dev',
} as const;

type OutputFormat = 'json' | 'human' | 'both';
type Writer = (message: string) => void;

type ParsedArgs = {
  command: 'trace' | 'replay' | 'explain' | 'help';
  input?: string;
  format: OutputFormat;
  pretty: boolean;
  from?: string;
  branch?: string;
};

class CliError extends Error {
  exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.exitCode = exitCode;
  }
}

function parseArgs(argv: string[]): ParsedArgs {
  const commands: ParsedArgs['command'][] = ['trace', 'replay', 'explain', 'help'];
  const positionalCommand = commands.includes(argv[0] as ParsedArgs['command']) ? (argv.shift() as ParsedArgs['command']) : 'trace';

  const options: ParsedArgs = {
    command: positionalCommand,
    input: undefined,
    format: 'json',
    pretty: false,
    from: undefined,
    branch: undefined,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      options.command = 'help';
    } else if (token === '--input' || token === '-i') {
      options.input = argv[++i];
    } else if (token === '--format') {
      const format = argv[++i] as OutputFormat;
      options.format = format === 'human' || format === 'both' ? format : 'json';
    } else if (token === '--json') {
      options.format = 'json';
    } else if (token === '--text' || token === '--human') {
      options.format = 'human';
    } else if (token === '--both') {
      options.format = 'both';
    } else if (token === '--pretty') {
      options.pretty = true;
    } else if (token === '--from') {
      options.from = argv[++i];
    } else if (token === '--branch') {
      options.branch = argv[++i];
    } else if (!options.input && !token.startsWith('-')) {
      options.input = token;
    }
  }

  return options;
}

function loadFrames(filePath: string): { frames: LtpFrame[]; format: InspectSummary['input']['format'] } {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new CliError(`Frame log not found: ${resolved}`, 2);
  }

  const raw = fs.readFileSync(resolved, 'utf-8').trim();
  if (!raw) throw new CliError(`Frame log is empty: ${resolved}`, 2);

  if (raw.startsWith('[')) {
    try {
      const frames = JSON.parse(raw);
      if (!Array.isArray(frames)) throw new Error('Expected JSON array');
      return { frames, format: 'json' };
    } catch (err) {
      throw new CliError(`Invalid JSON array: ${(err as Error).message}`, 2);
    }
  }

  try {
    const frames = raw
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
    return { frames, format: 'jsonl' };
  } catch (err) {
    throw new CliError(`Invalid JSONL: ${(err as Error).message}`, 2);
  }
}

function driftLevelFromSnapshots(frames: LtpFrame[]): InspectSummary['orientation']['drift_level'] {
  const driftValues = frames
    .filter((f) => f.type === 'focus_snapshot')
    .map((f) => (f.payload?.drift ?? f.payload?.drift_level ?? f.payload?.driftLevel) as number | string | undefined)
    .filter((v): v is number | string => v !== undefined);

  if (!driftValues.length) return 'unknown';

  const last = driftValues[driftValues.length - 1];
  if (typeof last === 'string') {
    const normalized = last.toLowerCase();
    if (['low', 'medium', 'high'].includes(normalized)) return normalized as InspectSummary['orientation']['drift_level'];
    return 'unknown';
  }

  if (last <= 0.33) return 'low';
  if (last <= 0.66) return 'medium';
  return 'high';
}

function detectContinuity(frames: LtpFrame[]): { preserved: boolean; notes: string[] } {
  const tokens = frames
    .map((f) => f.continuity_token)
    .filter((token): token is string => typeof token === 'string' && token.length > 0);

  const unique = new Set(tokens);
  if (unique.size <= 1) return { preserved: true, notes: [] };

  return {
    preserved: false,
    notes: ['continuity token rotation detected mid-session'],
  };
}

function normalizeBranches(raw: unknown): { branches: BranchInsight[]; notes: string[]; violations: string[] } {
  if (!raw) return { branches: [], notes: [], violations: [] };

  const branchesArray = Array.isArray(raw)
    ? raw
    : typeof raw === 'object'
      ? Object.entries(raw as Record<string, any>).map(([id, value]) => ({ id, ...(value as Record<string, unknown>) }))
      : [];

  const normalized: BranchInsight[] = [];
  const notes: string[] = [];
  const violations: string[] = [];

  const idsInOrder: string[] = [];

  for (const entry of branchesArray as Array<Record<string, any>>) {
    const id = (entry.id ?? entry.name ?? 'unnamed') as string;
    const confidence = entry.confidence as number | undefined;
    const status = (entry.status as string | undefined) ?? (entry.class === 'primary' ? 'admissible' : 'degraded');

    const branch: BranchInsight = {
      id,
      confidence,
      status,
      path: entry.path as string | undefined,
      class: entry.class as string | undefined,
    };

    if (confidence === undefined) {
      notes.push(`branch ${id} missing confidence (tooling MAY normalize)`);
    } else if (confidence < 0 || confidence > 1) {
      notes.push(`branch ${id} confidence out of range [0,1]`);
      violations.push(`branch ${id} confidence outside 0..1`);
    }

    normalized.push(branch);
    idsInOrder.push(id);
  }

  const isSorted = idsInOrder.every((id, index) => index === 0 || idsInOrder[index - 1].localeCompare(id) <= 0);
  if (!isSorted && idsInOrder.length > 0) {
    violations.push('branches ordering violated (expected id-sorted ascending)');
  }

  const sorted = normalized.sort((a, b) => a.id.localeCompare(b.id));
  return { branches: sorted, notes, violations };
}

function summarize(
  frames: LtpFrame[],
  inputPath: string,
  format: InspectSummary['input']['format'],
): { summary: InspectSummary; violations: string[] } {
  const continuity = detectContinuity(frames);
  const driftLevel = driftLevelFromSnapshots(frames);
  const orientationStable = frames.some((f) => f.type === 'orientation');

  const lastRouteResponse = [...frames].reverse().find((f) => f.type === 'route_response');
  const { branches, notes: branchNotes, violations } = normalizeBranches(
    lastRouteResponse?.payload?.branches ?? lastRouteResponse?.payload?.routes ?? lastRouteResponse?.payload,
  );

  const baseNotes = [
    ...(Array.isArray(lastRouteResponse?.payload?.notes) ? lastRouteResponse?.payload?.notes : []),
  ];
  if (!orientationStable) baseNotes.push('no orientation frame observed');
  if (!lastRouteResponse) baseNotes.push('no route_response frame observed');

  const notes = [...baseNotes, ...branchNotes];

  return {
    summary: {
      contract: {
        name: CONTRACT.name,
        version: CONTRACT.version,
        schema: CONTRACT.schema,
      },
      generated_at: new Date().toISOString(),
      tool: {
        name: TOOL.name,
        build: TOOL.build,
      },
      input: {
        path: path.resolve(inputPath),
        frames: frames.length,
        format,
      },
      orientation: {
        stable: orientationStable,
        drift_level: driftLevel,
      },
      continuity: {
        preserved: continuity.preserved,
        notes: continuity.notes,
      },
      branches,
      notes,
    },
    violations,
  };
}

export function formatJson(summary: InspectSummary, pretty = false): string {
  return JSON.stringify(summary, null, pretty ? 2 : 0);
}

export function formatHuman(summary: InspectSummary): string {
  const lines: string[] = [];
  lines.push(`LTP INSPECT (v${summary.contract.version})`);
  lines.push(`contract: ${summary.contract.name} (${summary.contract.schema})`);
  lines.push(`input: ${summary.input.path}`);
  lines.push(`frames: ${summary.input.frames} (${summary.input.format})`);
  lines.push(`generated_at: ${summary.generated_at}`);
  lines.push(`tool: ${summary.tool.name} build=${summary.tool.build}`);
  lines.push('');
  lines.push('orientation:');
  lines.push(`  stable: ${summary.orientation.stable ? 'yes' : 'no'}`);
  lines.push(`  drift: ${summary.orientation.drift_level}`);
  lines.push(`  continuity: ${summary.continuity.preserved ? 'preserved' : 'rotated'}`);
  if (summary.continuity.notes.length) {
    for (const note of summary.continuity.notes) lines.push(`    note: ${note}`);
  }
  lines.push('');
  lines.push('future_branches:');
  if (!summary.branches.length) {
    lines.push('  - none observed');
  } else {
    for (const branch of summary.branches) {
      const attributes = [
        `status=${branch.status}`,
        branch.confidence !== undefined ? `score=${branch.confidence}` : 'score=NA',
        branch.class ? `class=${branch.class}` : null,
      ].filter(Boolean);
      lines.push(`  - ${branch.id} ${attributes.join('  ')}`.replace(/\s+$/, ''));
      if (branch.path) lines.push(`      path=${branch.path}`);
    }
  }
  if (summary.notes.length) {
    lines.push('');
    lines.push('notes:');
    for (const note of summary.notes) lines.push(`  - ${note}`);
  }
  return lines.join('\n');
}

export function runInspect(file: string): InspectSummary {
  const { frames, format } = loadFrames(file);
  return summarize(frames, file, format).summary;
}

function handleTrace(file: string, format: OutputFormat, pretty: boolean, writer: Writer): void {
  const { frames, format: inputFormat } = loadFrames(file);
  const { summary, violations } = summarize(frames, file, inputFormat);

  if (format === 'json') printJson(summary, pretty, writer);
  else if (format === 'human') printHuman(summary, writer);
  else {
    printJson(summary, pretty, writer);
    writer('');
    printHuman(summary, writer);
  }

  if (violations.length) {
    throw new CliError(`Contract violation: ${violations.join('; ')}`, 3);
  }
}

function handleReplay(file: string, from: string | undefined, writer: Writer): void {
  const { frames } = loadFrames(file);
  const startIndex = from ? frames.findIndex((f) => f.id === from || f.ts === from) : 0;
  const replayFrames = startIndex >= 0 ? frames.slice(startIndex) : frames;

  writer(`Replaying ${replayFrames.length} frames${from ? ` from ${from}` : ''}...`);
  for (const frame of replayFrames) {
    const label = `${frame.type}${frame.id ? `#${frame.id}` : ''}`;
    const continuity = frame.continuity_token ? ` ct=${frame.continuity_token}` : '';
    writer(`- ${label}${continuity}`);
  }
}

function handleExplain(file: string, branchId: string | undefined, writer: Writer): void {
  const { frames, format } = loadFrames(file);
  const { summary, violations } = summarize(frames, file, format);
  const target = branchId ?? summary.branches[0]?.id;

  if (!target) {
    writer('No branches present to explain.');
    return;
  }

  const branch = summary.branches.find((b) => b.id === target);
  if (!branch) {
    writer(`Branch ${target} not found.`);
    return;
  }

  writer(`Branch: ${target}`);
  writer(`Status: ${branch.status}`);
  if (branch.path) writer(`Path: ${branch.path}`);
  if (branch.class) writer(`Class: ${branch.class}`);
  if (branch.confidence !== undefined) writer(`Confidence: ${branch.confidence}`);
  else writer('Confidence: (not provided; tooling MAY normalize)');
  if (summary.continuity.notes.length) {
    writer('Continuity Notes:');
    for (const n of summary.continuity.notes) writer(`- ${n}`);
  }
  if (summary.orientation.drift_level !== 'unknown') {
    writer(`Observed drift level: ${summary.orientation.drift_level}`);
  }

  if (violations.length) {
    throw new CliError(`Contract violation: ${violations.join('; ')}`, 3);
  }
}

function printHelp(writer: Writer): void {
  writer('ltp:inspect — orientation inspector (no decisions made).');
  writer('');
  writer('Usage:');
  writer('  pnpm -w ltp:inspect -- [trace] --input <frames.jsonl> [--format json|human] [--pretty]');
  writer('  pnpm -w ltp:inspect -- replay --input <frames.jsonl> [--from <frameId>]');
  writer('  pnpm -w ltp:inspect -- explain --input <frames.jsonl> [--branch <id>]');
  writer('');
  writer('Examples:');
  writer('  pnpm -w ltp:inspect -- --input fixtures/ltp/demo.frames.jsonl');
  writer('  pnpm -w ltp:inspect -- --format human --input fixtures/ltp/demo.frames.jsonl');
  writer('  pnpm -w ltp:inspect -- replay --input fixtures/ltp/demo.frames.jsonl --from t3');
  writer('');
  writer('Output:');
  writer('  JSON (default) includes contract metadata, deterministic ordering, and orientation fields.');
  writer('  Human format mirrors kubectl describe: continuity, drift, and branches.');
  writer('');
  writer('Exit codes:');
  writer('  0 OK — contract produced');
  writer('  2 invalid input — unreadable or missing frames');
  writer('  3 contract violation — ordering or schema failure');
  writer('  4 runtime failure — unexpected error');
}

function printJson(summary: InspectSummary, pretty = false, writer: Writer): void {
  writer(formatJson(summary, pretty));
}

function printHuman(summary: InspectSummary, writer: Writer): void {
  writer(formatHuman(summary));
}

export function execute(argv: string[], logger: Pick<Console, 'log' | 'error'> = console): number {
  const writer = (message: string) => logger.log(message);
  const errorWriter = (message: string) => logger.error(message);
  const args = parseArgs(argv);

  try {
    if (!args.input && args.command !== 'help') {
      printHelp(writer);
      throw new CliError('Missing --input <frames.jsonl>', 2);
    }

    switch (args.command) {
      case 'trace':
        handleTrace(args.input as string, args.format, args.pretty, writer);
        break;
      case 'replay':
        handleReplay(args.input as string, args.from, writer);
        break;
      case 'explain':
        handleExplain(args.input as string, args.branch, writer);
        break;
      default:
        printHelp(writer);
    }
    return 0;
  } catch (err) {
    if (err instanceof CliError) {
      errorWriter(err.message);
      return err.exitCode;
    }
    errorWriter(`Runtime failure: ${(err as Error).message}`);
    return 4;
  }
}

export function main(argv = process.argv.slice(2)): void {
  const exitCode = execute(argv, console);
  process.exit(exitCode);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
