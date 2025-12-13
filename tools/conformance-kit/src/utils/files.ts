import { createHash } from 'crypto';
import fs from 'node:fs';
import path from 'node:path';
import { LTPFrameShape } from '../types';

export const readJsonFile = (filePath: string): { raw: string; value: unknown; inputHash: string } => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const hash = createHash('sha256').update(content).digest('hex');
  const parsed = JSON.parse(content) as unknown;
  return { raw: content, value: parsed, inputHash: hash };
};

export const ensureDirectory = (targetPath: string): void => {
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });
};

export const normalizeFramesFromValue = (value: unknown): LTPFrameShape[] | null => {
  if (Array.isArray(value)) {
    return value as LTPFrameShape[];
  }
  if (value && typeof value === 'object' && Array.isArray((value as { frames?: unknown }).frames)) {
    return (value as { frames: unknown[] }).frames as LTPFrameShape[];
  }
  return null;
};
