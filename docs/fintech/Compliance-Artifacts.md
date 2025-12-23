# Compliance Artifacts & Exports

LTP v0.1.x supports generating regulator-friendly compliance artifacts directly from the `@ltp/inspect` tool.

## Artifact Types

### 1. JSON (Machine-Readable)
The standard export format, suitable for automated processing and archiving.
- **Contract**: `ltp-inspect.v1.schema.json`
- **Use Case**: Archival, automated auditing systems.

### 2. JSON-LD (Semantic Web)
Linked Data export for integration with broader knowledge graphs and semantic compliance tools.
- **Context**: `https://w3id.org/ltp/v0.1/context.jsonld`
- **Use Case**: Interoperability with other compliance frameworks.

### 3. PDF (Human-Readable)
A simplified summary document designed for auditors and non-technical stakeholders.
- **Content**:
  - Verification metadata (Tool, Build, Time)
  - Hash Root of the trace
  - Compliance Status (Pass/Fail with details)
  - Identity & Continuity checks
  - Digital Signature verification status
- **Use Case**: "Paper trail", executive summary, auditor review.

## Usage

```bash
# Export all artifacts for a trace
ltp inspect trace.json \
  --compliance fintech \
  --export json \
  --export pdf

# Specific output path is auto-generated based on input filename,
# or can be redirected if using stdout (JSON only).
```

## Traceability

Every exported artifact includes the **Hash Root** of the original trace. This cryptographically binds the report to the specific execution trace. If the trace file is modified, its hash changes, and the report is no longer valid for that file.

## Digital Signatures

If the trace contains cryptographic signatures (`signature` field in trace entries), the export tool verifies:
1. Presence of signatures.
2. Consistency of the hash chain covered by signatures.
3. List of Key IDs used.

*Note: Full cryptographic verification of signatures requires access to the corresponding public keys, which are managed outside the trace file itself (see Key Rotation).*
