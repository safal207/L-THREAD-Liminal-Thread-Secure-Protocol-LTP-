declare module 'crypto' {
  interface Hash {
    update(data: string | ArrayBufferView): Hash;
    digest(encoding: 'hex'): string;
  }

  function createHash(algorithm: string): Hash;

  export { createHash };
}

declare module 'node:assert/strict' {
  const assert: any;
  export default assert;
}

declare module 'fs' {
  function existsSync(path: string): boolean;
  function readFileSync(path: string, encoding: string): string;
  function mkdtempSync(prefix: string): string;
  function openSync(path: string, flags: string): number;
  function closeSync(fd: number): void;
  function rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
  const fs: {
    existsSync: typeof existsSync;
    readFileSync: typeof readFileSync;
    mkdtempSync: typeof mkdtempSync;
    openSync: typeof openSync;
    closeSync: typeof closeSync;
    rmSync: typeof rmSync;
  };
  export { existsSync, readFileSync, mkdtempSync, openSync, closeSync, rmSync };
  export default fs;
}

declare module 'path' {
  function resolve(...segments: string[]): string;
  function join(...segments: string[]): string;
  const path: { resolve: typeof resolve; join: typeof join };
  export { resolve, join };
  export default path;
}

declare module 'node:path' {
  function resolve(...segments: string[]): string;
  function join(...segments: string[]): string;
  const path: { resolve: typeof resolve; join: typeof join };
  export { resolve, join };
  export default path;
}

declare module 'node:fs' {
  function existsSync(path: string): boolean;
  function readFileSync(path: string, encoding: string): string;
  function mkdtempSync(prefix: string): string;
  function openSync(path: string, flags: string): number;
  function closeSync(fd: number): void;
  function rmSync(path: string, options?: { recursive?: boolean; force?: boolean }): void;
  const fs: {
    existsSync: typeof existsSync;
    readFileSync: typeof readFileSync;
    mkdtempSync: typeof mkdtempSync;
    openSync: typeof openSync;
    closeSync: typeof closeSync;
    rmSync: typeof rmSync;
  };
  export { existsSync, readFileSync, mkdtempSync, openSync, closeSync, rmSync };
  export default fs;
}

declare module 'node:os' {
  function tmpdir(): string;
  const os: { tmpdir: typeof tmpdir };
  export { tmpdir };
  export default os;
}

declare module 'node:child_process' {
  interface SpawnSyncReturns<T> {
    status: number | null;
    stdout: T;
    stderr: T;
  }

  function spawnSync(
    command: string,
    args?: string[],
    options?: { encoding?: string; stdio?: any },
  ): SpawnSyncReturns<string>;
  export { spawnSync };
}

declare const __dirname: string;
declare const process: { argv: string[]; exitCode?: number };
declare const require: any;
declare const module: any;
