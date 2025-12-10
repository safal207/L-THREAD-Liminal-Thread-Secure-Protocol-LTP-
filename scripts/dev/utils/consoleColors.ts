export type LinkHealth = "ok" | "warn" | "critical" | undefined;

const ANSI = {
  reset: "\u001b[0m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  red: "\u001b[31m",
};

export const ok = (text: string): string => `${ANSI.green}${text}${ANSI.reset}`;
export const warn = (text: string): string => `${ANSI.yellow}${text}${ANSI.reset}`;
export const crit = (text: string): string => `${ANSI.red}${text}${ANSI.reset}`;

export function colorByHealth(health: LinkHealth, text: string): string {
  if (health === "ok") return ok(text);
  if (health === "warn") return warn(text);
  if (health === "critical") return crit(text);
  return text;
}

export function formatHealthTag(health: LinkHealth): string {
  const tag =
    health === "ok" ? "[OK]" : health === "warn" ? "[WARN]" : health === "critical" ? "[CRIT]" : "[?]";
  return colorByHealth(health, tag);
}
