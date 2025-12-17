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
  const fs: { existsSync: typeof existsSync; readFileSync: typeof readFileSync };
  export { existsSync, readFileSync };
  export default fs;
}

declare module 'path' {
  function resolve(...segments: string[]): string;
  const path: { resolve: typeof resolve };
  export { resolve };
  export default path;
}

declare module 'node:path' {
  function resolve(...segments: string[]): string;
  const path: { resolve: typeof resolve };
  export { resolve };
  export default path;
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
