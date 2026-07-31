#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="${1:?usage: build_rc.sh <output-dir> <source-sha> <source-date-epoch> [workflow-run]}"
SOURCE_SHA="${2:?source SHA is required}"
SOURCE_EPOCH="${3:?source date epoch is required}"
WORKFLOW_RUN="${4:-}"

OUT="$(python -c 'import os,sys; print(os.path.abspath(sys.argv[1]))' "$OUT")"
rm -rf "$OUT"
mkdir -p "$OUT"/{packages/{javascript,python,rust,elixir},sbom,source,validation}
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

export SOURCE_DATE_EPOCH="$SOURCE_EPOCH"
export TZ=UTC
export LC_ALL=C.UTF-8
export LANG=C.UTF-8
export PYTHONHASHSEED=0
export CARGO_INCREMENTAL=0

python "$ROOT/tools/release/versions.py" --out "$OUT/versions.json"
RELEASE_VERSION="$(python -c 'import json,sys; print(json.load(open(sys.argv[1]))["release_version"])' "$OUT/versions.json")"

# JavaScript / npm dry-run package.
corepack enable
corepack prepare pnpm@9.15.0 --activate
(cd "$ROOT" && pnpm install --frozen-lockfile)
(cd "$ROOT/sdk/js" && pnpm build)
(cd "$ROOT/sdk/js" && npm pack --silent --pack-destination "$OUT/packages/javascript")
(cd "$ROOT/sdk/js" && npm pack --dry-run --json > "$OUT/validation/npm-pack-dry-run.json")
(cd "$ROOT/sdk/js" && pnpm list --prod --depth Infinity --json > "$TMP/javascript-deps.json")

# Python / PyPI dry-run artifacts.
python -m pip install --disable-pip-version-check --quiet build twine
python -m build "$ROOT/sdk/python" --outdir "$OUT/packages/python"
python -m twine check "$OUT/packages/python"/* > "$OUT/validation/python-twine-check.txt"
python -m pip install --disable-pip-version-check --dry-run --ignore-installed \
  --report "$TMP/python-deps.json" "$ROOT/sdk/python" > "$OUT/validation/python-pip-dry-run.txt"

# Rust / crates.io dry-run package.
cargo package --manifest-path "$ROOT/sdk/rust/ltp-client/Cargo.toml" --allow-dirty --no-verify
find "$ROOT/sdk/rust/ltp-client/target/package" -maxdepth 1 -type f -name '*.crate' \
  -exec cp {} "$OUT/packages/rust/" \;
cargo metadata --manifest-path "$ROOT/sdk/rust/ltp-client/Cargo.toml" \
  --format-version 1 --locked > "$TMP/rust-deps.json"

# Elixir / Hex dry-run package.
(
  cd "$ROOT/sdk/elixir"
  mix local.hex --force
  MIX_ENV=prod mix deps.get --only prod
  rm -f ltp_elixir-*.tar
  MIX_ENV=prod mix hex.build > "$OUT/validation/elixir-hex-build.txt"
  cp ltp_elixir-*.tar "$OUT/packages/elixir/"
  mix deps > "$TMP/elixir-deps.txt"
)

# Standardized dependency evidence.
python "$ROOT/tools/release/release_tool.py" sbom \
  --ecosystem javascript --input "$TMP/javascript-deps.json" \
  --package-name '@liminal/ltp-client' --version "$RELEASE_VERSION" \
  --source-sha "$SOURCE_SHA" --out "$OUT/sbom/javascript.cdx.json"
python "$ROOT/tools/release/release_tool.py" sbom \
  --ecosystem python --input "$TMP/python-deps.json" \
  --package-name 'ltp-client' --version "$RELEASE_VERSION" \
  --source-sha "$SOURCE_SHA" --out "$OUT/sbom/python.cdx.json"
python "$ROOT/tools/release/release_tool.py" sbom \
  --ecosystem rust --input "$TMP/rust-deps.json" \
  --package-name 'ltp-client' --version "$RELEASE_VERSION" \
  --source-sha "$SOURCE_SHA" --out "$OUT/sbom/rust.cdx.json"
python "$ROOT/tools/release/release_tool.py" sbom \
  --ecosystem elixir --input "$TMP/elixir-deps.txt" \
  --package-name 'ltp_elixir' --version "$RELEASE_VERSION" \
  --source-sha "$SOURCE_SHA" --out "$OUT/sbom/elixir.cdx.json"

# Deterministic source archive and release manifest.
python "$ROOT/tools/release/release_tool.py" archive \
  --root "$ROOT" --out "$OUT/source/ltp-${RELEASE_VERSION}-source.tar.gz" \
  --epoch "$SOURCE_EPOCH"
python "$ROOT/tools/release/release_tool.py" manifest \
  --build-dir "$OUT" --versions "$OUT/versions.json" \
  --source-sha "$SOURCE_SHA" --epoch "$SOURCE_EPOCH" \
  ${WORKFLOW_RUN:+--workflow-run "$WORKFLOW_RUN"} \
  --out "$OUT/release-manifest.json"
python "$ROOT/tools/release/release_tool.py" checksums \
  --build-dir "$OUT" --out "$OUT/checksums.sha256"

printf 'release_version=%s\nsource_sha=%s\nsource_date_epoch=%s\n' \
  "$RELEASE_VERSION" "$SOURCE_SHA" "$SOURCE_EPOCH" > "$OUT/validation/build-context.txt"
