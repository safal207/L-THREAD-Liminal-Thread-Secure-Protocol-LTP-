import fs from 'node:fs';
import path from 'node:path';
import { BranchInsight, DriftSnapshot, InspectSummary, LtpFrame } from './types';

const CONTRACT = {
  name: 'ltp-inspect',
  version: '1.0',
  schema: 'docs/contracts/ltp-inspect.v1.schema.json',
} as const;

const TOOL = {
  name: 'ltp:inspect',
  build: process.env.LTP_BUILD ?? 'dev',
} as const;

type OutputFormat = 'json' | 'human';
type ColorMode = 'auto' | 'always' | 'never';
type Writer = (message: string) => void;

type Command = 'trace' | 'replay' | 'explain' | 'help';

type ParsedArgs = {
  command: Command;
  input?: string;
  format: OutputFormat;
  pretty: boolean;
  from?: string;
  branch?: string;
  at?: string;
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
  const commands: Command[] = ['trace', 'replay', 'explain', 'help'];
  const positionalCommand = commands.includes(argv[0] as Command) ? (argv.shift() as Command) : 'trace';

  const options: ParsedArgs = {
    command: positionalCommand,
    input: undefined,
    format: 'human',
    pretty: false,
    from: undefined,
    branch: undefined,
    at: undefined,
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
    } else if (token === '--at') {
      options.at = argv[++i];
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

function collectDriftHistory(frames: LtpFrame[]): DriftSnapshot[] {
  const driftFrames = frames.filter((f) => f.type === 'focus_snapshot');
  const history: DriftSnapshot[] = [];

  for (const frame of driftFrames) {
    const payload = frame.payload ?? {};
    const rawDrift =
      payload.drift ?? payload.drift_level ?? payload.driftLevel ?? payload.drift_score ?? payload.signal;
    if (rawDrift === undefined || (typeof rawDrift !== 'number' && typeof rawDrift !== 'string')) continue;
    const note = payload.rationale ?? payload.reason ?? payload.note ?? payload.notes?.[0];
    history.push({ id: frame.id, ts: frame.ts, value: rawDrift, note });
  }

  return history.filter((entry, idx, arr) => idx === 0 || arr[idx - 1].value !== entry.value);
}

function driftLevelFromHistory(history: DriftSnapshot[]): InspectSummary['orientation']['drift_level'] {
  if (!history.length) return 'unknown';
  const last = history[history.length - 1].value;
  if (typeof last === 'string') {
    const normalized = last.toLowerCase();
    if (['low', 'medium', 'high'].includes(normalized)) return normalized as InspectSummary['orientation']['drift_level'];
    return 'unknown';
  }

  if (last <= 0.33) return 'low';
  if (last <= 0.66) return 'medium';
  return 'high';
}

function detectContinuity(frames: LtpFrame[]): { preserved: boolean; notes: string[]; token?: string } {
  const tokens = frames
    .map((f) => f.continuity_token)
    .filter((token): token is string => typeof token === 'string' && token.length > 0);

  const token = tokens.length ? tokens[tokens.length - 1] : undefined;
  const unique = new Set(tokens);
  if (unique.size <= 1) return { preserved: true, notes: [], token };

  return {
    preserved: false,
    token,
    notes: ['continuity token rotation detected mid-session'],
  };
}

function extractIdentity(frames: LtpFrame[]): string {
  const orientationFrame = frames.find((f) => f.type === 'orientation');
  const payload = orientationFrame?.payload ?? {};
  const candidates = [
    payload.identity,
    payload.thread_id,
    payload.thread,
    payload.origin,
    payload.client_id,
    payload.clientId,
    payload.session_id,
    payload.sessionId,
    orientationFrame?.continuity_token,
    frames[0]?.continuity_token,
    orientationFrame?.id,
  ];

  for (const candidate of candidates) {
    if (candidate) return String(candidate);
  }

  return 'unknown';
}

function extractFocusMomentum(frames: LtpFrame[]): number | undefined {
  const payloads = frames.map((f) => f.payload ?? {});
  const candidates = payloads
    .map((p) => p.focus_momentum ?? p.focusMomentum ?? p.focus?.momentum ?? p.debug?.focus_momentum)
    .filter((value) => typeof value === 'number');

  if (!candidates.length) return undefined;
  return candidates[candidates.length - 1];
}

function constraintListFrom(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String).filter((v) => v.length > 0);
  if (typeof value === 'string') return [value];
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([name, reason]) => (reason ? `${name}: ${String(reason)}` : name))
      .filter((v) => v.length > 0);
  }
  return [];
}

