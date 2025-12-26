#!/usr/bin/python3
#
# vCML exec monitor
# Capture process execution events and emit causal records.
#
# USAGE: sudo python3 exec_monitor.py
#

from bcc import BPF
from bcc.utils import printb
import json
import time
import uuid
import os
import sys

# Define BPF program
bpf_text = """
#include <uapi/linux/ptrace.h>
#include <linux/sched.h>
#include <linux/fs.h>

struct data_t {
    u32 pid;
    u32 ppid;
    u32 uid;
    char comm[TASK_COMM_LEN];
    char filename[256];
};

BPF_PERF_OUTPUT(events);

// Tracepoint for sched_process_exec
// This is triggered after a successful exec()
TRACEPOINT_PROBE(sched, sched_process_exec) {
    struct data_t data = {};
    struct task_struct *task;

    data.pid = bpf_get_current_pid_tgid() >> 32;

    task = (struct task_struct *)bpf_get_current_task();
    data.ppid = task->real_parent->tgid;
    data.uid = bpf_get_current_uid_gid();

    bpf_get_current_comm(&data.comm, sizeof(data.comm));

    // The filename is available in the tracepoint args
    // args->filename is a user-space pointer or kernel pointer depending on context?
    // In sched_process_exec, filename is verified.
    // TP_PROTO(struct task_struct *p, pid_t old_pid, struct linux_binprm *bprm)
    // Actually args for sched_process_exec are:
    // filename = (char *)bprm->filename;
    // But bcc defines args structure for us.
    // Let's use the explicit argument name from /sys/kernel/debug/tracing/events/sched/sched_process_exec/format
    // field:__data_loc char[] filename;	offset:8;	size:4;	signed:0;

    // BCC helps us read it:
    bpf_probe_read_str(&data.filename, sizeof(data.filename), args->filename);

    events.perf_submit(args, &data, sizeof(data));
    return 0;
}
"""

def print_event(cpu, data, size):
    event = b["events"].event(data)

    # Generate causal record
    record = {
        "id": str(uuid.uuid4()),
        "timestamp": time.time_ns(),
        "actor": {
            "pid": event.pid,
            "ppid": event.ppid,
            "uid": event.uid
        },
        "action": "exec",
        "object": event.filename.decode('utf-8', 'replace'),
        "permitted_by": "parent_process_context",
        "parent_cause": None  # Default to null (Gap) for this minimal implementation
    }

    # JSONL output
    print(json.dumps(record))
    sys.stdout.flush()

if __name__ == "__main__":
    # Check permissions
    if os.geteuid() != 0:
        print("ERROR: This script requires root privileges to load eBPF programs.", file=sys.stderr)
        # We don't exit here to allow syntax checking, but real execution will fail.
        # But for 'stub' purposes, we let it try.

    try:
        # Initialize BPF
        b = BPF(text=bpf_text)

        # Open perf buffer
        b["events"].open_perf_buffer(print_event)

        # Poll
        while True:
            try:
                b.perf_buffer_poll()
            except KeyboardInterrupt:
                break
    except Exception as e:
        print(f"ERROR: Failed to load BPF program: {e}", file=sys.stderr)
        sys.exit(1)
