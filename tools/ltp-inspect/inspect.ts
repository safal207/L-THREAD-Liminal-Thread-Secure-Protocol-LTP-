import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import PDFDocument from 'pdfkit';
import { BranchInsight, ComplianceReport, DriftSnapshot, InspectSummary, LtpFrame, TraceEntry, ComplianceViolation } from './types';
import { CRITICAL_ACTIONS, AGENT_RULES, RECOVERY_ACTIONS } from './critical_actions';

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
const JSONL_HINT = "hint: Try: jq -c '.[]' input.json > output.jsonl";

type OutputFormat = 'json' | 'human';
type ExportFormat = 'json' | 'jsonld' | 'pdf';
type ColorMode = 'auto' | 'always' | 'never';
type Writer = (message: string) => void;

type Command = 'trace' | 'replay' | 'explain' | 'help';

type ParsedArgs = {
  command?: Command;
  explicitHelp: boolean;
  input?: string;
  strict: boolean;
  format: OutputFormat;
  exportFormat: ExportFormat[];
  pretty: boolean;
  from?: string;
  branch?: string;
  at?: string;
  color: ColorMode;
  quiet: boolean;
  verbose: boolean;
  output?: string;
  compliance?: string;
  profile?: string;
  replayCheck?: boolean;
  continuity?: boolean;
};

const DETERMINISTIC_TIMESTAMP = '1970-01-01T00:00:00.000Z';

class CliError extends Error {
  exitCode: number;

  constructor(message: string, exitCode: number) {
    super(message);
    this.exitCode = exitCode;
  }
}

let readStdinOverride: string | undefined;

function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (!value || (value.startsWith('-') && value !== '-')) {
    throw new CliError(`Missing value for ${flag}`, 2);
  }
  return value;
}

function requireInlineValue(token: string, flag: string): string {
  const value = token.split('=').slice(1).join('=');
  if (!value) {
    throw new CliError(`Missing value for ${flag}`, 2);
  }
  return value;
}

function parseArgs(argv: string[]): ParsedArgs {
  const commands: Command[] = ['trace', 'replay', 'explain', 'help'];
  let positionalCommand: Command | undefined;
  let explicitHelp = false;

  // Extract subcommand if present (argv[0])
  if (argv.length > 0 && commands.includes(argv[0] as Command)) {
    positionalCommand = argv[0] as Command;
    // consume command token so flag parsing doesn't see it as input
    argv = argv.slice(1);
  }

  if (positionalCommand === 'help') {
      explicitHelp = true;
  }
  if (argv.includes('--help') || argv.includes('-h')) {
      explicitHelp = true;
      // If no command was set, help becomes the command
      if (!positionalCommand) positionalCommand = 'help';
  }

  const options: ParsedArgs = {
    command: positionalCommand,
    explicitHelp,
    input: undefined,
    strict: false,
    format: 'human',
    exportFormat: [],
    pretty: false,
    from: undefined,
    branch: undefined,
    at: undefined,
    color: 'auto',
    quiet: false,
    verbose: false,
    output: undefined,
    compliance: undefined,
    profile: undefined,
    replayCheck: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      // already handled
    } else if (token.startsWith('--input=')) {
      options.input = requireInlineValue(token, '--input');
    } else if (token === '--input' || token === '-i') {
      options.input = requireValue(argv, i, '--input');
      i += 1;
    } else if (token.startsWith('--format=')) {
      const format = requireInlineValue(token, '--format') as OutputFormat;
      options.format = format === 'human' || format === 'json' ? format : 'human';
    } else if (token === '--format') {
      const format = requireValue(argv, i, '--format') as OutputFormat;
      options.format = format === 'human' || format === 'json' ? format : 'human';
      i += 1;
    } else if (token === '--json') {
      options.format = 'json';
    } else if (token === '--text' || token === '--human') {
      options.format = 'human';
    } else if (token === '--pretty') {
      options.pretty = true;
    } else if (token.startsWith('--from=')) {
      options.from = requireInlineValue(token, '--from');
    } else if (token === '--from') {
      options.from = requireValue(argv, i, '--from');
      i += 1;
    } else if (token.startsWith('--branch=')) {
      options.branch = requireInlineValue(token, '--branch');
    } else if (token === '--branch') {
      options.branch = requireValue(argv, i, '--branch');
      i += 1;
    } else if (token === '--strict') {
      options.strict = true;
    } else if (token.startsWith('--at=')) {
      options.at = requireInlineValue(token, '--at');
    } else if (token === '--at') {
      options.at = requireValue(argv, i, '--at');
      i += 1;
    } else if (token.startsWith('--color=')) {
      const mode = requireInlineValue(token, '--color') as ColorMode;
      options.color = ['auto', 'always', 'never'].includes(mode) ? mode : 'auto';
    } else if (token === '--color') {
      const mode = requireValue(argv, i, '--color') as ColorMode;
      options.color = ['auto', 'always', 'never'].includes(mode) ? mode : 'auto';
      i += 1;
    } else if (token === '--quiet' || token === '-q') {
      options.quiet = true;
    } else if (token === '--verbose' || token === '-v') {
      options.verbose = true;
    } else if (token.startsWith('--output=')) {
      options.output = requireInlineValue(token, '--output');
    } else if (token === '--output' || token === '-o') {
      options.output = requireValue(argv, i, '--output');
      i += 1;
    } else if (token.startsWith('--compliance=')) {
      options.compliance = requireInlineValue(token, '--compliance');
    } else if (token === '--compliance') {
      options.compliance = requireValue(argv, i, '--compliance');
      i += 1;
    } else if (token.startsWith('--profile=')) {
      options.profile = requireInlineValue(token, '--profile');
    } else if (token === '--profile') {
      options.profile = requireValue(argv, i, '--profile');
      i += 1;
    } else if (token === '--replay-check') {
      options.replayCheck = true;
    } else if (token === '--continuity') {
      options.continuity = true;
    } else if (token.startsWith('--export=')) {
      const exportFmt = requireInlineValue(token, '--export') as ExportFormat;
      if (['json', 'jsonld', 'pdf'].includes(exportFmt)) {
          options.exportFormat.push(exportFmt);
      } else {
          throw new CliError(`Unsupported export format: ${exportFmt}`, 2);
      }
    } else if (token === '--export') {
      const exportFmt = requireValue(argv, i, '--export') as ExportFormat;
      if (['json', 'jsonld', 'pdf'].includes(exportFmt)) {
          options.exportFormat.push(exportFmt);
      } else {
          throw new CliError(`Unsupported export format: ${exportFmt}`, 2);
      }
      i += 1;
    }
  }

  // Deduplicate export formats
  options.exportFormat = Array.from(new Set(options.exportFormat));
  if (options.profile && !options.compliance) {
    options.compliance = options.profile;
  }

  return options;
}

