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

const SUPPORTED_TRACE_VERSIONS = ['0.1'] as const;

type OutputFormat = 'json' | 'human';
type ColorMode = 'auto' | 'always' | 'never';
type Writer = (message: string) => void;

type ParsedArgs = {
  command: 'trace' | 'replay' | 'explain' | 'help';
  input?: string;
  format: OutputFormat;
  pretty: boolean;
  from?: string;
  branch?: string;
  color: ColorMode;
  quiet: boolean;
  verbose: boolean;
  output?: string;
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
    format: 'human',
    pretty: false,
    from: undefined,
    branch: undefined,
    color: 'auto',
    quiet: false,
    verbose: false,
    output: undefined,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      options.command = 'help';
    } else if (token === '--input' || token === '-i') {
      options.input = argv[++i];
    } else if (token === '--format') {
      const format = argv[++i] as OutputFormat;
      options.format = format === 'human' || format === 'json' ? format : 'human';
    } else if (token === '--json') {
      options.format = 'json';
    } else if (token === '--text' || token === '--human') {
      options.format = 'human';
    } else if (token === '--pretty') {
      options.pretty = true;
    } else if (token === '--from') {
      options.from = argv[++i];
    } else if (token === '--branch') {
      options.branch = argv[++i];
    } else if (token === '--color') {
      const mode = argv[++i] as ColorMode;
      options.color = ['auto', 'always', 'never'].includes(mode) ? mode : 'auto';
    } else if (token === '--quiet' || token === '-q') {
      options.quiet = true;
    } else if (token === '--verbose' || token === '-v') {
      options.verbose = true;
    } else if (token === '--output' || token === '-o') {
      options.output = argv[++i];
    } else if (!options.input && !token.startsWith('-')) {
      options.input = token;
    }
  }

  return options;
}

function readStdin(): string {
  return fs.readFileSync(0, 'utf-8');
}

