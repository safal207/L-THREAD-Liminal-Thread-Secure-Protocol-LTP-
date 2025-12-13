import fs from 'node:fs';
import path from 'node:path';
import { FRAME_TYPES_V0_1, LTP_VERSION, isKnownFrameType } from '../../../sdk/js/src/frames/protocolSurface.v0.1';
import { isLTPFrame } from '../../../sdk/js/src/frames/frameSchema';
import kitPackage from '../package.json';
import { clamp01 } from './utils/math';
import { ensureDirectory, normalizeFramesFromValue, readJsonFile } from './utils/files';
import type {
  ConformanceReport,
  ConformanceReportBatch,
  ConformanceCaseResult,
  Issue,
  LTPFrameShape,
  NormalizedFrame,
  ExpectedOutcome,
  CaseStatus,
  ReportStatus,
  VerifyOutcome,
} from './types';

interface VerifyOptions {
  inputName?: string;
  inputHash?: string;
  now?: () => number;
  strict?: boolean;
  annotations?: Record<string, unknown>;
}

const addIssue = (bucket: Issue[], issue: Issue): void => {
  bucket.push(issue);
};

const normalizeFrame = (frame: LTPFrameShape, index: number): NormalizedFrame | null => {
  if (frame === null || typeof frame !== 'object') {
    return null;
  }
  const id = typeof frame.id === 'string' ? frame.id : `frame-${index}`;
  const ts = typeof frame.ts === 'number' ? frame.ts : Number.NaN;
  const type = typeof frame.type === 'string' ? frame.type : 'unknown';

  return {
    v: typeof frame.v === 'string' ? frame.v : String(frame.v ?? 'unknown'),
    id,
    ts,
    type,
    payload: (frame as { payload?: unknown }).payload,
    from: typeof frame.from === 'string' ? frame.from : undefined,
    to: typeof frame.to === 'string' ? frame.to : undefined,
  };
};

const countBranches = (payload: unknown): number => {
  if (!payload || typeof payload !== 'object') return 0;
  const candidate = (payload as { branches?: unknown }).branches;
  if (Array.isArray(candidate)) {
    return candidate.length;
  }
  if (candidate && typeof candidate === 'object') {
    return Object.keys(candidate).length;
  }
  return 0;
};

const deriveExitCode = (report: ConformanceReport, strict?: boolean): number => {
  if (report.errors.length > 0) return 1;
  if (report.warnings.length > 0) {
    return strict ? 1 : 2;
  }
  return 0;
};

export const expectedFromName = (name: string): ExpectedOutcome => {
  if (name.startsWith('fail_')) return 'FAIL';
  if (name.startsWith('warn_')) return 'WARN';
  return 'OK';
};

export const statusFromReport = (report: ConformanceReport): ReportStatus => {
  if (report.errors.length > 0) return 'FAIL';
  if (report.warnings.length > 0) return 'WARN';
  return 'OK';
};

