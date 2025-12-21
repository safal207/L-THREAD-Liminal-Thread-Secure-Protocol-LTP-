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

const SUPPORTED_TRACE_VERSIONS = ['0.1'] as const;

type OutputFormat = 'json' | 'human';
type ColorMode = 'auto' | 'always' | 'never';
type Writer = (message: string) => void;

type Command = 'trace' | 'replay' | 'explain' | 'help';

type ParsedArgs = {
  command: Command;
  input?: string;
  strict: boolean;
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
    strict: false,
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
    } else if (token.startsWith('--input=')) {
      options.input = token.split('=').slice(1).join('=');
    } else if (token === '--input' || token === '-i') {
      options.input = argv[++i];
    } else if (token.startsWith('--format=')) {
      const format = token.split('=').slice(1).join('=') as OutputFormat;
      options.format = format === 'human' || format === 'json' ? format : 'human';
    } else if (token === '--format') {
      const format = argv[++i] as OutputFormat;
      options.format = format === 'human' || format === 'json' ? format : 'human';
    } else if (token === '--json') {
      options.format = 'json';
    } else if (token === '--text' || token === '--human') {
      options.format = 'human';
    } else if (token === '--pretty') {
      options.pretty = true;
    } else if (token.startsWith('--from=')) {
      options.from = token.split('=').slice(1).join('=');
    } else if (token === '--from') {
      options.from = argv[++i];
    } else if (token.startsWith('--branch=')) {
      options.branch = token.split('=').slice(1).join('=');
    } else if (token === '--branch') {
      options.branch = argv[++i];
    } else if (token === '--strict') {
      options.strict = true;
    } else if (token.startsWith('--at=')) {
      options.at = token.split('=').slice(1).join('=');
    } else if (token === '--at') {
      options.at = argv[++i];
    } else if (token.startsWith('--color=')) {
      const mode = token.split('=').slice(1).join('=') as ColorMode;
      options.color = ['auto', 'always', 'never'].includes(mode) ? mode : 'auto';
    } else if (token === '--color') {
      const mode = argv[++i] as ColorMode;
      options.color = ['auto', 'always', 'never'].includes(mode) ? mode : 'auto';
    } else if (token === '--quiet' || token === '-q') {
      options.quiet = true;
    } else if (token === '--verbose' || token === '-v') {
      options.verbose = true;
    } else if (token.startsWith('--output=')) {
      options.output = token.split('=').slice(1).join('=');
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

function stableGeneratedAt(): string {
  const frozen = process.env.LTP_INSPECT_FROZEN_TIME;
  if (frozen) {
    const parsed = new Date(frozen);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date().toISOString();
}

function normalizeInputPathForOutput(resolved: string): string {
  const relative = path.relative(process.cwd(), resolved);
  const candidate = relative && !relative.startsWith('..') ? relative : resolved;
  return candidate.split(path.sep).join('/');
}

function normalizeConstraintsValue(
  raw: unknown,
): { value?: Record<string, unknown>; normalized: boolean; invalid: boolean } {
  if (raw === undefined) return { normalized: false, invalid: false };
  if (raw === null) return { normalized: false, invalid: true };
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return { value: raw as Record<string, unknown>, normalized: false, invalid: false };
  }
  if (typeof raw === 'string') return { value: { [raw]: undefined }, normalized: true, invalid: false };
  if (Array.isArray(raw)) {
    const mapped: Record<string, unknown> = {};
    (raw as unknown[]).forEach((entry, idx) => {
      const key = typeof entry === 'string' ? entry : `item_${idx}`;
      mapped[key] = entry ?? undefined;
    });
    return { value: mapped, normalized: true, invalid: false };
  }
  return { normalized: false, invalid: true };
}

function normalizeFrameConstraints(frames: LtpFrame[]): {
  frames: LtpFrame[];
  normalizations: string[];
  violations: string[];
} {
  const normalizations: string[] = [];
  const violations: string[] = [];
  const normalizedFrames = frames.map((frame, idx) => {
    const label = `frame#${idx}`;
    const next: LtpFrame = { ...frame };
    const payloadObject =
      frame.payload && typeof frame.payload === 'object' && !Array.isArray(frame.payload)
        ? { ...(frame.payload as Record<string, unknown>) }
        : undefined;

    const directConstraints = normalizeConstraintsValue((frame as any).constraints);
    if (directConstraints.invalid) {
      violations.push(`${label} constraints must be an object when provided`);
    } else if (directConstraints.value) {
      next.constraints = directConstraints.value;
      if (directConstraints.normalized) normalizations.push(`${label} constraints normalized to object map`);
    }

    const payloadConstraints = normalizeConstraintsValue((frame as any).payload?.constraints);
    if (payloadConstraints.invalid) {
      violations.push(`${label} constraints must be an object when provided`);
    } else if (payloadConstraints.value) {
      const updatedPayload = payloadObject ?? {};
      updatedPayload.constraints = payloadConstraints.value;
      next.payload = updatedPayload;
      if (payloadConstraints.normalized) normalizations.push(`${label} payload constraints normalized to object map`);
    } else if (payloadObject) {
      next.payload = payloadObject;
    }

    return next;
  });

  return { frames: normalizedFrames, normalizations, violations };
}

function loadFrames(
  filePath: string,
): { frames: LtpFrame[]; format: InspectSummary['input']['format']; inputPath?: string; inputSource: InspectSummary['input']['source'] } {
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
      return {
        frames,
        format: 'json',
        inputSource: isStdin ? 'stdin' : 'file',
        inputPath: isStdin ? undefined : normalizeInputPathForOutput(resolved),
      };
    } catch (err) {
      throw new CliError(`Invalid JSON array: ${(err as Error).message}`, 2);
    }
  }

  try {
    const frames = raw
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line));
    return {
      frames,
      format: 'jsonl',
      inputSource: isStdin ? 'stdin' : 'file',
      inputPath: isStdin ? undefined : normalizeInputPathForOutput(resolved),
    };
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
      violations.push(`${label} constraints must be an object when provided`);
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

