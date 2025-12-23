# How an Auditor Reads an LTP Trace

## What is a Trace?
A **Trace** is a secure, chronological log of everything the AI System (or LTP Node) did during a session. It is not just a text log file; it is a mathematically linked chain of events (Frames) that proves the order and content of operations cannot be altered without detection.

## The Hash Chain (Tamper-Evidence)
Each entry in the trace contains a "hash" (digital fingerprint) of itself *plus* the hash of the previous entry.

```
[ Entry 1 ] -> Hash 1
      ^
      |
[ Entry 2 ] -> Hash(Entry 2 + Hash 1) = Hash 2
      ^
      |
[ Entry 3 ] -> Hash(Entry 3 + Hash 2) = Hash 3
```

If anyone tries to delete or change Entry 2, Hash 2 will change. This will break the link to Entry 3, and the verification tool will immediately report `TRACE INTEGRITY BROKEN`.

## Reading the Report
You do not need to check hashes manually. The `ltp inspect` tool does this for you.

Run the inspection command:
```bash
ltp inspect golden.auditlog.jsonl --compliance fintech
```

### The Verdict
Look for the **AUDIT SUMMARY** section at the bottom of the output (or in the JSON report).

*   **VERDICT: PASS**
    *   The trace is mathematically valid.
    *   The identity of the user is bound correctly.
    *   The system behaved deterministically (replayable).
    *   **Meaning:** You can trust this record.

*   **VERDICT: FAIL**
    *   **Trace Integrity Broken:** The file was modified after generation.
    *   **Identity Binding Violated:** The user identity in the trace does not match the claimed identity.
    *   **Replay Determinism Failed:** The system outputs do not match its inputs (possible non-deterministic behavior).
    *   **Meaning:** Do not trust this record. Investigate potential tampering or system malfunction.

## One-Command Verification
The entire verification process is automated.

**For Engineers/CI:**
```bash
ltp inspect <file> --compliance fintech --format json
```
Check if `"verdict": "PASS"` in the output.

**For Auditors:**
```bash
ltp inspect <file> --compliance fintech --export pdf
```
This generates a PDF report with a clear PASS/FAIL summary.
