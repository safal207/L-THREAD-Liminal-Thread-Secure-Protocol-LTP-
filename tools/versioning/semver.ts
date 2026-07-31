export const SEMVER_COMPONENTS = 3;

export function parseVersion(value: string): number[] {
  const parts = value.split(".");
  if (parts.length !== SEMVER_COMPONENTS) throw new Error("INVALID_VERSION");
  const numbers = parts.map((part) => Number(part));
  if (numbers.some((part) => !Number.isInteger(part) || part < 0)) {
    throw new Error("INVALID_VERSION");
  }
  return numbers;
}

export function compareVersions(left: string, right: string): number {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < SEMVER_COMPONENTS; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

export function bumpKind(from: string, to: string): "patch" | "minor" | "major" {
  const a = parseVersion(from);
  const b = parseVersion(to);
  if (compareVersions(to, from) <= 0) throw new Error("PROTOCOL_VERSION_NOT_INCREMENTED");
  if (b[0] > a[0]) return "major";
  if (b[1] > a[1]) return "minor";
  return "patch";
}