function loadFrames(filePath: string): { frames: LtpFrame[]; format: InspectSummary['input']['format']; inputPath: string } {
  const isStdin = filePath === '-' || filePath === undefined;
  const resolved = isStdin ? 'stdin' : path.resolve(filePath);

  if (!isStdin && !fs.existsSync(resolved)) {
    throw new CliError(`Frame log not found: ${resolved}`, 2);
  }

  const raw = (isStdin ? readStdin() : fs.readFileSync(resolved, 'utf-8')).trim();
  if (!raw) throw new CliError(`Frame log is empty: ${resolved}`, 2);

  if (raw.startsWith('[')) {
    try {
      const frames = JSON.parse(raw);
      if (!Array.isArray(frames)) throw new Error('Expected JSON array');
      return { frames, format: 'json', inputPath: resolved };
    } catch (err) {
      throw new CliError(`Invalid JSON array: ${(err as Error).message}`, 2);
    }
  }

  try {
    const frames = raw
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
    return { frames, format: 'jsonl', inputPath: resolved };
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

function extractTraceVersion(frame: Record<string, unknown>): string | undefined {
  const version = (frame.v ?? frame.version) as string | number | undefined;
  if (typeof version === 'number') return version.toFixed(1);
  if (typeof version === 'string') return version;
  return undefined;
}

function validateTraceFrames(frames: LtpFrame[]): { warnings: string[]; violations: string[] } {
  const warnings: string[] = [];
  const violations: string[] = [];
  const versions = new Set<string>();

  frames.forEach((frame, idx) => {
    const label = `frame#${idx}`;
    if (!frame || typeof frame !== 'object' || Array.isArray(frame)) {
      violations.push(`${label} is not an object`);
      return;
    }

    const traceVersion = extractTraceVersion(frame as Record<string, unknown>);
    if (!traceVersion) {
      violations.push(`${label} missing trace version (v|version)`);
    } else {
      versions.add(traceVersion);
      if (!SUPPORTED_TRACE_VERSIONS.includes(traceVersion as (typeof SUPPORTED_TRACE_VERSIONS)[number])) {
        violations.push(`${label} uses unsupported trace version ${traceVersion}`);
      }
    }

    if (typeof frame.type !== 'string' || frame.type.trim().length === 0) {
      violations.push(`${label} missing required type`);
    }

    if (
      'payload' in frame &&
      frame.payload !== undefined &&
      (typeof frame.payload !== 'object' || frame.payload === null || Array.isArray(frame.payload))
    ) {
      violations.push(`${label} payload must be an object when provided`);
    }

    const identity = (frame as any).identity ?? (frame as any).payload?.identity;
    if (identity !== undefined && (typeof identity !== 'object' || identity === null || Array.isArray(identity))) {
      violations.push(`${label} identity must be an object if provided`);
    }

    const constraints = (frame as any).constraints ?? (frame as any).payload?.constraints;
    if (constraints !== undefined && (typeof constraints !== 'object' || constraints === null || Array.isArray(constraints))) {
      violations.push(`${label} constraints must be an object if provided`);
    }

    const focusMomentum =
      (frame as any).payload?.focus_momentum ?? (frame as any).payload?.focusMomentum ?? (frame as any).payload?.focus;
    if (focusMomentum !== undefined && typeof focusMomentum !== 'number') {
      violations.push(`${label} focus_momentum must be numeric when provided`);
    }

    const drift =
      (frame as any).payload?.drift ??
      (frame as any).payload?.drift_level ??
      (frame as any).payload?.driftLevel;
    if (drift !== undefined && typeof drift !== 'number' && typeof drift !== 'string') {
      violations.push(`${label} drift must be numeric or string when provided`);
    }
  });

  if (versions.size > 1) {
    violations.push(`mixed trace versions detected: ${Array.from(versions).join(', ')}`);
  }

  return { warnings, violations };
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
  const seenIds = new Set<string>();
  const originalOrder: string[] = [];

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

    if (seenIds.has(id)) {
      violations.push(`duplicate branch id ${id}`);
      continue;
    }
    seenIds.add(id);
    originalOrder.push(id);

    if (confidence === undefined) {
      notes.push(`branch ${id} missing confidence (tooling MAY normalize)`);
    } else if (confidence < 0 || confidence > 1) {
      notes.push(`branch ${id} confidence out of range [0,1]`);
      violations.push(`branch ${id} confidence outside 0..1`);
    }

    normalized.push(branch);
  }

  const sorted = [...normalized].sort((a, b) => {
    const scoreA = a.confidence ?? -Infinity;
    const scoreB = b.confidence ?? -Infinity;
    if (scoreA === scoreB) return a.id.localeCompare(b.id);
    return scoreB - scoreA;
  });

  const reordered =
    sorted.length === originalOrder.length &&
    sorted.some((branch, idx) => branch.id !== originalOrder[idx]);
  if (reordered) {
    notes.push('branches reordered to deterministic confidence order');
    violations.push('branches not pre-sorted by confidence');
  }

  return { branches: sorted, notes, violations };
}

function summarize(
  frames: LtpFrame[],
  inputPath: string,
  format: InspectSummary['input']['format'],
): { summary: InspectSummary; violations: string[]; warnings: string[] } {
  const validation = validateTraceFrames(frames);
  const continuity = detectContinuity(frames);
  const driftLevel = driftLevelFromSnapshots(frames);
  const orientationStable = frames.some((f) => f.type === 'orientation');

  const lastRouteResponse = [...frames].reverse().find((f) => f.type === 'route_response');
  const { branches, notes: branchNotes, violations } = normalizeBranches(
    lastRouteResponse?.payload?.branches ?? lastRouteResponse?.payload?.routes ?? lastRouteResponse?.payload,
  );

  const warnings = [
    ...validation.warnings,
    ...(Array.isArray(lastRouteResponse?.payload?.notes) ? lastRouteResponse?.payload?.notes : []),
    ...branchNotes,
    ...continuity.notes,
  ];
  if (!orientationStable) warnings.push('no orientation frame observed');
  if (!lastRouteResponse) warnings.push('no route_response frame observed');

  const notes = [...warnings];

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
        path: inputPath === 'stdin' ? 'stdin' : path.resolve(inputPath),
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
    violations: [...validation.violations, ...violations],
    warnings,
  };
}