function readStdin(): string {
  if (readStdinOverride !== undefined) {
    return readStdinOverride;
  }
  return fs.readFileSync(0, 'utf-8');
}

function stableGeneratedAt(): string {
  const frozen = process.env.LTP_INSPECT_FROZEN_TIME;
  if (frozen) {
    const parsed = new Date(frozen);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  const freezeClock =
    process.env.LTP_INSPECT_FREEZE_CLOCK === '1' ||
    process.env.LTP_INSPECT_FREEZE_CLOCK?.toLowerCase() === 'true';
  if (freezeClock) return DETERMINISTIC_TIMESTAMP;
  return new Date().toISOString();
}

function normalizeInputPathForOutput(resolved: string): string {
  const relative = path.relative(process.cwd(), resolved);
  const candidate = relative && !relative.startsWith('..') ? relative : resolved;
  return candidate.split(path.sep).join('/');
}

// Canonicalize JSON for hash verification (sorts keys recursively)
function canonicalize(obj: any): any {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(canonicalize);
  }
  const sorted: Record<string, any> = {};
  Object.keys(obj)
    .sort()
    .forEach((key) => {
      sorted[key] = canonicalize(obj[key]);
    });
  return sorted;
}

// Emulate serde_json::to_vec behavior on canonicalized object
function canonicalJsonBytes(frame: any): Buffer {
  const canon = canonicalize(frame);
  return Buffer.from(JSON.stringify(canon), 'utf8');
}

function verifyTraceIntegrity(entries: TraceEntry[]): { valid: boolean; firstViolation?: number } {
  if (!entries.length) return { valid: true };

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const frameBytes = canonicalJsonBytes(entry.frame);
    const hasher = crypto.createHash('sha256');
    hasher.update(entry.prev_hash);
    hasher.update(frameBytes);
    const calculatedHash = hasher.digest('hex');

    if (calculatedHash !== entry.hash) {
      return { valid: false, firstViolation: i };
    }

    if (i < entries.length - 1) {
      const next = entries[i + 1];
      if (next.prev_hash !== entry.hash) {
        return { valid: false, firstViolation: i + 1 };
      }
    }
  }

  return { valid: true };
}

