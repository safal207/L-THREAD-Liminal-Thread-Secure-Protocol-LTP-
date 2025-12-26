# vCML exec Monitor (eBPF)

This directory contains the eBPF implementation for the `exec` causal boundary.

## Requirements

*   Linux Kernel 4.1+ (with BPF support)
*   Root privileges (`sudo`)
*   `bcc` (BPF Compiler Collection) python bindings
    *   Ubuntu/Debian: `sudo apt install bpfcc-tools python3-bpfcc`

## Usage

Run the monitor as root:

```bash
sudo python3 exec_monitor.py
```

## Output

The tool outputs JSONL records to stdout.

```json
{"id": "...", "action": "exec", ...}
```

## Causal Logic

*   **Boundary**: `sched_process_exec` tracepoint.
*   **Gap Detection**: Currently defaults to `parent_cause: null` to demonstrate the "causally questionable" state (Scenario B).
*   **Chain Restoration**: In a full system, `parent_cause` would be retrieved from the parent process's causal context.
