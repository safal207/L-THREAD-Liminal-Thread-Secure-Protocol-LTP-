export class DeterministicRng {
  private state: number;

  constructor(seed: number) {
    this.state = (seed >>> 0) || 0x9e3779b9;
  }

  nextU32(): number {
    let value = this.state;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.state = value >>> 0;
    return this.state;
  }

  int(maxExclusive: number): number {
    if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
      throw new Error("maxExclusive must be a positive integer");
    }
    return this.nextU32() % maxExclusive;
  }

  pick<T>(values: readonly T[]): T {
    if (values.length === 0) throw new Error("cannot pick from an empty collection");
    return values[this.int(values.length)];
  }

  bytes(length: number): Uint8Array {
    const output = new Uint8Array(length);
    for (let index = 0; index < length; index += 1) output[index] = this.int(256);
    return output;
  }

  token(prefix: string): string {
    return `${prefix}-${this.nextU32().toString(16).padStart(8, "0")}`;
  }
}
