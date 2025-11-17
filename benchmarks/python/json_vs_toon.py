"""
LTP JSON vs TOON Benchmark (Python)

Compares payload sizes and encoding/decoding performance
for JSON vs TOON encoding of large arrays
"""

import json
import time
import statistics
from typing import List, Dict, Any


def generate_affect_logs(count: int) -> List[Dict[str, Any]]:
    """Generate test data: large array of similar objects"""
    import math
    import random
    
    return [
        {
            't': i + 1,
            'valence': math.sin(i / 10) * 0.5,
            'arousal': math.cos(i / 10) * 0.5,
            'energy': random.random() * 0.5 + 0.5,
            'focus': random.random() * 0.3 + 0.7,
            'timestamp': int(time.time() * 1000) + i * 1000,
        }
        for i in range(count)
    ]


def format_bytes(bytes_size: int) -> str:
    """Format bytes to human-readable format"""
    if bytes_size == 0:
        return '0 B'
    
    for unit in ['B', 'KB', 'MB']:
        if bytes_size < 1024.0:
            return f'{bytes_size:.2f} {unit}'
        bytes_size /= 1024.0
    
    return f'{bytes_size:.2f} MB'


def benchmark(name: str, fn, iterations: int = 100) -> Dict[str, float]:
    """Run a benchmark and return statistics"""
    # Warmup
    for _ in range(10):
        fn()
    
    # Benchmark
    times = []
    for _ in range(iterations):
        start = time.perf_counter()
        fn()
        end = time.perf_counter()
        times.append((end - start) * 1000)  # Convert to milliseconds
    
    return {
        'name': name,
        'avg': statistics.mean(times),
        'min': min(times),
        'max': max(times),
        'total': sum(times),
    }


def simple_toon_encode(data: List[Dict[str, Any]]) -> str:
    """
    Simplified TOON encoding (for benchmark purposes)
    This is NOT a production-ready implementation
    """
    if not data or not isinstance(data, list):
        return json.dumps(data)
    
    if not isinstance(data[0], dict):
        return json.dumps(data)
    
    fields = list(data[0].keys())
    header = f"rows[{len(data)}]{{{','.join(fields)}}}:"
    lines = [
        "  " + ",".join(str(row.get(f, "")) for f in fields)
        for row in data
    ]
    return "\n".join([header] + lines)


def run_benchmarks():
    """Run JSON vs TOON benchmarks"""
    print("=== LTP JSON vs TOON Benchmark (Python) ===\n")
    
    sizes = [10, 100, 1000, 10000]
    
    for size in sizes:
        print(f"\n--- Array size: {size} objects ---")
        
        data = generate_affect_logs(size)
        
        # JSON encoding
        json_string = json.dumps(data)
        json_size = len(json_string.encode('utf-8'))
        
        # TOON encoding
        toon_string = simple_toon_encode(data)
        toon_size = len(toon_string.encode('utf-8'))
        
        # Size comparison
        reduction = (1 - toon_size / json_size) * 100
        
        print(f"JSON size:  {format_bytes(json_size)}")
        print(f"TOON size:  {format_bytes(toon_size)}")
        print(f"Reduction:  {reduction:.2f}%")
        
        # Encoding performance
        json_encode_bench = benchmark(
            'JSON encode',
            lambda: json.dumps(data),
            1000
        )
        
        toon_encode_bench = benchmark(
            'TOON encode',
            lambda: simple_toon_encode(data),
            1000
        )
        
        print(f"\nEncoding performance:")
        print(f"  JSON: avg {json_encode_bench['avg']:.3f}ms, "
              f"min {json_encode_bench['min']:.3f}ms, "
              f"max {json_encode_bench['max']:.3f}ms")
        print(f"  TOON: avg {toon_encode_bench['avg']:.3f}ms, "
              f"min {toon_encode_bench['min']:.3f}ms, "
              f"max {toon_encode_bench['max']:.3f}ms")
        
        # Decoding performance
        json_decode_bench = benchmark(
            'JSON decode',
            lambda: json.loads(json_string),
            1000
        )
        
        print(f"\nDecoding performance:")
        print(f"  JSON: avg {json_decode_bench['avg']:.3f}ms, "
              f"min {json_decode_bench['min']:.3f}ms, "
              f"max {json_decode_bench['max']:.3f}ms")
    
    print("\n=== Benchmark Complete ===")
    print("\nNote: TOON provides significant size reduction for large arrays")
    print("      of similar objects, making it ideal for affect logs,")
    print("      event batches, and telemetry data.")


if __name__ == '__main__':
    run_benchmarks()

