/**
 * Extremely simplified TOON codec placeholder.
 * This is NOT a production-ready implementation.
 */
const simpleToonCodec = {
  encodeJsonToToon(value) {
    if (!Array.isArray(value) || value.length === 0 || typeof value[0] !== 'object') {
      return JSON.stringify(value);
    }
    const rows = value;
    const fields = Object.keys(rows[0]);
    const header = `rows[${rows.length}]{${fields.join(',')}}:`;
    const lines = rows.map((row) => `  ${fields.map((f) => String(row[f] ?? '')).join(',')}`);
    return [header, ...lines].join('\n');
  },
  decodeToonToJson(toon) {
    // Placeholder for future real parsing; for now return the raw TOON string.
    return toon;
  },
};

module.exports = { simpleToonCodec };
