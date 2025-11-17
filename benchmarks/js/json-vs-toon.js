/**
 * LTP JSON vs TOON Benchmark
 * 
 * Compares payload sizes and encoding/decoding performance
 * for JSON vs TOON encoding of large arrays
 */

const { simpleToonCodec } = require('../../examples/shared/simpleToonCodec');

// Generate test data: large array of similar objects
function generateAffectLogs(count) {
  return Array.from({ length: count }, (_, i) => ({
    t: i + 1,
    valence: Math.sin(i / 10) * 0.5,
    arousal: Math.cos(i / 10) * 0.5,
    energy: Math.random() * 0.5 + 0.5,
    focus: Math.random() * 0.3 + 0.7,
    timestamp: Date.now() + i * 1000,
  }));
}

function benchmark(name, fn, iterations = 100) {
  const times = [];
  
  // Warmup
  for (let i = 0; i < 10; i++) {
    fn();
  }
  
  // Benchmark
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    const end = performance.now();
    times.push(end - start);
  }
  
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  
  return { name, avg, min, max, total: times.reduce((a, b) => a + b, 0) };
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function runBenchmarks() {
  console.log('=== LTP JSON vs TOON Benchmark ===\n');
  
  const sizes = [10, 100, 1000, 10000];
  
  for (const size of sizes) {
    console.log(`\n--- Array size: ${size} objects ---`);
    
    const data = generateAffectLogs(size);
    
    // JSON encoding
    const jsonString = JSON.stringify(data);
    const jsonSize = new Blob([jsonString]).size;
    
    // TOON encoding
    const toonString = simpleToonCodec.encodeJsonToToon(data);
    const toonSize = new Blob([toonString]).size;
    
    // Size comparison
    const reduction = ((1 - toonSize / jsonSize) * 100).toFixed(2);
    
    console.log(`JSON size:  ${formatBytes(jsonSize)}`);
    console.log(`TOON size:  ${formatBytes(toonSize)}`);
    console.log(`Reduction:  ${reduction}%`);
    
    // Encoding performance
    const jsonEncodeBench = benchmark(
      'JSON encode',
      () => JSON.stringify(data),
      1000
    );
    
    const toonEncodeBench = benchmark(
      'TOON encode',
      () => simpleToonCodec.encodeJsonToToon(data),
      1000
    );
    
    console.log(`\nEncoding performance:`);
    console.log(`  JSON: avg ${jsonEncodeBench.avg.toFixed(3)}ms, min ${jsonEncodeBench.min.toFixed(3)}ms, max ${jsonEncodeBench.max.toFixed(3)}ms`);
    console.log(`  TOON: avg ${toonEncodeBench.avg.toFixed(3)}ms, min ${toonEncodeBench.min.toFixed(3)}ms, max ${toonEncodeBench.max.toFixed(3)}ms`);
    
    // Decoding performance (JSON only, TOON decode not fully implemented)
    const jsonDecodeBench = benchmark(
      'JSON decode',
      () => JSON.parse(jsonString),
      1000
    );
    
    console.log(`\nDecoding performance:`);
    console.log(`  JSON: avg ${jsonDecodeBench.avg.toFixed(3)}ms, min ${jsonDecodeBench.min.toFixed(3)}ms, max ${jsonDecodeBench.max.toFixed(3)}ms`);
  }
  
  console.log('\n=== Benchmark Complete ===');
  console.log('\nNote: TOON provides significant size reduction for large arrays');
  console.log('      of similar objects, making it ideal for affect logs,');
  console.log('      event batches, and telemetry data.');
}

// Run if executed directly
if (require.main === module) {
  runBenchmarks();
}

module.exports = { runBenchmarks, generateAffectLogs };

