// Minimal Node.js type shims to support builds without @types/node

declare var require: {
  (id: string): any;
  main?: unknown;
};

declare var module: {
  exports: unknown;
};

declare namespace NodeJS {
  interface Process {
    exitCode?: number;
    env: Record<string, string | undefined>;
  }
}

declare var process: NodeJS.Process;

declare var Buffer: typeof import('buffer').Buffer;

declare module 'node:assert/strict' {
  import assert from 'assert';
  export = assert;
}
