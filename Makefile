.PHONY: demo benchmark-report

demo:
	pnpm -w demo:all

benchmark-report:
	python scripts/generate_benchmark_results.py
