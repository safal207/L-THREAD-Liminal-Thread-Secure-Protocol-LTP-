# Process Execution (`exec`) Causal Boundary

## Overview

The `exec` system call family represents a critical causal boundary in the operating system. It is the point where a process replaces its entire memory space with a new program image.

## Why `exec` is a Causal Boundary

*   **Irreversibility**: Once `exec` succeeds, the previous program state is gone. The process identity (PID) persists, but the *agent* controlling it changes.
*   **Intent Manifestation**: The call to `exec` is the explicit manifestation of the parent's intent to launch a new agent.
*   **Context Handover**: This is the moment where causal context must be transferred from the parent to the child (or dropped).

## v0.3 Implementation Scope

In v0.3, we implement a **passive observer** for this boundary.

*   **Event**: `sched_process_exec` (or `sys_enter_execve` equivalent).
*   **Action**: Record the event in strict vCML format.
*   **Verification**:
    *   Check for `parent_cause`.
    *   If `parent_cause` is missing, record `null` (Causal Gap).
    *   If `parent_cause` is present, record the UUID (Causal Chain).

## Security & Policy

This implementation explicitly **excludes**:
*   Blocking or denying execution.
*   Policy enforcement.
*   Security checks.

The goal is purely to observe causal continuity (or lack thereof).