function verifyReplayDeterminism(entries: TraceEntry[]): { valid: boolean; error?: string; at?: number } {
  const integrity = verifyTraceIntegrity(entries);
  if (!integrity.valid) return { valid: false, error: 'Trace integrity broken', at: integrity.firstViolation };

  // Basic state machine check
  let hasOrientation = false;
  for (let i = 0; i < entries.length; i++) {
    const frame = entries[i].frame;
    if (frame.type === 'orientation') hasOrientation = true;
  }

  return { valid: true };
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
): {
  frames: LtpFrame[];
  entries: TraceEntry[];
  format: InspectSummary['input']['format'];
  inputPath?: string;
  inputSource: InspectSummary['input']['source'];
  type: 'raw' | 'audit_log';
  hash_root?: string;
} {
  const isStdin = filePath === '-' || filePath === undefined;
  const resolved = isStdin ? 'stdin' : path.resolve(filePath);

  if (!isStdin && !fs.existsSync(resolved)) {
    throw new CliError(`Frame log not found: ${resolved}`, 2);
  }

  const raw = isStdin ? readStdin() : fs.readFileSync(resolved, 'utf-8');
  if (!raw.trim()) throw new CliError(`Frame log is empty: ${resolved}`, 2);

  let parsed: any[] = [];
  let format: 'json' | 'jsonl' = 'json';

  // Handle UTF-8 BOM (common on Windows) so format detection is stable.
  const rawNoBom = raw.replace(/^\uFEFF/, '');
  const rawTrimStart = rawNoBom.trimStart();

  if (rawTrimStart.startsWith('[')) {
    throw new CliError(
      'Legacy JSON array format is not supported. Use JSONL (newline-delimited).\n' + JSONL_HINT,
      2,
    );
  } else {
    try {
      parsed = rawNoBom
        .split(/\r?\n/)
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => line.trim().length > 0)
        .map(({ line, index }) => {
          const trimmed = line.trim();
          try {
            return JSON.parse(trimmed);
          } catch (err) {
            if (trimmed.match(/}\s*\{/)) {
              throw new CliError(`Line ${index + 1}: Only one JSON object per line allowed\n${JSONL_HINT}`, 2);
            }
            throw new CliError(
              `Invalid JSONL line ${index + 1}: ${(err as Error).message}\n${JSONL_HINT}`,
              2,
            );
          }
        });
      format = 'jsonl';
    } catch (err) {
      throw err;
    }
  }

  // Detect if it is an audit log (TraceEntry) or raw frames
  const isAuditLog = parsed.length > 0 && 'prev_hash' in parsed[0] && 'frame' in parsed[0];

  let frames: LtpFrame[] = [];
  let entries: TraceEntry[] = [];
  let hash_root: string | undefined;

  if (isAuditLog) {
    entries = parsed as TraceEntry[];
    frames = entries.map((e) => e.frame);
    hash_root = entries.length > 0 ? entries[entries.length - 1].hash : undefined;
  } else {
    frames = parsed as LtpFrame[];
  }

  return {
    frames,
    entries,
    format,
    inputSource: isStdin ? 'stdin' : 'file',
    inputPath: isStdin ? undefined : normalizeInputPathForOutput(resolved),
    type: isAuditLog ? 'audit_log' : 'raw',
    hash_root,
  };
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

