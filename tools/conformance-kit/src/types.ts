import type { FrameType } from '../../../sdk/js/src/frames/frameSchema';

export type LTPFrameShape = {
  v?: unknown;
  id?: unknown;
  ts?: unknown;
  type?: unknown;
  payload?: unknown;
  from?: unknown;
  to?: unknown;
};

export type NormalizedFrame = {
  v: string;
  id: string;
  ts: number;
  type: FrameType | string;
  payload: unknown;
  from?: string;
  to?: string;
};

export interface Issue {
  code: string;
  message: string;
  at?: number;
  frameId?: string;
}

export type OutcomeStatus = 'OK' | 'WARN' | 'FAIL';

export interface ConformanceReport {
  v: '0.1';
  ok: boolean;
  score: number;
  frameCount: number;
  passed: string[];
  warnings: Issue[];
  errors: Issue[];
  hints: string[];
  annotations?: Record<string, unknown>;
  meta: {
    timestamp: number;
    tool: 'ltp-conformance-kit';
    toolVersion: string;
    inputName?: string;
    inputHash?: string;
  };
}

export interface ConformanceCaseResult {
  fileName: string;
  expected: OutcomeStatus;
  actual: OutcomeStatus;
  matches: boolean;
  report: ConformanceReport;
}

export interface ConformanceReportBatch {
  v: '0.1';
  ok: boolean;
  score: number;
  reports: ConformanceReport[];
  cases: ConformanceCaseResult[];
  summary: {
    total: number;
    passedCount: number;
    warnCount: number;
    failedCount: number;
    unexpectedCount: number;
  };
  meta: ConformanceReport['meta'];
}

export type VerifyOutcome = {
  report: ConformanceReport;
  exitCode: number;
};
