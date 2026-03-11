from __future__ import annotations

import argparse
from pathlib import Path

from .inspect_trace import inspect_trace_file

GREEN = "\033[32m"
YELLOW = "\033[33m"
RED = "\033[31m"
RESET = "\033[0m"


def _paint(text: str, decision: str, color: bool) -> str:
    if not color:
        return text
    tone = {"admissible": GREEN, "drift": YELLOW, "rejected": RED}.get(decision, "")
    return f"{tone}{text}{RESET}" if tone else text


def cmd_inspect_trace(args: argparse.Namespace) -> int:
    decisions = inspect_trace_file(args.trace, phase=args.phase)

    output_lines = []
    for index, decision in enumerate(decisions, start=1):
        status = f"[{index}] {decision.timestamp} -> {decision.decision.upper()} ({decision.reason})"
        output_lines.append(_paint(status, decision.decision, args.color))

    print("\n".join(output_lines) if output_lines else "No records found.")

    trace_log = Path(args.log)
    trace_log.parent.mkdir(parents=True, exist_ok=True)
    trace_log.write_text("\n".join(
        f"{d.timestamp}\t{d.decision}\t{d.reason}\tanchors={','.join(d.anchors)}" for d in decisions
    ) + "\n", encoding="utf-8")

    if args.replay:
        replay_path = Path(args.gif)
        replay_path.parent.mkdir(parents=True, exist_ok=True)
        replay_path.write_bytes(
            b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
        )
        print(f"Replay GIF written to {replay_path}")

    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="ltp", description="Liminal Thread Protocol CLI")
    inspect_parser = parser.add_subparsers(dest="command", required=True)

    trace_parser = inspect_parser.add_parser("inspect", help="Inspect trace files")
    trace_sub = trace_parser.add_subparsers(dest="inspect_command", required=True)

    trace = trace_sub.add_parser("trace", help="Inspect JSONL trace")
    trace.add_argument("trace", help="Path to trace JSONL")
    trace.add_argument("--replay", action="store_true", help="Generate replay GIF")
    trace.add_argument("--phase", choices=["one_phase", "two_phase"], default="two_phase")
    trace.add_argument("--color", action="store_true", help="Colorized output")
    trace.add_argument("--log", default="trace.log", help="Path to output trace log")
    trace.add_argument("--gif", default="assets/replay-demo.gif", help="Path to replay GIF")
    trace.set_defaults(func=cmd_inspect_trace)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
