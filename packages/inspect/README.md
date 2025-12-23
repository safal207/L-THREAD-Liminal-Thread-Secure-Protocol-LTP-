# @ltp/inspect

`@ltp/inspect` ships a prebuilt JavaScript CLI so it can run without the monorepo or TypeScript toolchain.

## Usage (published package)

- Install globally or as a local dev dependency: `npm i -g @ltp/inspect` (or `pnpm add -g @ltp/inspect`).
- The executable is `ltp`. It runs directly from `dist/inspect.js`.
- If the CLI is invoked without a build present, it fails with exit code `4` and a message instructing you to run `pnpm -C packages/inspect build`.

## Development (monorepo)

- To iterate on the TypeScript source without rebuilding, run the dev launcher: `pnpm -w ltp:inspect -- --help`.
- The dev launcher lives at `packages/inspect/bin/ltp-dev.js` and uses `ts-node` to execute `tools/ltp-inspect/inspect.ts` inside the monorepo.