function collectConstraints(frames: LtpFrame[]): string[] {
  const constraintHints = frames.flatMap((frame) => {
    const payload = frame.payload ?? {};
    return [payload.constraints, payload.guardrails, payload.limits, payload.non_goals]
      .flatMap((value) => constraintListFrom(value))
      .map((text) => ({ text, ts: frame.ts ?? 0 }));
  });

  const seen = new Set<string>();
  return constraintHints
    .sort((a, b) => (a.ts as number) - (b.ts as number))
    .map((entry) => entry.text)
    .filter((text) => {
      if (seen.has(text)) return false;
      seen.add(text);
      return true;
    });
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
  let lastConfidence: number | undefined;
  let sawUnsorted = false;

  for (const entry of branchesArray as Array<Record<string, any>>) {
    const id = (entry.id ?? entry.name ?? 'unnamed') as string;
    const confidence = typeof entry.confidence === 'number' ? entry.confidence : undefined;
    const status = (entry.status as string | undefined) ?? (entry.class === 'primary' ? 'admissible' : 'degraded');
    const reason =
      (entry.rationale as string | undefined) ??
      (entry.reason as string | undefined) ??
      (entry.why as string | undefined) ??
      (entry.note as string | undefined) ??
      (entry.explainer as string | undefined);
    const constraints = constraintListFrom(entry.constraints ?? entry.guardrails ?? entry.limits);

    const branch: BranchInsight = {
      id,
      confidence,
      status,
      path: (entry.path as string | undefined) ?? (entry.route as string | undefined),
      class: entry.class as string | undefined,
      reason,
      constraints: constraints.length ? constraints : undefined,
    };

    if (confidence === undefined) {
      notes.push(`branch ${id} missing confidence (tooling MAY normalize)`);
    } else if (confidence < 0 || confidence > 1) {
      notes.push(`branch ${id} confidence out of range [0,1]`);
      violations.push(`branch ${id} confidence outside 0..1`);
    }

    if (confidence !== undefined) {
      if (lastConfidence !== undefined && confidence > lastConfidence) {
        sawUnsorted = true;
      }
      lastConfidence = confidence;
    }

    normalized.push(branch);
  }

  const sorted = normalized.sort((a, b) => {
    const scoreA = a.confidence ?? -Infinity;
    const scoreB = b.confidence ?? -Infinity;
    if (scoreA === scoreB) return a.id.localeCompare(b.id);
    return scoreB - scoreA;
  });

  if (sawUnsorted) {
    notes.push('branches reordered for determinism');
  }

  return { branches: sorted, notes, violations };
}

function groupFutures(branches: BranchInsight[]): InspectSummary['futures'] {
  const admissible: BranchInsight[] = [];
  const degraded: BranchInsight[] = [];
  const blocked: BranchInsight[] = [];

  for (const branch of branches) {
    const status = (branch.status ?? '').toLowerCase();
    if (status.includes('blocked') || status.includes('rejected') || status.includes('inadmissible')) {
      blocked.push(branch);
    } else if (status.includes('degraded') || status.includes('fallback')) {
      degraded.push(branch);
    } else {
      admissible.push(branch);
    }
  }

  return { admissible, degraded, blocked };
}

