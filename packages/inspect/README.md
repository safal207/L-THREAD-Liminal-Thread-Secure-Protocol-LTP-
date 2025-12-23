# @ltp/inspect

> The canonical inspector for Liminal Thread Protocol (LTP) traces.

Verifies orientation continuity, drift, and branching without running a model.

## Installation

```bash
npm install -g @ltp/inspect
```

## Usage

Inspect a trace file:

```bash
ltp inspect path/to/trace.json
```

Options:
- `--format <human|json>`: Output format (default: human)
- `--strict`: Exit with error code if violations are found
- `--verbose`: Show detailed debug info

## About

This tool is part of the [LTP](https://github.com/liminal/ltp) ecosystem.
It provides a deterministic view of the "Control Plane" of AI systems.
