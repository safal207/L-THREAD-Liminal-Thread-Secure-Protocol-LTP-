# LTP Release Engineering

## Release trust model

LTP release candidates are built from an exact source commit in two isolated clean source trees. JavaScript, Python, Rust and Elixir use their native packaging tools, but release identity is defined by the generated manifest and canonical package-content digests rather than by a handwritten checklist.

The workflow never publishes packages. Pull-request code receives only read access. GitHub OIDC and attestation permissions exist in a separate job that runs only after a successful build from protected `main`—on a `push` produced by a merged change or through `workflow_dispatch` on `main`.

## Version source

`tests/production/readiness-baseline.json` is the release-version source. The release gate extracts and compares:

- `sdk/js/package.json`;
- `sdk/python/setup.py`;
- `sdk/rust/ltp-client/Cargo.toml`;
- `sdk/elixir/mix.exs`.

Any mismatch fails before package creation. The generated manifest records the release version, protocol core version and every SDK declaration. Python package artifacts use the equivalent PEP 440 prerelease form (`0.6.0a3`) for repository version `0.6.0-alpha.3`; that normalization is visible in artifact names and is not treated as hidden version drift.

## Native package dry-runs

The RC workflow builds without publishing:

- npm package tarball through `npm pack`;
- Python wheel and sdist through `python -m build`, validated by `twine check`;
- Rust crate through `cargo package`;
- Elixir package through `mix hex.build`.

A deterministic source archive is created before package managers produce generated files.

## Reproducibility

Two clean source trees are extracted from the same Git commit. Both builds use the same:

- source SHA;
- `SOURCE_DATE_EPOCH` derived from the commit timestamp;
- UTC locale/timezone;
- deterministic Python hash seed;
- disabled Cargo incremental compilation.

Every artifact receives:

- raw SHA-256;
- canonical-content SHA-256 based on sorted archive paths and bytes.

Canonical-content mismatch is a release failure. A raw-container mismatch with identical canonical content is retained as an explicit reproducible-build exception in `reproducibility.json`; it may not be silently ignored.

## SBOM and manifest

Each SDK receives a CycloneDX 1.5 SBOM generated from its package-manager dependency graph. The release manifest contains:

- source commit and source-date epoch;
- workflow run URL;
- protocol and SDK versions;
- package, source and SBOM digests;
- credential/signing policy;
- manifest self-digest.

## Verification

After downloading `wp7-release-candidate-evidence`:

```bash
cd rc
sha256sum --check checksums.sha256
openssl pkeyutl -verify -rawin -pubin \
  -inkey checksums.pub \
  -in checksums.sha256 \
  -sigfile checksums.sha256.sig
```

The signature in PR/RC dry-runs uses an ephemeral key generated inside the job and proves that signing and verification paths work without storing a private key. It is not the stable-release trust anchor.

For a trusted RC build from protected `main`, GitHub creates keyless build provenance for `ltp-rc-evidence-bundle.tar.gz`. Verify it with:

```bash
gh attestation verify ltp-rc-evidence-bundle.tar.gz --repo safal207/L-THREAD-Liminal-Thread-Secure-Protocol-LTP-
```

## Promotion

1. Merge an exact-head green WP7 change to protected `main`.
2. Let the resulting `push` build and attest the RC bundle, or rerun **WP7 Reproducible Release Candidate** manually from `main`.
3. Verify the GitHub attestation and release manifest.
4. Confirm required security, E2E, versioning and fuzz gates remain green.
5. Attach the RC bundle, SBOMs and provenance to a GitHub prerelease.
6. Do not publish a stable `v1.0.0` while WP4 capacity limits, WP8 operations/SLOs or WP9 audit contain blocking gaps.
7. Registry publication, when enabled in a later controlled workflow, must use short-lived trusted publishing/OIDC rather than repository secrets exposed to PR code.

## Rollback and yank

If an RC is defective:

- mark the GitHub prerelease as withdrawn;
- preserve the original evidence and record the reason;
- create a new source commit and RC rather than replacing artifacts under the same version;
- never rewrite tags or checksums.

If a registry artifact has been published:

- npm: deprecate the affected version; unpublish only within policy and only when necessary;
- PyPI: yank the release while retaining its audit trail;
- crates.io: yank the crate version;
- Hex: retire the package version with the appropriate reason.

A corrected package receives a new SemVer version. Consumers must be able to distinguish the withdrawn and corrected artifacts cryptographically.
