import { type FutureWeaveBranch, type MultiPathSuggestion } from "../routing/temporal-multipath";

export type FutureWeaveGraphOptions = {
  /**
   * Maximum number of branches to show (ordered by likelihood within role grouping).
   * Defaults to 3.
   */
  readonly maxBranches?: number;

  /**
   * Whether to include metadata hints (momentum/volatility/sectors).
   * Defaults to true.
   */
  readonly showMeta?: boolean;

  /**
   * Normalize likelihood percentages so they sum to 100.
   * Defaults to true.
   */
  readonly normalizeLikelihoods?: boolean;
};

const ROLE_ORDER = ["primary", "recovery", "explore"] as const;

function rolePriority(role: string): number {
  const idx = ROLE_ORDER.indexOf(role as (typeof ROLE_ORDER)[number]);
  return idx === -1 ? ROLE_ORDER.length + 1 : idx;
}

function sortBranches(branches: FutureWeaveBranch[]): FutureWeaveBranch[] {
  return [...branches].sort((a, b) => {
    const roleDiff = rolePriority(a.role) - rolePriority(b.role);
    if (roleDiff !== 0) return roleDiff;
    return b.likelihood - a.likelihood;
  });
}

function normalizePercents(branches: FutureWeaveBranch[], normalize: boolean): number[] {
  if (!branches.length) return [];
  if (!normalize) {
    return branches.map((branch) => Math.round(branch.likelihood * 100));
  }

  const totalWeight = branches.reduce((sum, branch) => sum + (branch.likelihood > 0 ? branch.likelihood : 0), 0) || 1;
  const rounded = branches.map((branch) => Math.round((branch.likelihood / totalWeight) * 100));
  const delta = 100 - rounded.reduce((sum, value) => sum + value, 0);
  rounded[rounded.length - 1] += delta;
  return rounded;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatBranchLine(params: {
  branch: FutureWeaveBranch;
  percent: number;
  roleWidth: number;
  showMeta: boolean;
}): string {
  const { branch, percent, roleWidth, showMeta } = params;
  const percentText = `${percent.toString().padStart(2, " ")}%`;
  const arrows = ">".repeat(clamp(Math.round((percent / 100) * 10), 1, 10));
  const roleText = `${branch.role}`.padEnd(roleWidth, " ");

  if (!showMeta) {
    return `${roleText} (${percentText})  ${arrows}`.trimEnd();
  }

  const sectors = branch.softenedSectors?.length ? branch.softenedSectors.join(",") : "???";
  const momentum = branch.momentumHint ?? "?";
  const volatility = branch.volatilityHint ?? "?";

  return `${roleText} (${percentText})  ${arrows}  mom: ${momentum}  vol: ${volatility}  sectors: ${sectors}`;
}

function ensureBranches(suggestion: MultiPathSuggestion): FutureWeaveBranch[] {
  if (suggestion.branches?.length) return suggestion.branches;
  const fallbackBranches: FutureWeaveBranch[] = [];
  if (suggestion.primaryPath) {
    fallbackBranches.push({
      id: suggestion.primaryPath.pathId,
      role: "primary",
      label: suggestion.primaryPath.label,
      likelihood: suggestion.primaryPath.overallLikelihood,
      softenedSectors: suggestion.primaryPath.nodes.map((node) => node.sectorId),
    });
  }
  suggestion.alternates?.forEach((alt) => {
    fallbackBranches.push({
      id: alt.pathId,
      role: alt.pathId === "recover" ? "recovery" : alt.pathId,
      label: alt.label,
      likelihood: alt.overallLikelihood,
      softenedSectors: alt.nodes.map((node) => node.sectorId),
    });
  });
  return fallbackBranches;
}

export function renderFutureWeaveGraph(
  suggestion: MultiPathSuggestion,
  options?: FutureWeaveGraphOptions,
): string {
  const { maxBranches = 3, showMeta = true, normalizeLikelihoods = true } = options ?? {};
  const branches = sortBranches(ensureBranches(suggestion));
  const percents = normalizePercents(branches, normalizeLikelihoods);
  const roleWidth = branches.reduce((width, branch) => Math.max(width, `${branch.role}`.length), 0);

  const visibleBranches = branches.slice(0, maxBranches);
  const visiblePercents = percents.slice(0, maxBranches);

  const lines = visibleBranches.map((branch, idx) =>
    formatBranchLine({ branch, percent: visiblePercents[idx] ?? 0, roleWidth, showMeta }),
  );

  const hiddenCount = branches.length - visibleBranches.length;
  if (hiddenCount > 0) {
    lines.push(`(+${hiddenCount} more branches hidden)`);
  }

  return lines.join("\n");
}