function normalizeBranches(raw: unknown): { branches: BranchInsight[]; notes: string[]; violations: string[]; normalizations: string[] } {
  if (!raw) return { branches: [], notes: [], violations: [], normalizations: [] };

  const branchesArray = Array.isArray(raw)
    ? raw
    : typeof raw === 'object'
      ? Object.entries(raw as Record<string, any>).map(([id, value]) => ({ id, ...(value as Record<string, unknown>) }))
      : [];

  const normalized: BranchInsight[] = [];
  const notes: string[] = [];
  const violations: string[] = [];
  const normalizations: string[] = [];
  const seenIds = new Set<string>();
  const originalOrder: string[] = [];
  let sawUnsorted = false;
  let lastConfidence: number | undefined;

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

    if (confidence !== undefined) {
      if (lastConfidence !== undefined && confidence > lastConfidence) {
        sawUnsorted = true;
      }
      lastConfidence = confidence;
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
    const message = 'branches reordered to deterministic confidence order';
    notes.push(message);
    normalizations.push('branches not pre-sorted by confidence (normalized order applied)');
  }

  if (sawUnsorted && !reordered) {
    normalizations.push('branch confidences not in canonical order (normalization available)');
  }

  return { branches: sorted, notes, violations, normalizations };
}

function constraintListFrom(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  return Object.entries(raw as Record<string, unknown>).map(([key, value]) =>
    value === undefined || value === null ? String(key) : `${key}:${value}`,
  );
}

function extractIdentity(frames: LtpFrame[]): string {
  for (let i = frames.length - 1; i >= 0; i -= 1) {
    const frame = frames[i] as Record<string, unknown>;
    const payload = (frame.payload ?? {}) as Record<string, unknown>;
    const directIdentity = payload.identity ?? (frame as any).identity ?? payload.origin ?? payload.id;
    if (typeof directIdentity === 'string' && directIdentity.trim().length) return directIdentity;
    if (directIdentity && typeof directIdentity === 'object' && 'id' in (directIdentity as Record<string, unknown>)) {
      const embedded = (directIdentity as Record<string, unknown>).id;
      if (typeof embedded === 'string' && embedded.trim().length) return embedded;
    }
  }

  const continuity = frames.map((f) => f.continuity_token).filter((token): token is string => Boolean(token));
  return continuity.at(-1) ?? 'unknown';
}

function extractFocusMomentum(frames: LtpFrame[]): number | undefined {
  for (let i = frames.length - 1; i >= 0; i -= 1) {
    const payload = (frames[i] as any).payload ?? {};
    const value = payload.focus_momentum ?? payload.focusMomentum ?? payload.focus;
    if (typeof value === 'number') return value;
  }
  return undefined;
}