export function formatJson(summary: InspectSummary, pretty = false): string {
  return JSON.stringify(summary, null, pretty ? 2 : 0);
}

export function formatHuman(summary: InspectSummary): string {
  const lines: string[] = [];
  lines.push(`LTP INSPECTOR  v${summary.contract.version}`);
  lines.push(`input: ${summary.input.path}  time: ${summary.generated_at}`);
  lines.push('');
  lines.push('ORIENTATION');
  lines.push(`identity: ${summary.orientation.stable ? 'stable' : 'unknown'}`);
  lines.push(`drift: ${summary.orientation.drift_level}`);
  lines.push(`continuity: ${summary.continuity.preserved ? 'preserved' : 'rotated'}`);
  lines.push('');
  lines.push('CONSTRAINTS');
  if (!summary.continuity.preserved) {
    lines.push('continuity: WARN');
    summary.continuity.notes.forEach((note) => lines.push(`  note: ${note}`));
  } else {
    lines.push('continuity: OK');
  }
  lines.push('');
  lines.push('FUTURE BRANCHES (non-decisional)');
  if (!summary.branches.length) {
    lines.push('none observed');
  } else {
    const headers = ['ID', 'score', 'cost', 'risk', 'explainable', 'status'];
    const rows = summary.branches.map((branch) => [
      branch.id,
      branch.confidence !== undefined ? branch.confidence.toFixed(2) : 'NA',
      branch.class ?? '-',
      branch.path ?? '-',
      branch.confidence !== undefined ? 'yes' : 'no',
      branch.status ?? '-',
    ]);
    const widths = headers.map((header, idx) => Math.max(header.length, ...rows.map((row) => String(row[idx]).length)));
    const formatRow = (row: string[]) =>
      row
        .map((cell, idx) => String(cell).padEnd(widths[idx], ' '))
        .join('  ')
        .trimEnd();
    lines.push(formatRow(headers));
    rows.forEach((row) => lines.push(formatRow(row as string[])));
  }
  if (summary.notes.length) {
    lines.push('');
    lines.push('NOTES / WARNINGS');
    for (const note of summary.notes) lines.push(`- ${note}`);
  }
  return lines.join('\n');
}

export function runInspect(file: string): InspectSummary {
  const { frames, format, inputPath } = loadFrames(file);
  return summarize(frames, inputPath, format).summary;
}

type InspectionResult = {
  summary: InspectSummary;
  warnings: string[];
  violations: string[];
};

