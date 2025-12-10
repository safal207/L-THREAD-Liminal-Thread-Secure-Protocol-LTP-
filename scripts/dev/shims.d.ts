declare module "ws" {
  export default class WebSocket {
    constructor(address: string);
    on(event: string, listener: (...args: any[]) => void): void;
    send(data: any): void;
    close(): void;
  }
}

declare module "assert" {
  function assert(value: unknown, message?: string): asserts value;
  namespace assert {
    function strictEqual<T>(actual: T, expected: T, message?: string): void;
  }
  export = assert;
}

declare namespace NodeJS {
  type Timeout = number;
}

declare const process: {
  env: Record<string, string | undefined>;
  argv: string[];
  exit: (code?: number) => void;
  on: (event: string, listener: (...args: any[]) => void) => void;
};

declare interface NodeModule {
  exports: any;
}

declare interface NodeRequire {
  (id: string): any;
  main?: NodeModule;
}

declare const require: NodeRequire;
declare const module: NodeModule;
