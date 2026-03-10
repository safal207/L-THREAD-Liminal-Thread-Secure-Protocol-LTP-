import type { ReplayStep } from './types';

const MAX_TEXT_LENGTH = 500;

function colorize(text: string, status: ReplayStep['status'], enabled: boolean): string {
  if (!enabled) return text;

  const colorByStatus: Record<ReplayStep['status'], string> = {
    admissible: '\u001b[32m',
    drift: '\u001b[33m',
    rejected: '\u001b[31m',
    unknown: '\u001b[90m',
  };

  return `${colorByStatus[status]}${text}\u001b[0m`;
}

function truncateText(text: string): string {
  if (text.length <= MAX_TEXT_LENGTH) return text;
  return text.slice(0, MAX_TEXT_LENGTH) + '...(truncated)';
}

export function formatReplay(steps: ReplayStep[], colorEnabled: boolean): string {
  const lines: string[] = ['--- LTP Trace Replay ---', ''];

  for (const step of steps) {
    const statusText = colorize(step.status, step.status, colorEnabled);
    lines.push(`[${step.index}] ${step.id} (${statusText})${step.chunk_id ? ` [chunk:${step.chunk_id}]` : ''}`);
    if (step.text) {
      lines.push(`    ${truncateText(step.text)}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}