function handleTrace(file: string, format: OutputFormat, pretty: boolean, writer: Writer): InspectionResult {
  const { frames, format: inputFormat, inputPath } = loadFrames(file);
  const { summary, violations, warnings } = summarize(frames, inputPath, inputFormat);

  if (format === 'json') printJson(summary, pretty, writer);
  else printHuman(summary, writer);

  return { summary, violations, warnings };
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

function handleExplain(file: string, branchId: string | undefined, writer: Writer): { violations: string[] } {
  const { frames, format, inputPath } = loadFrames(file);
  const { summary, violations } = summarize(frames, inputPath, format);
  const target = branchId ?? summary.branches[0]?.id;

  if (!target) {
    writer('No branches present to explain.');
    return { violations };
  }

  const branch = summary.branches.find((b) => b.id === target);
  if (!branch) {
    writer(`Branch ${target} not found.`);
    return { violations };
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

  return { violations };
}

function printHelp(writer: Writer): void {
  writer('ltp:inspect — orientation inspector (no decisions made).');
  writer('');
  writer('Usage:');
  writer('  pnpm -w ltp:inspect -- [trace] --input <frames.jsonl> [--format json|human] [--pretty] [--color auto|always|never] [--quiet] [--verbose] [--output <file>]');
  writer('  pnpm -w ltp:inspect -- replay --input <frames.jsonl> [--from <frameId>]');
  writer('  pnpm -w ltp:inspect -- explain --input <frames.jsonl> [--branch <id>]');
  writer('');
  writer('Examples:');
  writer('  pnpm -w ltp:inspect -- --input fixtures/ltp/demo.frames.jsonl --format=human');
  writer('  pnpm -w ltp:inspect -- --input fixtures/ltp/demo.frames.jsonl --format=json');
  writer('  pnpm -w ltp:inspect -- --format=json --quiet --input fixtures/ltp/demo.frames.jsonl | jq .orientation');
  writer('');
  writer('Output:');
  writer('  JSON (v1 contract) with deterministic ordering for CI.');
  writer('  Human format (kubectl describe style) with Orientation, Constraints, Branches, and warnings.');
  writer('');
  writer('Exit codes:');
  writer('  0 OK — contract produced');
  writer('  2 invalid input or contract violation');
  writer('  3 WARN — degraded orientation or continuity');
  writer('  4 runtime failure — unexpected error');
}

function printJson(summary: InspectSummary, pretty = false, writer: Writer): void {
  writer(formatJson(summary, pretty));
}

function printHuman(summary: InspectSummary, writer: Writer): void {
  writer(formatHuman(summary));
}

export function execute(argv: string[], logger: Pick<Console, 'log' | 'error'> = console): number {
  const buffer: string[] = [];
  const writer = (message: string) => buffer.push(message);
  const errorWriter = (message: string) => logger.error(message);
  const args = parseArgs(argv);

  try {
    if (!args.input && args.command !== 'help') {
      printHelp(writer);
      throw new CliError('Missing --input <frames.jsonl>', 2);
    }

    const colorEnabled =
      args.color === 'always' || (args.color === 'auto' && Boolean(process.stdout.isTTY) && args.format === 'human');
    const applyColor = (code: string, text: string) => (colorEnabled ? `${code}${text}\u001b[0m` : text);
    const green = (text: string) => applyColor('\u001b[32m', text);
    const yellow = (text: string) => applyColor('\u001b[33m', text);
    const red = (text: string) => applyColor('\u001b[31m', text);

    switch (args.command) {
      case 'trace':
        {
          const { violations, warnings } = handleTrace(args.input as string, args.format, args.pretty, writer);
          const status = violations.length ? 'error' : warnings.length ? 'warn' : 'ok';
          const exitCode = status === 'error' ? 2 : status === 'warn' ? 3 : 0;
          const statusText =
            status === 'ok' ? green('OK') : status === 'warn' ? yellow('WARN (degraded)') : red('FAIL (contract)');
          if (violations.length) {
            errorWriter(`ERROR: Contract violation: ${violations.join('; ')}`);
            errorWriter('hint: re-run with --format=json and --pretty for contract view');
          }
          if (args.format === 'human') {
            writer('');
            writer(`RESULT: ${statusText}  exit: ${exitCode}`);
          }

          if (args.output) fs.writeFileSync(args.output, buffer.join('\n'), 'utf-8');
          if (!args.quiet) {
            buffer.forEach((line) => logger.log(line));
          } else {
            logger.log(`RESULT: ${statusText}  exit: ${exitCode}`);
          }
          return exitCode;
        }
      case 'replay':
        handleReplay(args.input as string, args.from, writer);
        if (args.output) fs.writeFileSync(args.output, buffer.join('\n'), 'utf-8');
        if (!args.quiet) buffer.forEach((line) => logger.log(line));
        break;
      case 'explain':
        {
          const { violations } = handleExplain(args.input as string, args.branch, writer);
          if (violations.length) {
            throw new CliError(`Contract violation: ${violations.join('; ')}`, 2);
          }
          if (args.output) fs.writeFileSync(args.output, buffer.join('\n'), 'utf-8');
          if (!args.quiet) buffer.forEach((line) => logger.log(line));
        }
        break;
      default:
        printHelp(writer);
        if (!args.quiet) buffer.forEach((line) => logger.log(line));
    }
    return 0;
  } catch (err) {
    if (err instanceof CliError) {
      const hint =
        err.exitCode === 2
          ? 'hint: pass a JSON file or pipe JSON/JSONL via stdin (use - for stdin)'
          : 'hint: re-run with --format=json to inspect the contract payload';
      const example = 'example: pnpm -w ltp:inspect --format=json --input fixtures/minimal.frames.jsonl';
      errorWriter(`ERROR: ${err.message}`);
      errorWriter(hint);
      errorWriter(example);
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
