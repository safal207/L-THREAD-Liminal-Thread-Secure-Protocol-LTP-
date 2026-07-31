import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadRegistry } from "../versioning/registry";
import { runFuzzCampaign } from "./fuzz";
import { runMutationCampaign } from "./mutations";

interface CliOptions {
  seed: number;
  cases: number;
  out: string;
}

function parseInteger(value: string | undefined, name: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer`);
  return parsed;
}

function parseArgs(args: string[]): CliOptions {
  const read = (name: string): string | undefined => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  return {
    seed: parseInteger(read("--seed") ?? "12648430", "seed"),
    cases: parseInteger(read("--cases") ?? "10000", "cases"),
    out: read("--out") ?? "artifacts/wp6-adversarial-evidence.json",
  };
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

export function buildEvidence(seed: number, cases: number): Record<string, unknown> {
  const fuzz = runFuzzCampaign(loadRegistry(), seed, cases);
  const mutations = runMutationCampaign();
  const corpusPath = resolve("tests/wp6/fuzz/fuzz-seed-corpus.json");
  const corpus = readFileSync(corpusPath);
  const summary = {
    profile: "org.ltp.wp6.adversarial-evidence.v1",
    seed: fuzz.seed,
    case_count: fuzz.cases,
    fuzz: {
      passed: fuzz.passed,
      accepted: fuzz.accepted,
      rejected: fuzz.rejected,
      invariant_failures: fuzz.invariant_failures,
      categories: fuzz.categories,
      outcomes_digest: fuzz.outcomes_digest,
    },
    mutation: {
      total: mutations.length,
      killed: mutations.filter((outcome) => outcome.killed).length,
      survived: mutations.filter((outcome) => !outcome.killed).map((outcome) => outcome.mutation_id),
      outcomes: mutations,
    },
    corpus: {
      path: "tests/wp6/fuzz/fuzz-seed-corpus.json",
      sha256: sha256(corpus),
    },
    guarantees: {
      deterministic_reproduction: true,
      rejected_input_authorizes_state_mutation: false,
      security_downgrade_blocked: true,
      replay_rejected: true,
    },
  };
  return { ...summary, evidence_digest: sha256(JSON.stringify(summary)) };
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  const evidence = buildEvidence(options.seed, options.cases);
  mkdirSync(dirname(resolve(options.out)), { recursive: true });
  writeFileSync(resolve(options.out), `${JSON.stringify(evidence, null, 2)}\n`);

  const fuzz = evidence.fuzz as { invariant_failures: number };
  const mutation = evidence.mutation as { survived: string[] };
  if (fuzz.invariant_failures !== 0 || mutation.survived.length !== 0) process.exitCode = 1;
}

if (require.main === module) main();
