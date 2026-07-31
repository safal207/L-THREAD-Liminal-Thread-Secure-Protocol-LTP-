import { NegotiationInput } from "./negotiation-types";
import { negotiate } from "./negotiation";
import { Registry } from "./registry-types";

export const MATRIX_SCHEMA = 1;

export interface MatrixFixture {
  id: string;
  input: NegotiationInput;
  expected: {
    ok: boolean;
    selected_version?: string;
    reason_code?: string;
    resume_verdict?: string;
  };
}

export interface MatrixRow {
  case_id: string;
  client_versions: string[];
  minimum_version: string | null;
  verdict: "PASS" | "FAIL";
  selected_version: string | null;
  reason_code: string;
  resume_verdict: string | null;
}

export function buildMatrix(registry: Registry, fixtures: MatrixFixture[]): MatrixRow[] {
  return fixtures.map((fixture) => {
    const result = negotiate(registry, fixture.input);
    const selected = result.ok ? result.selected_version : null;
    const reason = result.reason_code;
    const resume = result.ok ? result.resume?.verdict ?? null : null;
    const pass =
      result.ok === fixture.expected.ok &&
      (fixture.expected.selected_version === undefined || selected === fixture.expected.selected_version) &&
      (fixture.expected.reason_code === undefined || reason === fixture.expected.reason_code) &&
      (fixture.expected.resume_verdict === undefined || resume === fixture.expected.resume_verdict);
    return {
      case_id: fixture.id,
      client_versions: fixture.input.client_versions,
      minimum_version: fixture.input.minimum_version ?? null,
      verdict: pass ? "PASS" : "FAIL",
      selected_version: selected,
      reason_code: reason,
      resume_verdict: resume,
    };
  });
}

export function renderMatrixMarkdown(rows: MatrixRow[]): string {
  const lines = [
    "# Generated LTP Version Compatibility Matrix",
    "",
    "> Generated from `fixtures/versioning/negotiation-cases.json`; do not edit by hand.",
    "",
    "| Case | Client versions | Floor | Result | Selected | Reason | Resume |",
    "|---|---|---|---|---|---|---|",
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.case_id} | ${row.client_versions.join(", ")} | ${row.minimum_version ?? "—"} | ${row.verdict} | ${row.selected_version ?? "—"} | ${row.reason_code} | ${row.resume_verdict ?? "—"} |`,
    );
  }
  return `${lines.join("\n")}\n`;
}