function summarize(
  frames: LtpFrame[],
  inputPath: string,
  format: InspectSummary['input']['format'],
): { summary: InspectSummary; violations: string[]; warnings: string[] } {
  const continuity = detectContinuity(frames);
  const driftHistory = collectDriftHistory(frames);
  const driftLevel = driftLevelFromHistory(driftHistory);
  const focusMomentum = extractFocusMomentum(frames);
  const identity = extractIdentity(frames);
  const orientationStable = frames.some((f) => f.type === 'orientation');

  const lastRouteResponse = [...frames].reverse().find((f) => f.type === 'route_response');
  const { branches, notes: branchNotes, violations } = normalizeBranches(
    lastRouteResponse?.payload?.branches ?? lastRouteResponse?.payload?.routes ?? lastRouteResponse?.payload,
  );

  const warnings = [
    ...(Array.isArray(lastRouteResponse?.payload?.notes) ? lastRouteResponse?.payload?.notes : []),
    ...branchNotes,
    ...continuity.notes,
  ];

  if (!orientationStable) warnings.push('no orientation frame observed');
  if (!driftHistory.length) warnings.push('no drift snapshots observed (focus_snapshot missing)');
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
        identity,
        stable: orientationStable,
        drift_level: driftLevel,
        drift_history: driftHistory,
        ...(focusMomentum !== undefined ? { focus_momentum: focusMomentum } : {}),
      },
      continuity: {
        preserved: continuity.preserved,
        notes: continuity.notes,
        ...(continuity.token ? { token: continuity.token } : {}),
      },
      branches,
      futures: groupFutures(branches),
      notes,
    },
    violations,
    warnings,
  };
}

export function formatJson(summary: InspectSummary, pretty = false): string {
  return JSON.stringify(summary, null, pretty ? 2 : 0);
}

function formatDriftHistory(history: DriftSnapshot[]): string {
  if (!history.length) return '(none)';
  return history
    .map((entry) => {
      const value = typeof entry.value === 'number' ? entry.value.toFixed(2) : String(entry.value);
      const step = entry.id ?? entry.ts ?? 'frame';
      const note = entry.note ? ` (${entry.note})` : '';
      return `${step}:${value}${note}`;
    })
    .join(' -> ');
}

export function formatHuman(summary: InspectSummary): string {
  const lines: string[] = [];
  lines.push(`LTP INSPECTOR  v${summary.contract.version}`);
  lines.push(`input: ${summary.input.path}  time: ${summary.generated_at}`);
  lines.push('');
  lines.push('IDENTITY');
  lines.push(`identity: ${summary.orientation.identity}`);
  lines.push(`continuity: ${summary.continuity.preserved ? 'preserved' : 'rotated'}${summary.continuity.token ? ` (${summary.continuity.token})` : ''}`);
  lines.push('');
  lines.push('ORIENTATION');
  lines.push(`stable: ${summary.orientation.stable ? 'yes' : 'unknown'}`);
  lines.push(`focus_momentum: ${summary.orientation.focus_momentum ?? 'unknown'}`);
  lines.push(`drift: ${summary.orientation.drift_level}`);
  lines.push(`drift_history: ${formatDriftHistory(summary.orientation.drift_history)}`);
  lines.push('');
  lines.push('FUTURES (admissible / degraded / blocked)');
  const formatBranch = (branch: BranchInsight) => {
    const score = branch.confidence !== undefined ? branch.confidence.toFixed(2) : 'NA';
    const pieces = [`${branch.id}`, `score=${score}`, `status=${branch.status}`];
    if (branch.reason) pieces.push(`reason=${branch.reason}`);
    if (branch.path) pieces.push(`path=${branch.path}`);
    if (branch.constraints?.length) pieces.push(`constraints=${branch.constraints.join('|')}`);
    return `- ${pieces.join(' ')}`;
  };

  if (
    !summary.futures.admissible.length &&
    !summary.futures.degraded.length &&
    !summary.futures.blocked.length
  ) {
    lines.push('none observed');
  } else {
    if (summary.futures.admissible.length) {
      lines.push('admissible:');
      summary.futures.admissible.forEach((branch) => lines.push(formatBranch(branch)));
    }
    if (summary.futures.degraded.length) {
      lines.push('degraded:');
      summary.futures.degraded.forEach((branch) => lines.push(formatBranch(branch)));
    }
    if (summary.futures.blocked.length) {
      lines.push('blocked:');
      summary.futures.blocked.forEach((branch) => lines.push(formatBranch(branch)));
    }
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
    const drift = frame.type === 'focus_snapshot' && frame.payload?.drift !== undefined ? ` drift=${frame.payload.drift}` : '';
    writer(`- ${label}${continuity}${drift}`);
  }
}