export const verifyFrames = (frames: LTPFrameShape[] | null, options: VerifyOptions = {}): VerifyOutcome => {
  const timestamp = options.now ? options.now() : Date.now();
  const baseReport: ConformanceReport = {
    v: '0.1',
    ok: true,
    status: 'OK',
    score: 1,
    frameCount: Array.isArray(frames) ? frames.length : 0,
    passed: [],
    warnings: [],
    errors: [],
    hints: [],
    annotations: options.annotations,
    file: options.inputName,
    meta: {
      timestamp,
      tool: 'ltp-conformance-kit',
      toolVersion: kitPackage.version,
      inputName: options.inputName,
      inputHash: options.inputHash,
    },
  };

  if (!Array.isArray(frames)) {
    addIssue(baseReport.errors, {
      code: 'ltp.input.invalid',
      message: 'frames must be an array or contained in a frames property',
    });
    baseReport.ok = false;
    baseReport.score = 0;
    return { report: baseReport, exitCode: deriveExitCode(baseReport, options.strict) };
  }

  let lastTimestamp: number | undefined;
  const seenIdsBySender = new Map<string, Set<string>>();
  let helloSeen = false;
  let heartbeatSeen = false;
  let orientationSeen = false;
  let routeRequested = false;
  let routeResponded = false;
  let focusSnapshotSeen = false;

  frames.forEach((frame, index) => {
    const normalized = normalizeFrame(frame, index);
    const frameId = normalized?.id ?? `frame-${index}`;

    if (!normalized) {
      addIssue(baseReport.errors, {
        code: 'ltp.frame.shape',
        message: `frame ${index} is not an object`,
        at: index,
      });
      return;
    }

    if (normalized.v !== LTP_VERSION) {
      addIssue(baseReport.errors, {
        code: 'ltp.version.unsupported',
        message: `frame ${index} has unsupported version ${String(normalized.v)}`,
        at: index,
        frameId,
      });
    }

    if (Number.isNaN(normalized.ts)) {
      addIssue(baseReport.errors, {
        code: 'ltp.timestamp.missing',
        message: `frame ${index} is missing a numeric timestamp`,
        at: index,
        frameId,
      });
    } else {
      if (lastTimestamp !== undefined && normalized.ts < lastTimestamp) {
        addIssue(baseReport.warnings, {
          code: 'ltp.timestamp.regression',
          message: `frame ${index} timestamp regressed from ${lastTimestamp} to ${normalized.ts}`,
          at: index,
          frameId,
        });
      }
      lastTimestamp = normalized.ts;
    }

    const sender = normalized.from ?? 'global';
    const seenIds = seenIdsBySender.get(sender) ?? new Set<string>();
    if (seenIds.has(normalized.id)) {
      addIssue(baseReport.errors, {
        code: 'ltp.id.duplicate',
        message: `duplicate frame id detected for sender ${sender}: ${normalized.id}`,
        at: index,
        frameId,
      });
    }
    seenIds.add(normalized.id);
    seenIdsBySender.set(sender, seenIds);

    if (index === 0) {
      if (normalized.type !== 'hello') {
        addIssue(baseReport.errors, {
          code: 'ltp.flow.hello_missing',
          message: 'first frame must be hello',
          at: index,
          frameId,
        });
      } else {
        helloSeen = true;
        baseReport.passed.push('hello frame initiates the session');
      }
    }

    if (normalized.type === 'hello' && index !== 0) {
      addIssue(baseReport.errors, {
        code: 'ltp.flow.hello_redundant',
        message: `hello frame may only start the session (found at index ${index})`,
        at: index,
        frameId,
      });
    }

    if (!helloSeen && normalized.type !== 'hello') {
      addIssue(baseReport.errors, {
        code: 'ltp.flow.before_hello',
        message: `frame ${index} (${normalized.type}) appears before hello`,
        at: index,
        frameId,
      });
    }

    const isKnownType = isKnownFrameType(normalized.type as string);
    if (!isKnownType) {
      addIssue(baseReport.warnings, {
        code: 'ltp.type.unknown',
        message: `frame ${index} has unknown type ${normalized.type}; expected one of ${FRAME_TYPES_V0_1.join(', ')}`,
        at: index,
        frameId,
      });
    }

    if (isKnownType && !isLTPFrame(normalized as any)) {
      addIssue(baseReport.errors, {
        code: 'ltp.schema.invalid',
        message: `frame ${index} failed schema validation for ${normalized.type}`,
        at: index,
        frameId,
      });
    }

    switch (normalized.type) {
      case 'hello': {
        helloSeen = true;
        break;
      }
      case 'heartbeat': {
        heartbeatSeen = true;
        if (!helloSeen) {
          addIssue(baseReport.errors, {
            code: 'ltp.flow.heartbeat_order',
            message: `heartbeat at position ${index} before hello`,
            at: index,
            frameId,
          });
        }
        break;
      }
      case 'orientation': {
        orientationSeen = true;
        if (!helloSeen) {
          addIssue(baseReport.errors, {
            code: 'ltp.flow.orientation_order',
            message: `orientation at position ${index} before hello`,
            at: index,
            frameId,
          });
        }
        break;
      }
      case 'route_request': {
        routeRequested = true;
        if (!helloSeen) {
          addIssue(baseReport.errors, {
            code: 'ltp.flow.route_request_order',
            message: `route_request at position ${index} before hello`,
            at: index,
            frameId,
          });
        }
        if (!orientationSeen) {
          addIssue(baseReport.warnings, {
            code: 'ltp.flow.orientation_missing',
            message: 'route_request observed before orientation frame',
            at: index,
            frameId,
          });
        }
        break;
      }
      case 'route_response': {
        routeResponded = true;
        const branches = countBranches(normalized.payload);
        if (!routeRequested) {
          addIssue(baseReport.errors, {
            code: 'ltp.flow.route_response_order',
            message: `route_response at position ${index} without route_request`,
            at: index,
            frameId,
          });
        }
        if (branches === 0) {
          addIssue(baseReport.errors, {
            code: 'ltp.payload.branches.missing',
            message: 'route_response must include at least two branches',
            at: index,
            frameId,
          });
        } else if (branches === 1) {
          addIssue(baseReport.warnings, {
            code: 'ltp.payload.branches.single',
            message: 'route_response includes only one branch; expected 2+',
            at: index,
            frameId,
          });
        }
        break;
      }
      case 'focus_snapshot': {
        focusSnapshotSeen = true;
        break;
      }
      default:
        break;
    }
  });

  if (!helloSeen) {
    addIssue(baseReport.errors, {
      code: 'ltp.frame.hello_missing',
      message: 'hello frame missing from capture',
    });
  }
  if (!heartbeatSeen) {
    addIssue(baseReport.errors, {
      code: 'ltp.frame.heartbeat_missing',
      message: 'heartbeat frame missing from capture',
    });
  }
  if (!orientationSeen) {
    addIssue(baseReport.errors, {
      code: 'ltp.frame.orientation_missing',
      message: 'orientation frame missing from capture',
    });
  }
  if (!routeRequested) {
    addIssue(baseReport.errors, {
      code: 'ltp.frame.route_request_missing',
      message: 'route_request frame missing from capture',
    });
  }
  if (!routeResponded) {
    addIssue(baseReport.errors, {
      code: 'ltp.frame.route_response_missing',
      message: 'route_response frame missing from capture',
    });
  }
  if (!focusSnapshotSeen) {
    addIssue(baseReport.warnings, {
      code: 'ltp.frame.focus_snapshot_missing',
      message: 'focus_snapshot frame missing; optional but recommended',
    });
  }

  if (baseReport.errors.length === 0 && helloSeen && orientationSeen && routeRequested && routeResponded) {
    baseReport.passed.push('required LTP frames observed in valid order');
  }

  baseReport.ok = baseReport.errors.length === 0;
  baseReport.status = statusFromReport(baseReport);
  const errorPenalty = baseReport.errors.length * 0.2;
  const warningPenalty = baseReport.warnings.length * 0.05;
  baseReport.score = clamp01(1 - errorPenalty - warningPenalty);

  if (baseReport.warnings.length > 0) {
    baseReport.hints.push('address warnings to improve conformance score');
  }

  if (baseReport.annotations && Object.keys(baseReport.annotations).length === 0) {
    baseReport.annotations = undefined;
  }

  return { report: baseReport, exitCode: deriveExitCode(baseReport, options.strict) };
};

