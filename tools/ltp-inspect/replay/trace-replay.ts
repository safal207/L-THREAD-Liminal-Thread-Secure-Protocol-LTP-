import fs from 'node:fs';
import type { ReplayStep } from './types';

const MAX_WARN_BYTES = 50 * 1024 * 1024;

type TraceRecord = Record<string, any>;

type RawStep = Omit<ReplayStep, 'index'> & { order: number; tsMs?: number };

function normalizeStatus(input: unknown): ReplayStep['status'] {
  const raw = String(input ?? '').toLowerCase();
  if (raw.includes('drift')) return 'drift';
  if (raw.includes('reject')) return 'rejected';
  if (raw.includes('admissible')) return 'admissible';
  return 'unknown';
}

function extractId(record: TraceRecord, lineIndex: number): string {
  return (
    record.transition_id ??
    record.transitionId ??
    record.id ??
    record.frame?.id ??
    `step-${lineIndex}`
  );
}

function extractStatus(record: TraceRecord): ReplayStep['status'] {
  const source = record.status ?? record.payload?.status ?? record.payload?.branch_status ?? 'unknown';
  return normalizeStatus(source);
}

function extractText(record: TraceRecord): string | undefined {
  const text = record.payload?.text ?? record.payload?.content ?? record.payload?.message;
  return typeof text === 'string' ? text : undefined;
}

function extractTimestamp(record: TraceRecord): string | undefined {
  const timestamp = record.timestamp ?? record.ts ?? record.created_at;
  return typeof timestamp === 'string' ? timestamp : undefined;
}

function parseJsonl(raw: string): Array<{ record: TraceRecord; lineIndex: number }> {
  const parsed: Array<{ record: TraceRecord; lineIndex: number }> = [];
  const lines = raw.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]?.trim();
    if (!line) continue;

    try {
      const record = JSON.parse(line);
      if (record && typeof record === 'object' && !Array.isArray(record)) {
        parsed.push({ record, lineIndex: i + 1 });
      }
    } catch {
      // skip malformed JSON line
    }
  }

  return parsed;
}

export function replayTrace(traceFile: string): ReplayStep[] {
  try {
    const stats = fs.statSync(traceFile);
    if (stats.size > MAX_WARN_BYTES) {
      process.stderr.write(
        `[ltp:replay] warning: trace file is ${(stats.size / 1024 / 1024).toFixed(1)}MB — processing may be slow\n`,
      );
    }
  } catch {
    return [];
  }

  try {
    const raw = fs.readFileSync(traceFile, 'utf-8');
    const records = parseJsonl(raw);

    const rawSteps: RawStep[] = records.map(({ record, lineIndex }, idx) => {
      const timestamp = extractTimestamp(record);
      const tsMs = timestamp ? Date.parse(timestamp) : NaN;

      return {
        order: idx,
        id: String(extractId(record, lineIndex)),
        status: extractStatus(record),
        text: extractText(record),
        timestamp,
        chunk_id: typeof record.chunk_id === 'string' ? record.chunk_id : undefined,
        tsMs: Number.isFinite(tsMs) ? tsMs : undefined,
      };
    });

    const hasTimestamp = rawSteps.some((step) => step.tsMs !== undefined);
    const ordered = hasTimestamp
      ? rawSteps.sort((a, b) => {
          const aTs = a.tsMs ?? Number.POSITIVE_INFINITY;
          const bTs = b.tsMs ?? Number.POSITIVE_INFINITY;
          if (aTs !== bTs) return aTs - bTs;
          return a.order - b.order;
        })
      : rawSteps;

    return ordered.map(({ order: _order, tsMs: _tsMs, ...step }, idx) => ({
      ...step,
      index: idx + 1,
    }));
  } catch {
    return [];
  }
}
