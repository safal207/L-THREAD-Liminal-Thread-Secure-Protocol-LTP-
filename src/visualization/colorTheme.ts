export const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  blue: "\x1b[38;5;39m",
  green: "\x1b[38;5;46m",
  cyan: "\x1b[38;5;51m",
  red: "\x1b[38;5;196m",
  magenta: "\x1b[38;5;171m",
  gray: "\x1b[38;5;244m",
} as const;

export type ColorName = keyof typeof ANSI;

export function applyColor(text: string, color: ColorName | undefined, bold = false): string {
  if (!color) return text;
  const codes = bold ? `${ANSI.bold}${ANSI[color]}` : ANSI[color];
  return `${codes}${text}${ANSI.reset}`;
}

export const ZONE_COLORS: Record<string, ColorName> = {
  calm: "blue",
  growth: "green",
  recovery: "cyan",
  storm: "red",
  shift: "magenta",
};