function collectConstraints(frames: LtpFrame[]): string[] {
  const collected: string[] = [];
  for (const frame of frames) {
    const rawConstraints = (frame as any).payload?.constraints ?? (frame as any).constraints;
    for (const constraint of constraintListFrom(rawConstraints)) {
      if (!collected.includes(constraint)) collected.push(constraint);
    }
  }
  return collected;
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
  input: { path?: string; source: InspectSummary['input']['source'] },
  format: InspectSummary['input']['format'],
): { summary: InspectSummary; violations: string[]; warnings: string[]; normalizations: string[] } {
  const { frames: normalizedFrames, normalizations: constraintNormalizations, violations: constraintViolations } =
    normalizeFrameConstraints(frames);
  const validation = validateTraceFrames(normalizedFrames);
  const continuity = detectContinuity(normalizedFrames);
  const driftHistory = collectDriftHistory(normalizedFrames);
  const driftLevel = driftLevelFromHistory(driftHistory);
  const focusMomentum = extractFocusMomentum(normalizedFrames);
  const identity = extractIdentity(normalizedFrames);
  const orientationStable = normalizedFrames.some((f) => f.type === 'orientation');

  const lastRouteResponse = [...normalizedFrames].reverse().find((f) => f.type === 'route_response');
  const { branches, notes: branchNotes, violations, normalizations } = normalizeBranches(
    lastRouteResponse?.payload?.branches ?? lastRouteResponse?.payload?.routes ?? lastRouteResponse?.payload,
  );

  const warnings = [
    ...validation.warnings,
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
      generated_at: stableGeneratedAt(),
      tool: {
        name: TOOL.name,
        build: TOOL.build,
      },
      input: {
        source: input.source,
        ...(input.path ? { path: input.path } : {}),
        frames: normalizedFrames.length,
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
    violations: [...constraintViolations, ...validation.violations, ...violations],
    warnings,
    normalizations: [...constraintNormalizations, ...normalizations],
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
  const inputLabel = summary.input.path ?? summary.input.source;
  lines.push(`input: ${inputLabel}  time: ${summary.generated_at}`);
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
  const { frames, format, inputPath, inputSource } = loadFrames(file);
  return summarize(frames, { path: inputPath, source: inputSource }, format).summary;
}

type InspectionResult = {
  summary: InspectSummary;
  warnings: string[];
  violations: string[];
  normalizations: string[];
};

function handleTrace(file: string, format: OutputFormat, pretty: boolean, writer: Writer): InspectionResult {
  const { frames, format: inputFormat, inputPath, inputSource } = loadFrames(file);
  const { summary, violations, warnings, normalizations } = summarize(frames, { path: inputPath, source: inputSource }, inputFormat);

  if (format === 'json') printJson(summary, pretty, writer);
  else printHuman(summary, writer);

  return { summary, violations, warnings, normalizations };
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
  const { frames, format, inputPath, inputSource } = loadFrames(file);
  const targetIndex = at
    ? frames.findIndex((f) => f.id === at || String(f.ts) === at || `step-${f.id}` === at)
    : frames.length - 1;
  const boundedIndex = targetIndex >= 0 ? targetIndex : frames.length - 1;
  const window = frames.slice(0, boundedIndex + 1);
  const prior = frames.slice(0, boundedIndex);
  const { summary, violations } = summarize(window, { path: inputPath, source: inputSource }, format);
  const previous = prior.length ? summarize(prior, { path: inputPath, source: inputSource }, format).summary : undefined;

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
  writer('  pnpm -w ltp:inspect -- [trace] --input <frames.jsonl> [--strict] [--format json|human] [--pretty] [--color auto|always|never] [--quiet] [--verbose] [--output <file>]');
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
  writer('  --strict treats canonicalization needs as contract violations (exit 2).');
  writer('');
  writer('Exit codes:');
  writer('  0 OK — contract produced');
  writer('  1 warnings only (normalized output or degraded signals)');
  writer('  2 contract violation (invalid input or non-canonical in --strict)');
  writer('  3 runtime failure — unexpected error');
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
          const { violations, warnings, normalizations } = handleTrace(args.input as string, args.format, args.pretty, writer);
          const contractBreaches = [...violations];
          const hasCanonicalGaps = normalizations.length > 0;
          const hasWarnings = warnings.length > 0 || normalizations.length > 0;

          if (args.strict && hasCanonicalGaps) {
            contractBreaches.push(
              ...normalizations.map((note) => `non-canonical input (normalization would be required): ${note}`),
            );
          }

          const status = contractBreaches.length ? 'error' : hasWarnings ? 'warn' : 'ok';
          const exitCode = contractBreaches.length ? 2 : hasWarnings ? 1 : 0;
          process.exitCode = exitCode;

          const statusText =
            status === 'ok'
              ? green('OK')
              : status === 'warn'
                ? yellow('WARN')
                : red('ERROR (contract)');
          if (contractBreaches.length) {
            errorWriter(`ERROR: Contract violation: ${contractBreaches.join('; ')}`);
            errorWriter('hint: re-run with --format=json and --pretty for contract view');
          } else if (hasCanonicalGaps) {
            errorWriter(`WARN: normalized output (non-canonical input): ${normalizations.join('; ')}`);
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
      process.exitCode = err.exitCode;
      return err.exitCode;
    }
    errorWriter(`Runtime failure: ${(err as Error).message}`);
    process.exitCode = 3;
    return 3;
  }
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const exitCode = execute(argv, console);
  process.exit(exitCode);
}

function isDirectRun(): boolean {
  if (typeof require !== 'undefined' && typeof module !== 'undefined') {
    if (require.main === module) return true;
  }

  if (typeof import.meta !== 'undefined') {
    return import.meta.url === `file://${process.argv[1]}`;
  }

  return false;
}

if (isDirectRun()) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
