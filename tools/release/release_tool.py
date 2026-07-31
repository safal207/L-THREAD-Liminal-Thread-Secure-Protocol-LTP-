#!/usr/bin/env python3
from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import os
import re
import stat
import tarfile
import tempfile
import zipfile
from pathlib import Path
from typing import Any, Iterable

DEFAULT_EXCLUDES = {
    ".git",
    "node_modules",
    "target",
    "dist",
    "deps",
    "_build",
    ".pytest_cache",
    "__pycache__",
    ".mypy_cache",
    ".ruff_cache",
    "artifacts",
}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def json_dump(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def should_exclude(relative: Path, extra: set[str]) -> bool:
    return any(part in DEFAULT_EXCLUDES or part in extra for part in relative.parts)


def iter_source_files(root: Path, extra_excludes: set[str]) -> Iterable[tuple[Path, Path]]:
    for path in sorted(root.rglob("*"), key=lambda item: item.as_posix().encode("utf-8")):
        relative = path.relative_to(root)
        if should_exclude(relative, extra_excludes):
            continue
        if path.is_file() or path.is_symlink():
            yield path, relative


def deterministic_tar_gz(root: Path, out: Path, epoch: int, excludes: set[str]) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("wb") as raw:
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as zipped:
            with tarfile.open(fileobj=zipped, mode="w", format=tarfile.PAX_FORMAT) as archive:
                for path, relative in iter_source_files(root, excludes):
                    info = tarfile.TarInfo(relative.as_posix())
                    info.uid = 0
                    info.gid = 0
                    info.uname = "root"
                    info.gname = "root"
                    info.mtime = epoch
                    if path.is_symlink():
                        info.type = tarfile.SYMTYPE
                        info.linkname = os.readlink(path)
                        info.mode = 0o777
                        archive.addfile(info)
                        continue
                    data = path.read_bytes()
                    info.size = len(data)
                    info.mode = 0o755 if path.stat().st_mode & stat.S_IXUSR else 0o644
                    with tempfile.SpooledTemporaryFile() as payload:
                        payload.write(data)
                        payload.seek(0)
                        archive.addfile(info, payload)


def canonical_archive_digest(path: Path) -> str:
    digest = hashlib.sha256()

    def add(name: str, data: bytes) -> None:
        digest.update(name.encode("utf-8"))
        digest.update(b"\0")
        digest.update(str(len(data)).encode("ascii"))
        digest.update(b"\0")
        digest.update(data)
        digest.update(b"\0")

    suffixes = "".join(path.suffixes).lower()
    if suffixes.endswith(".whl") or suffixes.endswith(".zip"):
        with zipfile.ZipFile(path) as archive:
            for name in sorted((item.filename for item in archive.infolist() if not item.is_dir())):
                add(name, archive.read(name))
        return digest.hexdigest()

    if any(suffixes.endswith(value) for value in (".tar", ".tar.gz", ".tgz", ".crate")):
        with tarfile.open(path, mode="r:*") as archive:
            members = sorted((member for member in archive.getmembers() if member.isfile()), key=lambda m: m.name)
            for member in members:
                extracted = archive.extractfile(member)
                if extracted is None:
                    raise ValueError(f"could not read {member.name} from {path}")
                add(member.name, extracted.read())
        return digest.hexdigest()

    return sha256_file(path)


def purl(ecosystem: str, name: str, version: str) -> str:
    mapping = {"javascript": "npm", "python": "pypi", "rust": "cargo", "elixir": "hex"}
    return f"pkg:{mapping[ecosystem]}/{name}@{version}"


def js_components(value: Any) -> list[tuple[str, str]]:
    found: set[tuple[str, str]] = set()

    def walk(node: Any) -> None:
        if isinstance(node, list):
            for item in node:
                walk(item)
            return
        if not isinstance(node, dict):
            return
        dependencies = node.get("dependencies", {})
        if isinstance(dependencies, dict):
            for name, metadata in dependencies.items():
                if isinstance(metadata, dict):
                    version = str(metadata.get("version", "unknown")).split("(", 1)[0]
                    found.add((name, version))
                    walk(metadata)

    walk(value)
    return sorted(found)


def python_components(value: Any) -> list[tuple[str, str]]:
    found: set[tuple[str, str]] = set()
    for item in value.get("install", []):
        metadata = item.get("metadata", {})
        name = metadata.get("name")
        version = metadata.get("version")
        if name and version:
            found.add((str(name), str(version)))
    return sorted(found)


def rust_components(value: Any) -> list[tuple[str, str]]:
    return sorted({(str(item["name"]), str(item["version"])) for item in value.get("packages", [])})


def elixir_components(text: str) -> list[tuple[str, str]]:
    found: set[tuple[str, str]] = set()
    for line in text.splitlines():
        match = re.match(r"^\*\s+([A-Za-z0-9_.-]+)\s+([^\s]+)", line.strip())
        if match:
            found.add((match.group(1), match.group(2)))
    return sorted(found)


def generate_sbom(ecosystem: str, input_path: Path, package_name: str, version: str, source_sha: str) -> dict[str, Any]:
    if ecosystem == "elixir":
        components = elixir_components(input_path.read_text(encoding="utf-8"))
    else:
        value = json.loads(input_path.read_text(encoding="utf-8"))
        parser = {
            "javascript": js_components,
            "python": python_components,
            "rust": rust_components,
        }[ecosystem]
        components = parser(value)

    serial_seed = json.dumps([ecosystem, package_name, version, source_sha, components], separators=(",", ":"))
    serial = "urn:uuid:" + hashlib.sha256(serial_seed.encode("utf-8")).hexdigest()[:32]
    return {
        "bomFormat": "CycloneDX",
        "specVersion": "1.5",
        "serialNumber": serial,
        "version": 1,
        "metadata": {
            "component": {
                "type": "library",
                "name": package_name,
                "version": version,
                "purl": purl(ecosystem, package_name, version),
            },
            "properties": [
                {"name": "org.ltp.source.sha", "value": source_sha},
                {"name": "org.ltp.ecosystem", "value": ecosystem},
            ],
        },
        "components": [
            {
                "type": "library",
                "name": name,
                "version": component_version,
                "purl": purl(ecosystem, name, component_version),
            }
            for name, component_version in components
        ],
    }


def artifact_entries(build_dir: Path) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for path in sorted((item for item in build_dir.rglob("*") if item.is_file()), key=lambda p: p.as_posix()):
        relative = path.relative_to(build_dir).as_posix()
        if relative in {"release-manifest.json", "checksums.sha256", "checksums.sha256.sig", "checksums.pub"}:
            continue
        entries.append(
            {
                "path": relative,
                "size": path.stat().st_size,
                "sha256": sha256_file(path),
                "canonical_content_sha256": canonical_archive_digest(path),
            }
        )
    return entries


def create_manifest(build_dir: Path, versions_path: Path, source_sha: str, epoch: int, workflow_run: str | None) -> dict[str, Any]:
    versions = json.loads(versions_path.read_text(encoding="utf-8"))
    entries = artifact_entries(build_dir)
    core = {
        "schema_version": 1,
        "profile": "org.ltp.release.manifest.v1",
        "source_sha": source_sha,
        "source_date_epoch": epoch,
        "workflow_run": workflow_run,
        "protocol_version": versions["protocol_version"],
        "release_version": versions["release_version"],
        "sdk_versions": versions["sdk_versions"],
        "artifacts": entries,
        "credential_policy": {
            "long_lived_credentials_used": False,
            "trusted_signing": "github-keyless-attestation",
        },
    }
    core["manifest_digest"] = sha256_bytes(json.dumps(core, sort_keys=True, separators=(",", ":")).encode("utf-8"))
    return core


def compare_manifests(a: dict[str, Any], b: dict[str, Any]) -> dict[str, Any]:
    identity_keys = ("source_sha", "source_date_epoch", "protocol_version", "release_version", "sdk_versions")
    identity_mismatches = {key: [a.get(key), b.get(key)] for key in identity_keys if a.get(key) != b.get(key)}
    a_entries = {entry["path"]: entry for entry in a.get("artifacts", [])}
    b_entries = {entry["path"]: entry for entry in b.get("artifacts", [])}
    paths = sorted(set(a_entries) | set(b_entries))
    comparisons = []
    for path in paths:
        left = a_entries.get(path)
        right = b_entries.get(path)
        comparisons.append(
            {
                "path": path,
                "present_in_a": left is not None,
                "present_in_b": right is not None,
                "raw_match": bool(left and right and left["sha256"] == right["sha256"]),
                "canonical_content_match": bool(
                    left and right and left["canonical_content_sha256"] == right["canonical_content_sha256"]
                ),
                "a_sha256": left and left["sha256"],
                "b_sha256": right and right["sha256"],
            }
        )
    failures = [item for item in comparisons if not item["canonical_content_match"]]
    raw_exceptions = [item["path"] for item in comparisons if item["canonical_content_match"] and not item["raw_match"]]
    return {
        "schema_version": 1,
        "profile": "org.ltp.release.reproducibility.v1",
        "identity_mismatches": identity_mismatches,
        "artifacts": comparisons,
        "summary": {
            "total": len(comparisons),
            "canonical_matches": len(comparisons) - len(failures),
            "canonical_failures": len(failures),
            "raw_digest_exceptions": len(raw_exceptions),
        },
        "raw_digest_exceptions": raw_exceptions,
        "reproducible": not identity_mismatches and not failures,
    }


def write_checksums(build_dir: Path, out: Path) -> None:
    lines = []
    for path in sorted((item for item in build_dir.rglob("*") if item.is_file()), key=lambda p: p.as_posix()):
        relative = path.relative_to(build_dir).as_posix()
        if path == out or relative in {"checksums.sha256.sig", "checksums.pub"}:
            continue
        lines.append(f"{sha256_file(path)}  {relative}")
    out.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)

    archive = sub.add_parser("archive")
    archive.add_argument("--root", type=Path, required=True)
    archive.add_argument("--out", type=Path, required=True)
    archive.add_argument("--epoch", type=int, required=True)
    archive.add_argument("--exclude", action="append", default=[])

    sbom = sub.add_parser("sbom")
    sbom.add_argument("--ecosystem", choices=["javascript", "python", "rust", "elixir"], required=True)
    sbom.add_argument("--input", type=Path, required=True)
    sbom.add_argument("--package-name", required=True)
    sbom.add_argument("--version", required=True)
    sbom.add_argument("--source-sha", required=True)
    sbom.add_argument("--out", type=Path, required=True)

    manifest = sub.add_parser("manifest")
    manifest.add_argument("--build-dir", type=Path, required=True)
    manifest.add_argument("--versions", type=Path, required=True)
    manifest.add_argument("--source-sha", required=True)
    manifest.add_argument("--epoch", type=int, required=True)
    manifest.add_argument("--workflow-run")
    manifest.add_argument("--out", type=Path, required=True)

    compare = sub.add_parser("compare")
    compare.add_argument("--a", type=Path, required=True)
    compare.add_argument("--b", type=Path, required=True)
    compare.add_argument("--out", type=Path, required=True)

    checksums = sub.add_parser("checksums")
    checksums.add_argument("--build-dir", type=Path, required=True)
    checksums.add_argument("--out", type=Path, required=True)

    args = parser.parse_args()
    if args.command == "archive":
        deterministic_tar_gz(args.root.resolve(), args.out.resolve(), args.epoch, set(args.exclude))
    elif args.command == "sbom":
        json_dump(
            args.out,
            generate_sbom(args.ecosystem, args.input, args.package_name, args.version, args.source_sha),
        )
    elif args.command == "manifest":
        json_dump(
            args.out,
            create_manifest(args.build_dir, args.versions, args.source_sha, args.epoch, args.workflow_run),
        )
    elif args.command == "compare":
        result = compare_manifests(
            json.loads(args.a.read_text(encoding="utf-8")),
            json.loads(args.b.read_text(encoding="utf-8")),
        )
        json_dump(args.out, result)
        if not result["reproducible"]:
            raise SystemExit("clean-build canonical content digests differ")
    elif args.command == "checksums":
        args.out.parent.mkdir(parents=True, exist_ok=True)
        write_checksums(args.build_dir, args.out)


if __name__ == "__main__":
    main()
