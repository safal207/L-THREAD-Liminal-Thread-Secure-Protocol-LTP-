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

declare const process: { exitCode?: number };
declare const require: any;
declare const module: any;
