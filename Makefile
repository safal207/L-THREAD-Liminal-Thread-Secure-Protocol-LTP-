.PHONY: demo benchmark benchmark-report

demo:
	pnpm -w demo:all

benchmark:
	python scripts/run_benchmark.py

benchmark-report:
	python scripts/run_benchmark.py --markdown-out benchmark/RESULTS.md
