# LTP Canon Version

**Canon status:** FROZEN  
**Canon version:** 1.0  
**Effective date:** 2026-01-03

This file freezes the conceptual foundation of LTP (the Canon).
Canon is above tutorials, marketing, and implementation guidance.

## What “FROZEN” means

- Acts listed below are the normative conceptual foundation.
- Edits to existing Act files are **not allowed** except:
  - typo fixes,
  - formatting fixes,
  - dead-link fixes that do not change meaning.
- Any change to meaning MUST be done by adding a **new Act** (VIII+),
  and updating `docs/contracts/CANON_MAP.md` and `docs/contracts/REQUIREMENTS.md`
  as required.

## Acts included in Canon v1.0

- Act 0 — `docs/canon/00-why-ltp-exists.md`
- Act I — `docs/canon/01-orientation-over-prediction.md`
- Act II — `docs/canon/02-orientation-node.md`
- Act III — `docs/canon/03-admissible-futures.md`
- Act IV — `docs/canon/04-inspector.md`
- Act V — `docs/canon/05-living-thread.md`
- Act VI — `docs/canon/06-orientation-is-scale.md`
- Act VII — `docs/canon/07-what-ltp-will-never-become.md`

## Change process

All canon changes MUST follow the LCP process:

- `docs/contracts/LCP.md`

## Notes

- Guardrails are not canon and may evolve:
  - `docs/guardrails/*`
- Contracts are enforceable requirements and may evolve with versioning,
  but must remain consistent with canon:
  - `docs/contracts/REQUIREMENTS.md`
  - `docs/contracts/CANON_MAP.md`