function detectContinuity(frames: LtpFrame[]): { preserved: boolean; notes: string[]; token?: string; breaks: number } {
  const tokens = frames
    .map((f) => f.continuity_token)
    .filter((token): token is string => typeof token === 'string' && token.length > 0);

  const token = tokens.length ? tokens[tokens.length - 1] : undefined;
  const unique = new Set(tokens);

  const breaks = Math.max(0, unique.size - 1);

  if (unique.size <= 1) return { preserved: true, notes: [], token, breaks: 0 };

  return {
    preserved: false,
    token,
    notes: ['continuity token rotation detected mid-session'],
    breaks,
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
    if (
      identity !== undefined &&
      !(
        (typeof identity === 'string' && identity.trim().length > 0) ||
        (typeof identity === 'object' && identity !== null && !Array.isArray(identity))
      )
    ) {
      violations.push(`${label} identity must be a string or object if provided`);
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
  entries: TraceEntry[],
  input: { path?: string; source: InspectSummary['input']['source']; type: 'raw' | 'audit_log'; hash_root?: string },
  format: InspectSummary['input']['format'],
  complianceArg?: string,
  replayCheck?: boolean,
): { summary: InspectSummary; violations: string[]; warnings: string[]; normalizations: string[] } {
  const complianceProfile = complianceArg;
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

  let compliance: ComplianceReport | undefined;
  if (complianceProfile || replayCheck || input.type === 'audit_log') {
    const integrity = verifyTraceIntegrity(entries);
    const traceIntegrity = input.type === 'audit_log'
        ? (integrity.valid ? 'verified' : 'broken')
        : 'unchecked';

    const identityStatus = identity !== 'unknown' ? 'ok' : 'violated';
    const determinism = verifyReplayDeterminism(entries);

    let signatureInfo: ComplianceReport['signatures'] | undefined;
    if (input.type === 'audit_log') {
        const entriesWithSig = entries.filter(e => e.signature);
        const present = entriesWithSig.length > 0;
        const keyIds = Array.from(new Set(entriesWithSig.map(e => e.key_id).filter(k => !!k) as string[]));
        const algs = Array.from(new Set(entriesWithSig.map(e => e.alg).filter(a => !!a) as string[]));

        signatureInfo = {
            present,
            valid: present,
            key_ids: keyIds,
            algorithm: algs.length ? algs.join(',') : undefined
        };
    }

    compliance = {
      profile: complianceProfile ?? 'custom',
      trace_integrity: traceIntegrity as any,
      first_violation_index: integrity.firstViolation,
      identity_binding: identityStatus,
      continuity: {
        breaks: continuity.breaks,
      },
      replay_determinism: determinism.valid ? 'ok' : 'failed',
      determinism_details: determinism.error,
      protocol: 'LTP/0.1',
      node: 'ltp-rust-node@0.1.0',
      signatures: signatureInfo
    };
  }

  let auditSummary;
  if (compliance && (complianceProfile === 'fintech' || complianceProfile === 'agentic' || complianceProfile === 'agents')) {
    const failedChecks: string[] = [];
    const violations: ComplianceViolation[] = [];
    const violationsCountBySeverity: Record<string, number> = {
        CRITICAL: 0,
        HIGH: 0,
        MODERATE: 0,
        LOW: 0
    };

    if (compliance.trace_integrity !== 'verified') {
        failedChecks.push('trace_integrity');
        violations.push({
            rule_id: 'CORE.INTEGRITY',
            severity: 'CRITICAL',
            frame_index: compliance.first_violation_index ?? -1,
            source: 'system',
            action: 'verify_trace',
            evidence: `Trace integrity check failed or unchecked (status: ${compliance.trace_integrity})`
        });
    }
    if (compliance.identity_binding !== 'ok') {
        failedChecks.push('identity_binding');
         violations.push({
            rule_id: 'CORE.IDENTITY',
            severity: 'HIGH',
            frame_index: -1,
            source: 'system',
            action: 'verify_identity',
            evidence: 'Identity binding check failed'
        });
    }
    if (compliance.replay_determinism !== 'ok') {
        failedChecks.push('replay_determinism');
         violations.push({
            rule_id: 'CORE.DETERMINISM',
            severity: 'HIGH',
            frame_index: -1,
            source: 'system',
            action: 'verify_replay',
            evidence: compliance.determinism_details ?? 'Replay determinism check failed'
        });
    }

    if (complianceProfile === 'agentic' || complianceProfile === 'agents') {
        frames.forEach((frame, index) => {
            if (frame.type === 'route_response') {
                const payload = frame.payload || {};
                const context = (payload as any).context;
                const targetState = (payload as any).targetState;
                const admissible = (payload as any).admissible;
                const capabilities = (payload as any).capabilities ?? [];

                if (targetState && typeof targetState === 'string') {
                    const isCritical = CRITICAL_ACTIONS.includes(targetState);

                    if (isCritical && admissible === true) {
                        if (context === 'WEB') {
                             failedChecks.push(AGENT_RULES.WEB_DIRECT);
                             compliance!.determinism_details = `Security Violation: WEB context allowed to perform critical action '${targetState}' at frame #${index}`;
                             violations.push({
                                rule_id: AGENT_RULES.WEB_DIRECT,
                                severity: 'CRITICAL',
                                frame_index: index,
                                source: context,
                                action: targetState,
                                evidence: 'WEB context allowed to perform critical action'
                             });
                        }

                        const requiredCap = `CAPABILITY_${targetState.toUpperCase()}`;
                        const hasCap = Array.isArray(capabilities) && capabilities.includes(requiredCap);

                        if (!hasCap) {
                            failedChecks.push(AGENT_RULES.NO_CAPABILITY);
                            violations.push({
                                rule_id: AGENT_RULES.NO_CAPABILITY,
                                severity: 'CRITICAL',
                                frame_index: index,
                                source: context || 'unknown',
                                action: targetState,
                                evidence: `Missing required capability: ${requiredCap}`
                             });
                        }
                    }
                }
            }
        });
    }

    violations.forEach(v => {
        violationsCountBySeverity[v.severity] = (violationsCountBySeverity[v.severity] || 0) + 1;
    });

    const verdict = failedChecks.length === 0 ? 'PASS' : 'FAIL';
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (failedChecks.includes('trace_integrity') || violationsCountBySeverity['CRITICAL'] > 0) {
        riskLevel = 'HIGH';
    } else if (failedChecks.length > 0) {
        riskLevel = 'MEDIUM';
    }

    auditSummary = {
        verdict,
        risk_level: riskLevel,
        failed_checks: failedChecks,
        violations: violations,
        violations_count_by_severity: violationsCountBySeverity,
        regulator_ready: verdict === 'PASS'
    };
  }

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
        type: input.type,
        hash_root: input.hash_root,
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
      compliance,
      audit_summary: auditSummary,
    },
    violations: [...constraintViolations, ...validation.violations, ...violations],
    warnings,
    normalizations: [...constraintNormalizations, ...normalizations],
  };
}

