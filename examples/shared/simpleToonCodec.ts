/**
 * Extremely simplified TOON codec placeholder for LTP v0.3 examples.
 * 
 * ⚠️ WARNING: This is NOT a production-ready TOON implementation.
 * This is a minimal stub for demonstration purposes only.
 * 
 * For production use, integrate a proper TOON library or implement
 * a full TOON codec according to the TOON specification.
 */

import { LtpCodec } from '../../sdk/js/src/types';

/**
 * Simple TOON codec implementation (stub/placeholder)
 * 
 * This codec provides a basic encoding for arrays of objects,
 * converting them to a simplified TOON-like format:
 * 
 * ```
 * rows[N]{field1,field2,...}:
 *   value1,value2,...
 *   value1,value2,...
 * ```
 * 
 * This is NOT a complete TOON implementation and should only
 * be used for examples and testing.
 */
export const simpleToonCodec: LtpCodec = {
  /**
   * Encode JSON array to simplified TOON string
   * @param value JSON value (typically array of objects)
   * @returns TOON-formatted string
   */
  encodeJsonToToon(value: unknown): string {
    // If not an array or empty, fall back to JSON
    if (!Array.isArray(value) || value.length === 0) {
      return JSON.stringify(value);
    }

    // Check if first element is an object
    const firstElement = value[0];
    if (typeof firstElement !== 'object' || firstElement === null || Array.isArray(firstElement)) {
      return JSON.stringify(value);
    }

    // Extract field names from first object
    const fields = Object.keys(firstElement);
    if (fields.length === 0) {
      return JSON.stringify(value);
    }

    // Build TOON header: rows[N]{field1,field2,...}:
    const header = `rows[${value.length}]{${fields.join(',')}}:`;

    // Build TOON rows: each row is "  value1,value2,..."
    const lines = value.map((row) => {
      const values = fields.map((field) => {
        const val = (row as Record<string, unknown>)[field];
        // Convert to string, handle null/undefined
        if (val === null || val === undefined) {
          return '';
        }
        return String(val);
      });
      return `  ${values.join(',')}`;
    });

    return [header, ...lines].join('\n');
  },

  /**
   * Decode TOON string to JSON (placeholder - not fully implemented)
   * @param toon TOON-formatted string
   * @returns JSON value (currently returns raw string as placeholder)
   */
  decodeToonToJson(toon: string): unknown {
    // Placeholder: for v0.3 examples, decoding is not fully implemented.
    // In production, this should parse the TOON string and return
    // the equivalent JSON structure.
    // 
    // For now, return the raw string so applications can handle it
    // or use a proper TOON decoder library.
    return toon;
  },
};


