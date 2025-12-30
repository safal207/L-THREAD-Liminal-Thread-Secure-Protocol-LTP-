import path from 'node:path';
import { describe, it } from 'vitest';
import { loadMatrix, runMatrixCase } from './matrix/runner';

const matrixPath = path.join(__dirname, 'TEST_MATRIX.json');
const { cases } = loadMatrix(matrixPath);
const runNice = process.env.LTP_INSPECT_NICE === '1';

const selected = cases.filter((testCase) =>
  testCase.tags?.includes('must') || (runNice && testCase.tags?.includes('nice')),
);

describe('ltp-inspect matrix', () => {
  selected.forEach((testCase) => {
    it(`${testCase.id} ${testCase.notes ?? ''}`.trim(), () => {
      runMatrixCase(testCase);
    });
  });
});