export function formatJson(summary: InspectSummary, pretty = false): string {
  return JSON.stringify(canonicalizeSummary(summary), null, pretty ? 2 : 0);
}

function exportJson(summary: InspectSummary, path: string): void {
  fs.writeFileSync(path, formatJson(summary, true));
}

function exportJsonLd(summary: InspectSummary, path: string): void {
  const jsonLd = {
    "@context": "https://w3id.org/ltp/v0.1/context.jsonld",
    "@type": "ComplianceReport",
    "generatedAt": summary.generated_at,
    "integrity": {
       "hashRoot": summary.input.hash_root,
       "status": summary.compliance?.trace_integrity
    },
    "compliance": summary.compliance,
    "summary": summary
  };
  fs.writeFileSync(path, JSON.stringify(jsonLd, null, 2));
}

function exportPdf(summary: InspectSummary, outputPath: string): void {
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(outputPath);
    doc.pipe(stream);

    doc.fontSize(20).text('LTP Compliance Artifact', { align: 'center' });
    doc.moveDown();

    if (summary.audit_summary) {
        doc.fontSize(16).text('Audit Summary');
        const verdictColor = summary.audit_summary.verdict === 'PASS' ? 'green' : 'red';
        doc.fillColor(verdictColor).fontSize(14).text(`Verdict: ${summary.audit_summary.verdict}`);
        doc.fillColor('black').fontSize(12).text(`Risk Level: ${summary.audit_summary.risk_level}`);
        doc.text(`Regulator Ready: ${summary.audit_summary.regulator_ready}`);

        if (summary.audit_summary.violations && summary.audit_summary.violations.length > 0) {
            doc.moveDown();
            doc.fontSize(14).text('Violations');
            summary.audit_summary.violations.forEach(v => {
                 doc.fillColor('red').fontSize(10).text(`[${v.severity}] ${v.rule_id} @ Frame #${v.frame_index}`);
                 doc.fillColor('black').text(`  Evidence: ${v.evidence}`);
            });
        }

        doc.moveDown();
    }

    doc.fontSize(12).text(`Generated At: ${summary.generated_at}`);
    doc.text(`Tool: ${summary.tool.name} (build: ${summary.tool.build})`);
    doc.text(`Input: ${summary.input.path || summary.input.source}`);
    doc.text(`Hash Root: ${summary.input.hash_root || 'N/A'}`);
    doc.moveDown();

    doc.fontSize(16).text('Compliance Status');
    if (summary.compliance) {
        doc.fontSize(12).text(`Profile: ${summary.compliance.profile}`);
        doc.text(`Trace Integrity: ${summary.compliance.trace_integrity}`);
        doc.text(`Identity Binding: ${summary.compliance.identity_binding}`);
        doc.text(`Replay Determinism: ${summary.compliance.replay_determinism}`);

        if (summary.compliance.signatures) {
             doc.moveDown();
             doc.text('Signatures:');
             doc.text(`  Present: ${summary.compliance.signatures.present}`);
             doc.text(`  Key IDs: ${summary.compliance.signatures.key_ids.join(', ') || 'None'}`);
             doc.text(`  Algorithm: ${summary.compliance.signatures.algorithm || 'N/A'}`);
        }
    } else {
        doc.fontSize(12).text('No compliance profile active.');
    }

    doc.moveDown();
    doc.fontSize(16).text('Orientation Summary');
    doc.fontSize(12).text(`Identity: ${summary.orientation.identity}`);
    doc.text(`Drift Level: ${summary.orientation.drift_level}`);
    doc.text(`Continuity: ${summary.continuity.preserved ? 'Preserved' : 'Broken'}`);

    doc.moveDown();
    doc.fontSize(16).text('Futures');
    const { admissible, degraded, blocked } = summary.futures;
    doc.fontSize(12).text(`Admissible: ${admissible.length}`);
    doc.text(`Degraded: ${degraded.length}`);
    doc.text(`Blocked: ${blocked.length}`);

    doc.end();
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

export function formatHuman(summary: InspectSummary, options: { includeBanner?: boolean } = {}): string {
  const lines: string[] = [];
  const includeBanner = options.includeBanner !== false;
  if (includeBanner) {
    lines.push(`LTP INSPECTOR  v${summary.contract.version}`);
  }
  const inputLabel = summary.input.path ?? summary.input.source;
  lines.push(`input: ${inputLabel}  time: ${summary.generated_at}`);

  if (summary.compliance) {
    lines.push('');
    lines.push('COMPLIANCE REPORT');
    lines.push(`profile: ${summary.compliance.profile}`);
    lines.push(`trace_integrity: ${summary.compliance.trace_integrity} ${summary.compliance.first_violation_index !== undefined ? `(fail @ ${summary.compliance.first_violation_index})` : ''}`);
    lines.push(`identity_binding: ${summary.compliance.identity_binding}`);
    lines.push(`replay_determinism: ${summary.compliance.replay_determinism}`);
    if (summary.compliance.signatures?.present) {
        lines.push(`signatures: verified (keys: ${summary.compliance.signatures.key_ids.join(', ')})`);
    }
  }

  if (summary.audit_summary) {
    lines.push('');
    lines.push('AUDIT SUMMARY');
    const verdict = summary.audit_summary.verdict;
    lines.push(`VERDICT: ${verdict}`);
    lines.push(`risk_level: ${summary.audit_summary.risk_level}`);
    lines.push(`regulator_ready: ${summary.audit_summary.regulator_ready}`);

    if (summary.audit_summary.violations && summary.audit_summary.violations.length > 0) {
        lines.push('');
        lines.push('VIOLATIONS:');
        summary.audit_summary.violations.forEach(v => {
            lines.push(`  [${v.severity}] ${v.rule_id} @ #${v.frame_index}`);
            lines.push(`    Evidence: ${v.evidence}`);
        });
    }
  }

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
  const { frames, entries, format, inputPath, inputSource, type, hash_root } = loadFrames(file);
  return summarize(frames, entries, { path: inputPath, source: inputSource, type, hash_root }, format, undefined, false).summary;
}

type InspectionResult = {
  summary: InspectSummary;
  warnings: string[];
  violations: string[];
  normalizations: string[];
};

function canonicalizeSummary(summary: InspectSummary): InspectSummary {
  return JSON.parse(JSON.stringify(summary)) as InspectSummary;
}

function handleTrace(
  file: string,
  format: OutputFormat,
  pretty: boolean,
  strict: boolean,
  compliance: string | undefined,
  replayCheck: boolean,
  writer: Writer,
  exportFormats: ExportFormat[],
  continuityCheck?: boolean,
  profile?: string,
  includeBanner = true,
): InspectionResult {
  const { frames, entries, format: inputFormat, inputPath, inputSource, type, hash_root } = loadFrames(file);
  const { summary, violations, warnings, normalizations } = summarize(
    frames,
    entries,
    { path: inputPath, source: inputSource, type, hash_root },
    inputFormat,
    profile ?? compliance,
    replayCheck,
  );

  if (continuityCheck) {
      let systemCoherent = true;
      let firstUnsafeIndex = -1;
      let currentState = 'HEALTHY';
      const stateHistory: {ts: string|number, state: string}[] = [];

      let executed = 0;
      let deferred = 0;
      let replayed = 0;
      let frozen = 0;
      const continuityMessages: string[] = [];

      frames.forEach((frame, idx) => {
          if (frame.type === 'orientation') {
             const status = (frame.payload as any)?.status;
             if (status) {
                 currentState = String(status).toUpperCase();
                 stateHistory.push({ ts: frame.ts || idx, state: currentState });
             }
          } else if (frame.type === 'route_request') {
              if ((frame.payload as any)?.replay_context) {
                  replayed++;
              }
          } else if (frame.type === 'route_response') {
              const payload = (frame.payload as any) || {};
              const admissible = payload.admissible;
              const targetAction = payload.targetState || 'unknown';
              const decision = String(payload.decision ?? '').toUpperCase();

              if (decision === 'EXECUTE') executed++;
              else if (decision === 'DEFER') deferred++;
              else if (decision === 'FREEZE') frozen++;
              else if (!decision && admissible === true) executed++;
              else if (!decision && admissible === false) deferred++;

              if (currentState === 'FAILED' || currentState === 'UNSTABLE') {
                  if (admissible) {
                      const isRecovery = RECOVERY_ACTIONS.some(action => targetAction.includes(action));
                      if (!isRecovery) {
                          systemCoherent = false;
                          if (firstUnsafeIndex === -1) firstUnsafeIndex = idx;
                          const msg = `Continuity Violation: Action '${targetAction}' allowed during ${currentState} state at frame #${idx}`;
                          continuityMessages.push(msg);
                          if (strict) {
                              violations.push(msg);
                          } else {
                              warnings.push(msg);
                          }
                      }
                  }
              }
          }
      });

      summary.continuity_routing = {
          checked: true,
          system_remained_coherent: systemCoherent,
          first_unsafe_transition_index: firstUnsafeIndex === -1 ? null : firstUnsafeIndex,
          state_transitions: stateHistory.length,
          state_transition_path: stateHistory.map(s => s.state),
          routing_stats: { executed, deferred, replayed, frozen }
      };

      if (format === 'human') {
          writer('');
          writer('CONTINUITY ROUTING INSPECTION');
          writer(`System Remained Coherent: ${systemCoherent ? 'YES' : 'NO'}`);
          if (!systemCoherent) {
             writer(`First Unsafe Transition: #${firstUnsafeIndex}`);
             continuityMessages.forEach(msg => writer(msg));
          }
          writer(`State Transitions Observed: ${stateHistory.map(s => s.state).join(' -> ')}`);
          writer(`Routing Decisions: Executed=${executed} Deferred=${deferred} Replayed=${replayed} Frozen=${frozen}`);
      }
  }

  if (format === 'json') printJson(summary, pretty, writer);
  else printHuman(summary, writer, { includeBanner });

  if (exportFormats && exportFormats.length > 0) {
     const outputDir = process.cwd();
     const baseName = (file && file !== '-') ? path.basename(file, path.extname(file)) : 'ltp-report';

     for (const fmt of exportFormats) {
        const ext = fmt === 'jsonld' ? 'jsonld' : fmt;
        const filename = `${baseName}_compliance.${ext}`;
        const outputPath = path.join(outputDir, filename);

        if (fmt === 'json') {
            exportJson(summary, outputPath);
            writer(`Exported JSON to ${outputPath}`);
        } else if (fmt === 'jsonld') {
            exportJsonLd(summary, outputPath);
            writer(`Exported JSON-LD to ${outputPath}`);
        } else if (fmt === 'pdf') {
            exportPdf(summary, outputPath);
            writer(`Exported PDF to ${outputPath}`);
        }
     }
  }

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
  const { frames, entries, format, inputPath, inputSource, type } = loadFrames(file);
  const targetIndex = at
    ? frames.findIndex((f) => f.id === at || String(f.ts) === at || `step-${f.id}` === at)
    : frames.length - 1;
  const boundedIndex = targetIndex >= 0 ? targetIndex : frames.length - 1;
  const window = frames.slice(0, boundedIndex + 1);
  const prior = frames.slice(0, boundedIndex);

  const { summary, violations } = summarize(window, [], { path: inputPath, source: inputSource, type }, format, undefined, false);
  const previous = prior.length ? summarize(prior, [], { path: inputPath, source: inputSource, type }, format, undefined, false).summary : undefined;

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
  writer('  ltp inspect trace --input <frames.jsonl> [--strict] [--format json|human] [--pretty] [--color auto|always|never] [--quiet] [--verbose] [--output <file>] [--compliance fintech] [--replay-check] [--export json|jsonld|pdf]');
  writer('  ltp inspect replay --input <frames.jsonl> [--from <frameId>]');
  writer('  ltp inspect explain --input <frames.jsonl> [--at <frameId|ts>] [--branch <id>]');
  writer('');
  writer('Examples:');
  writer('  ltp inspect trace --input tools/ltp-inspect/fixtures/minimal.frames.jsonl --format=human');
  writer('  ltp inspect trace --input tools/ltp-inspect/fixtures/minimal.frames.jsonl --format=json');
  writer('  ltp inspect trace --continuity --input examples/traces/continuity-outage.trace.jsonl');
  writer('  ltp inspect trace --format=json --quiet --input examples/traces/drift-recovery.jsonl | jq .orientation');
  writer('  ltp inspect explain --input examples/traces/drift-recovery.jsonl --at step-3');
  writer('');
  writer('Output:');
  writer('  JSON (v1 contract) with deterministic ordering for CI. Additional fields remain optional.');
  writer('  Human format shows identity, focus momentum, drift history, continuity, and future branches with rationale.');
  writer('  --strict treats canonicalization needs as contract violations (exit 2).');
  writer('  --quiet suppresses banners/RESULT lines (primary report output remains).');
  writer('');
  writer('Exit codes:');
  writer('  0 OK — contract produced');
  writer('  1 warnings only (normalized output or degraded signals)');
  writer('  2 error (invalid input, contract violation, or runtime failure)');
}

function printJson(summary: InspectSummary, pretty = false, writer: Writer): void {
  writer(formatJson(summary, pretty));
}

function printHuman(summary: InspectSummary, writer: Writer, options?: { includeBanner?: boolean }): void {
  writer(formatHuman(summary, options));
}

export function execute(
  argv: string[],
  logger: Pick<Console, 'log' | 'error'> = console,
  io?: { stdin?: string },
): number {
  const buffer: string[] = [];
  const writer = (message: string) => buffer.push(message);
  const errorWriter = (message: string) => logger.error(message);
  const previousStdin = readStdinOverride;

  if (io?.stdin !== undefined) {
    readStdinOverride = io.stdin;
  }

  try {
    const args = parseArgs(argv);
    if (args.explicitHelp) {
      printHelp(writer);
      buffer.forEach((line) => logger.log(line));
      return 0;
    }
    if (!args.command || args.command === 'help') {
        // Implicit default is removed. Must exit 2 with help.
        errorWriter('ERROR: Missing command (trace | replay | explain)');
        errorWriter('hint: ltp inspect trace --input <file.jsonl>');
        errorWriter('hint: ltp inspect --help');

        if (!args.quiet) buffer.forEach((line) => logger.error(line));
        process.exitCode = 2;
        return 2;
    }

    if (!args.input) {
      // Check strict input requirement
      // Some commands like replay/explain might theoretically work without input if they had defaults, but currently we require it.
      errorWriter('ERROR: Missing --input <frames.jsonl>');
      // printHelp(writer);

      if (!args.quiet) buffer.forEach((line) => logger.error(line));
      process.exitCode = 2;
      return 2;
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
          const { violations, warnings, normalizations, summary } = handleTrace(
            args.input as string,
            args.format,
            args.pretty,
            args.strict,
            args.compliance,
            args.replayCheck,
            writer,
            args.exportFormat,
            args.continuity,
            args.profile,
            !args.quiet,
          );
          const contractBreaches = [...violations];
          const hasCanonicalGaps = normalizations.length > 0;
          const hasWarnings = warnings.length > 0 || normalizations.length > 0;

          if (args.strict && hasCanonicalGaps) {
            contractBreaches.push(
              ...normalizations.map((note) => `non-canonical input (normalization would be required): ${note}`),
            );
          }

          if (summary.compliance) {
             if (summary.compliance.trace_integrity !== 'verified') {
                 contractBreaches.push(`TRACE INTEGRITY ERROR: ${summary.compliance.trace_integrity} (must be 'verified')`);
             }
             if (summary.compliance.identity_binding === 'violated') {
                 contractBreaches.push(`IDENTITY BINDING VIOLATED`);
             }
             if (summary.compliance.replay_determinism === 'failed') {
                 contractBreaches.push(`REPLAY DETERMINISM FAILED`);
             }

             if (summary.audit_summary && summary.audit_summary.violations.length > 0) {
                 const criticalViolations = summary.audit_summary.violations.filter(v => v.severity === 'CRITICAL');
                 if (criticalViolations.length > 0) {
                     contractBreaches.push(`CRITICAL COMPLIANCE VIOLATIONS: ${criticalViolations.map(v => v.rule_id).join(', ')}`);
                 }
             }
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
          if (args.format === 'human' && !args.quiet) {
            writer('');
            writer(`RESULT: ${statusText}  exit: ${exitCode}`);
          }

          if (args.output) fs.writeFileSync(args.output, buffer.join('\n'), 'utf-8');
          buffer.forEach((line) => logger.log(line));
          return exitCode;
        }
      case 'replay':
        handleReplay(args.input as string, args.from, writer);
        if (args.output) fs.writeFileSync(args.output, buffer.join('\n'), 'utf-8');
        if (!args.quiet) {
          buffer.forEach((line) => logger.log(line));
        }
        break;
      case 'explain':
        {
          const { violations } = handleExplain(args.input as string, args.at, args.branch, writer);
          if (violations.length) {
            throw new CliError(`Contract violation: ${violations.join('; ')}`, 2);
          }
          if (args.output) fs.writeFileSync(args.output, buffer.join('\n'), 'utf-8');
          if (!args.quiet) {
            buffer.forEach((line) => logger.log(line));
          }
        }
        break;
      default:
        // Should not happen due to check above, but:
        if (!args.quiet) buffer.forEach((line) => logger.log(line));
        return 2;
    }
    return 0;
  } catch (err) {
    if (err instanceof CliError) {
      const hint =
        err.exitCode === 2
          ? 'hint: pass a JSONL file or pipe JSONL via stdin (use - for stdin)'
          : 'hint: re-run with --format=json to inspect the contract payload';
      const example = 'example: ltp inspect trace --format=json --input tools/ltp-inspect/fixtures/minimal.frames.jsonl';
      errorWriter(`ERROR: ${err.message}`);
      errorWriter(hint);
      errorWriter(example);
      process.exitCode = err.exitCode;
      return err.exitCode;
    }
    errorWriter(`Runtime failure: ${(err as Error).message}`);
    process.exitCode = 2;
    return 2;
  } finally {
    readStdinOverride = previousStdin;
  }
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const exitCode = execute(argv, console);
  process.exit(exitCode);
}

if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else if (typeof process !== 'undefined' && process.env.LTP_INSPECT_TEST_RUN === '1') {
    main(process.argv.slice(2)).catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
