import fs from 'node:fs';
import crypto from 'node:crypto';
import type { TraceTransition } from './types';

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function collectChunkIds(record: Record<string, unknown>): string[] {
  const ids = new Set<string>();
  const possible = [record.chunk_id, record.chunkId, asObject(record.payload)?.chunk_id, asObject(record.payload)?.chunkId];
  possible.forEach((value) => {
    if (typeof value === 'string' && value.trim()) ids.add(value);
  });
  return [...ids];
}

function extractStatus(record: Record<string, unknown>): string | undefined {
  const payload = asObject(record.payload);
  const status = record.status ?? payload?.status ?? payload?.branch_status ?? payload?.branchStatus;
  return typeof status === 'string' ? status.toLowerCase() : undefined;
}

export function loadTraceTransitions(traceFile: string): Map<string, TraceTransition> {
  const raw = fs.readFileSync(traceFile, 'utf-8');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  const transitions = new Map<string, TraceTransition>();

  lines.forEach((line) => {
    const parsed = JSON.parse(line) as unknown;
    const record = asObject(parsed);
    if (!record) return;

    const frame = asObject(record.frame);
    const transitionId = (record.transition_id ?? record.transitionId ?? record.id ?? frame?.id) as unknown;
    if (typeof transitionId !== 'string' || !transitionId.trim()) return;

    const contentSource = frame ?? record;
    const canonicalContent = JSON.stringify(contentSource);
    const fallbackHash = crypto.createHash('sha256').update(canonicalContent).digest('hex');
    const explicitHash = record.hash;
    const hash = typeof explicitHash === 'string' ? explicitHash : fallbackHash;

    const current = transitions.get(transitionId) ?? {
      transition_id: transitionId,
      chunk_ids: new Set<string>(),
      hash,
      status: extractStatus(record),
      textBlob: canonicalContent.toLowerCase(),
    };

    collectChunkIds(record).forEach((id) => current.chunk_ids.add(id));
    if (!current.status) current.status = extractStatus(record);
    transitions.set(transitionId, current);
  });

  return transitions;
}
