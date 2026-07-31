export const WP5_VERSIONING_PROFILE = "org.ltp.protocol.versioning.v1";
export const VERSION_ORDER = ["0.3.0", "0.6.0", "1.0.0"];
export function versionRank(value: string): number {
  return VERSION_ORDER.indexOf(value);
}