export const writeReport = (targetPath: string, report: ConformanceReport | ConformanceReportBatch): void => {
  ensureDirectory(targetPath);
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  fs.writeFileSync(targetPath, serialized, 'utf-8');
};

export const verifyDirectoryReports = (
  dirPath: string,
  options: { strict?: boolean; now?: () => number } = {},
): { batch: ConformanceReportBatch; exitCode: number } => {
  const files = fs
    .readdirSync(dirPath)
    .filter((file) => file.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b));

  const cases: ConformanceCaseResult[] = files.map((file) => {
    const { value, inputHash } = readJsonFile(path.join(dirPath, file));
    const frames = normalizeFramesFromValue(value);
    const expected = expectedFromName(file);
    const { report } = verifyFrames(frames, {
      inputName: file,
      inputHash,
      strict: options.strict,
      now: options.now,
    });
    const baseStatus = statusFromReport(report);
    const actual: CaseStatus =
      baseStatus === 'FAIL'
        ? expected === 'FAIL'
          ? 'FAIL_EXPECTED'
          : 'FAIL_UNEXPECTED'
        : baseStatus;

    const matches =
      (expected === 'FAIL' && baseStatus === 'FAIL') ||
      (expected === 'WARN' && (baseStatus === 'WARN' || baseStatus === 'OK')) ||
      (expected === 'OK' && baseStatus === 'OK');

    return {
      fileName: file,
      expected,
      actual,
      matches,
      report,
    };
  });

  const unexpectedCount = cases.filter((c) => !c.matches).length;
  const passedCount = cases.filter((c) => c.actual === 'OK').length;
  const warnCount = cases.filter((c) => c.actual === 'WARN').length;
  const expectedFailCount = cases.filter((c) => c.actual === 'FAIL_EXPECTED').length;
  const failedCount = cases.filter((c) => c.actual === 'FAIL_UNEXPECTED').length;

  const positiveCases = cases.filter((c) => c.expected !== 'FAIL');
  const score = positiveCases.length
    ? Number(
        (
          positiveCases.reduce((total, current) => total + current.report.score, 0) /
          Math.max(1, positiveCases.length)
        ).toFixed(3),
      )
    : 1;

  const batch: ConformanceReportBatch = {
    v: '0.1',
    ok: unexpectedCount === 0,
    score,
    reports: cases.map((c) => c.report),
    cases,
    summary: {
      total: cases.length,
      passedCount,
      warnCount,
      failedCount,
      expectedFailCount,
      unexpectedCount,
    },
    meta: {
      timestamp: options.now ? options.now() : Date.now(),
      tool: 'ltp-conformance-kit',
      toolVersion: kitPackage.version,
      inputName: path.basename(dirPath),
    },
  };

  return { batch, exitCode: unexpectedCount > 0 ? 2 : 0 };
};
