/** Raised when two JSON object names decode to the same string. */
export class DuplicateJsonObjectNameError extends Error {
  constructor(
    readonly duplicateName: string,
    readonly objectPath: string,
  ) {
    super(
      `duplicate JSON object name ${JSON.stringify(duplicateName)} at ${
        objectPath || '/'
      }`,
    );
    this.name = 'DuplicateJsonObjectNameError';
  }
}

class JsonDuplicateScanError extends Error {}

function pointerChild(parent: string, segment: string): string {
  const escaped = segment.replace(/~/g, '~0').replace(/\//g, '~1');
  return `${parent}/${escaped}`;
}

class JsonDuplicateScanner {
  private index = 0;

  constructor(private readonly source: string) {}

  scan(): void {
    this.skipWhitespace();
    this.parseValue('');
    this.skipWhitespace();
    if (this.index !== this.source.length) {
      this.fail('unexpected trailing content');
    }
  }

  private parseValue(path: string): void {
    this.skipWhitespace();
    const token = this.source[this.index];
    if (token === '{') {
      this.parseObject(path);
      return;
    }
    if (token === '[') {
      this.parseArray(path);
      return;
    }
    if (token === '"') {
      this.parseString();
      return;
    }
    if (token === 't') {
      this.consumeLiteral('true');
      return;
    }
    if (token === 'f') {
      this.consumeLiteral('false');
      return;
    }
    if (token === 'n') {
      this.consumeLiteral('null');
      return;
    }
    this.parseNumber();
  }

  private parseObject(path: string): void {
    this.expect('{');
    this.skipWhitespace();
    if (this.consumeIf('}')) return;

    const names = new Set<string>();
    while (true) {
      this.skipWhitespace();
      if (this.source[this.index] !== '"') {
        this.fail('expected an object name');
      }
      const name = this.parseString();
      if (names.has(name)) {
        throw new DuplicateJsonObjectNameError(name, path || '/');
      }
      names.add(name);

      this.skipWhitespace();
      this.expect(':');
      this.parseValue(pointerChild(path, name));
      this.skipWhitespace();
      if (this.consumeIf('}')) return;
      this.expect(',');
    }
  }

  private parseArray(path: string): void {
    this.expect('[');
    this.skipWhitespace();
    if (this.consumeIf(']')) return;

    let itemIndex = 0;
    while (true) {
      this.parseValue(pointerChild(path, String(itemIndex)));
      itemIndex += 1;
      this.skipWhitespace();
      if (this.consumeIf(']')) return;
      this.expect(',');
    }
  }

  private parseString(): string {
    this.expect('"');
    let decoded = '';

    while (this.index < this.source.length) {
      const character = this.source[this.index];
      this.index += 1;

      if (character === '"') return decoded;
      if (character === '\\') {
        if (this.index >= this.source.length) {
          this.fail('unterminated escape sequence');
        }
        const escape = this.source[this.index];
        this.index += 1;
        switch (escape) {
          case '"':
          case '\\':
          case '/':
            decoded += escape;
            break;
          case 'b':
            decoded += '\b';
            break;
          case 'f':
            decoded += '\f';
            break;
          case 'n':
            decoded += '\n';
            break;
          case 'r':
            decoded += '\r';
            break;
          case 't':
            decoded += '\t';
            break;
          case 'u': {
            const hexadecimal = this.source.slice(this.index, this.index + 4);
            if (!/^[0-9a-fA-F]{4}$/.test(hexadecimal)) {
              this.fail('invalid Unicode escape');
            }
            decoded += String.fromCharCode(Number.parseInt(hexadecimal, 16));
            this.index += 4;
            break;
          }
          default:
            this.fail(`invalid escape sequence \\${escape}`);
        }
        continue;
      }

      if (character.charCodeAt(0) < 0x20) {
        this.fail('unescaped control character in string');
      }
      decoded += character;
    }

    this.fail('unterminated string');
  }

  private parseNumber(): void {
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(
      this.source.slice(this.index),
    );
    if (!match) this.fail('expected a JSON value');
    this.index += match[0].length;
  }

  private consumeLiteral(literal: string): void {
    if (!this.source.startsWith(literal, this.index)) {
      this.fail(`expected ${literal}`);
    }
    this.index += literal.length;
  }

  private skipWhitespace(): void {
    while (this.index < this.source.length) {
      const character = this.source[this.index];
      if (
        character !== ' ' &&
        character !== '\t' &&
        character !== '\n' &&
        character !== '\r'
      ) {
        return;
      }
      this.index += 1;
    }
  }

  private consumeIf(character: string): boolean {
    if (this.source[this.index] !== character) return false;
    this.index += 1;
    return true;
  }

  private expect(character: string): void {
    if (!this.consumeIf(character)) {
      this.fail(`expected ${JSON.stringify(character)}`);
    }
  }

  private fail(message: string): never {
    throw new JsonDuplicateScanError(`${message} at offset ${this.index}`);
  }
}

/**
 * Scans a syntactically valid JSON document and rejects duplicate object names,
 * including names that become equal only after JSON escape decoding.
 */
export function assertNoDuplicateJsonObjectNames(source: string): void {
  new JsonDuplicateScanner(source).scan();
}