function handleExplain(file: string, at: string | undefined, branchId: string | undefined, writer: Writer): { violations: string[] } {
  const { frames, format, inputPath } = loadFrames(file);
  const targetIndex = at
    ? frames.findIndex((f) => f.id === at || String(f.ts) === at || `step-${f.id}` === at)
    : frames.length - 1;
  const boundedIndex = targetIndex >= 0 ? targetIndex : frames.length - 1;
  const window = frames.slice(0, boundedIndex + 1);
  const prior = frames.slice(0, boundedIndex);
  const { summary, violations } = summarize(window, inputPath, format);
  const previous = prior.length ? summarize(prior, inputPath, format).summary : undefined;

  const targetBranch = branchId ?? summary.branches[0]?.id;
  const branch = targetBranch ? summary.branches.find((b) => b.id === targetBranch) : undefined;

  writer(`Explain @ ${at ?? 'last'} (${window[window.length - 1]?.type ?? 'unknown'})`);
  writer(`identity: ${summary.orientation.identity}`);
  writer(`continuity: ${summary.continuity.preserved ? 'preserved' : 'rotated'}${summary.continuity.token ? ` (${summary.continuity.token})` : ''}`);
  writer('constraints active:');
  const constraints = collectConstraints(window);
  if (constraints.length) constraints.forEach((c) => writer(`- ${c}`));
  else writer('- none observed');

  writer('futures:');
  if (branch) {
    writer(`- branch ${branch.id}: status=${branch.status} score=${branch.confidence ?? 'NA'} reason=${branch.reason ?? 'n/a'}`);
    if (branch.constraints?.length) writer(`  constraints: ${branch.constraints.join(' | ')}`);
  } else {
    writer('- none observed');
  }

  writer('changes since previous step:');
  if (!previous) {
    writer('- initial frame (no prior context)');
  } else {
    const previousDrift = previous.orientation.drift_history.at(-1)?.value;
    const currentDrift = summary.orientation.drift_history.at(-1)?.value;
    if (previousDrift !== currentDrift) {
      writer(`- drift ${previousDrift ?? 'n/a'} -> ${currentDrift ?? 'n/a'}`);
    } else {
      writer(`- drift steady at ${currentDrift ?? 'n/a'}`);
    }

    if (previous.orientation.focus_momentum !== summary.orientation.focus_momentum) {
      writer(
        `- focus_momentum ${previous.orientation.focus_momentum ?? 'n/a'} -> ${summary.orientation.focus_momentum ?? 'n/a'}`,
      );
    }

    if (previous.continuity.preserved !== summary.continuity.preserved) {
      writer(`- continuity updated: ${previous.continuity.preserved ? 'preserved' : 'rotated'} -> ${summary.continuity.preserved ? 'preserved' : 'rotated'}`);
    }
  }

  return { violations };
}

function printHelp(writer: Writer): void {
  writer('ltp:inspect — orientation inspector (no decisions, no model execution).');
  writer('');
  writer('Usage:');
  writer('  pnpm -w ltp:inspect -- [trace] --input <frames.jsonl> [--format json|human] [--pretty] [--color auto|always|never] [--quiet] [--verbose] [--output <file>]');
  writer('  pnpm -w ltp:inspect -- replay --input <frames.jsonl> [--from <frameId>]');
  writer('  pnpm -w ltp:inspect -- explain --input <frames.jsonl> [--at <frameId|ts>] [--branch <id>]');
  writer('');
  writer('Examples:');
  writer('  pnpm -w ltp:inspect -- --input tools/ltp-inspect/fixtures/minimal.frames.jsonl --format=human');
  writer('  pnpm -w ltp:inspect -- --input tools/ltp-inspect/fixtures/minimal.frames.jsonl --format=json');
  writer('  pnpm -w ltp:inspect -- --format=json --quiet --input examples/traces/drift-recovery.json | jq .orientation');
  writer('  pnpm -w ltp:inspect -- explain --input examples/traces/drift-recovery.json --at step-3');
  writer('');
  writer('Output:');
  writer('  JSON (v1 contract) with deterministic ordering for CI. Additional fields remain optional.');
  writer('  Human format shows identity, focus momentum, drift history, continuity, and future branches with rationale.');
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
          const { violations } = handleExplain(args.input as string, args.at, args.branch, writer);
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
      const example = 'example: pnpm -w ltp:inspect --format=json --input tools/ltp-inspect/fixtures/minimal.frames.jsonl';
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
