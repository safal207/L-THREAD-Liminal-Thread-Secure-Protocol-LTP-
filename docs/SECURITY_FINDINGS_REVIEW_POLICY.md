# Security Findings Review Policy

**Effective:** 2026-05-23

## Overview

This document defines how LIMINAL handles security findings from SARIF reports in CI/CD pipelines. The policy balances operational speed with safety — findings are observed and logged, but critical issues block merges.

## Workflow

### Phase 1: Scan & Collect (Security Baseline)

- **Tool:** Gitleaks v8.24.3 (secrets detection)
- **Tools:** CodeQL (code analysis) 
- **Mode:** `exit-code=0` (audit, non-blocking)
- **Output:** SARIF reports uploaded to GitHub Security tab
- **Trigger:** On push to main, on all PRs, weekly schedule

### Phase 2: Analyze & Review (SARIF Review Job)

1. Security Baseline completes (success or findings)
2. SARIF Review workflow starts
3. Parse SARIF artifacts:
   - Count findings by severity
   - Extract rule IDs and locations
   - Detect patterns (repeated findings, new rule types)
4. Post summary to PR comment if applicable
5. Upload to GitHub Security tab (Code Scanning)

### Phase 3: Merge Policy

| Finding Level | Action | Blocks Merge? |
|---|---|---|
| 🔴 **Critical** (error) | Immediate review required, context added to PR | **YES** ✋ |
| 🟠 **High** (warning) | Logged, reviewer notified | Optional (maintainer discretion) |
| 🟡 **Medium** (note) | Tracked for future hardening | No |
| 🟢 **Low** | Archived | No |

## Critical (Blocking) Findings

Critical findings block merge and require:
1. Root cause analysis (documented in PR)
2. Remediation plan (linked issue or ticket)
3. Security approval (repo admin sign-off) OR
4. Exception reasoning (recorded in commit message)

**Examples of critical findings:**
- Exposed API keys, secrets, or credentials
- Hardcoded passwords
- Private key material
- Leaked personal data

## High-Level Findings

High findings are visible but non-blocking. Reviewers should:
1. Assess if the finding reflects real risk in the context
2. Decide: fix, defer, or false-positive suppress
3. Add `.gitleaksignore` entry if false positive (with justification)

**Examples:**
- Suspicious entropy patterns that might not be secrets
- Code patterns resembling credentials but being test fixtures
- Plausible but non-malicious data structures

## Review Frequency

| Scope | Frequency | Owner | Action |
|---|---|---|---|
| Real-time | On PR | Automated comment | Summary posted |
| Daily | End-of-day rollup | Security lead | Trend check |
| Weekly | Monday morning | Team | Pattern review |
| Monthly | 1st of month | Product owner | Risk assessment |

## Remediation Workflow

```
Finding Detected
    ↓
├─ [Critical] → Block merge → Create issue → Review & Fix → Resolve
├─ [High] → Visible → Triage → Fix or Defer → Track
└─ [Medium/Low] → Logged → Backlog review
```

## Automation & Dashboards

**Currently Tracked:**
- SARIF report generation (automatic)
- Critical finding detection (automatic)
- PR comment summary (automatic on PR)
- GitHub Security tab upload (automatic)

**Planned:**
- Weekly email digest of all findings
- Dashboard of finding trends over time
- Integration with issue tracking (auto-link to security issues)
- Metrics: MTTR (mean time to remediate), false positive ratio

## False Positive Handling

When a finding is a false positive:

1. **Document it** in PR or commit message
2. **Add to `.gitleaksignore`** if repeating across repo
   ```
   # .gitleaksignore
   commit-message-that-is-safe
   ```
3. **Comment in code** if the finding is about a specific line
   ```python
   # Note: This looks like a secret but is a test fixture with synthetic data
   test_api_key = "sk_test_0123456789abcdef"  # Not a real credential
   ```

## Governance

- **Policy owner:** safal207 (repository maintainer)
- **Review cadence:** Quarterly or after security incident
- **Escalation:** Report unhandled critical findings to GitHub security reporting

## Related Documents

- [Security Baseline Workflow](.github/workflows/security.yml)
- [SARIF Review Workflow](sarif-findings-review.yml)
- [Contributing Guide](CONTRIBUTING.md#security)
