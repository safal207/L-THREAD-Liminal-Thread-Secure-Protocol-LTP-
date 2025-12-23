# Security Policy

## Supported Versions
LTP is evolving. Only versions marked as Frozen Core are expected to remain stable.

## Reporting a Vulnerability
Please do not open public issues for security reports.

Preferred: open a private security advisory on GitHub.
If private reporting is not available, contact the maintainers listed in MAINTAINERS.md.

Include:
- affected component / file path
- steps to reproduce
- impact assessment (DoS, hijack, data leak, etc.)
- suggested mitigation (if known)

## Security Baseline
Implementations exposed to untrusted networks are expected to meet:
- handshake authentication
- per-connection rate limiting
- sampled logging (anti log-flood)
- idle session TTL + GC
- TLS termination via reverse proxy (recommended for v0.1)

See: docs/security/Security-Baseline-v0.1.md
