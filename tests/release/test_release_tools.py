from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def load_module(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"could not load {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


release_tool = load_module("release_tool", ROOT / "tools/release/release_tool.py")
versions_tool = load_module("versions_tool", ROOT / "tools/release/versions.py")


class ReleaseToolTests(unittest.TestCase):
    def test_all_sdk_versions_match_the_baseline(self) -> None:
        evidence = versions_tool.collect_versions()
        self.assertTrue(evidence["consistent"], evidence)
        self.assertEqual(evidence["release_version"], "0.6.0-alpha.3")
        self.assertEqual(set(evidence["sdk_versions"].values()), {"0.6.0-alpha.3"})

    def test_deterministic_archive_is_byte_identical(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory) / "root"
            root.mkdir()
            (root / "b.txt").write_text("beta\n", encoding="utf-8")
            (root / "a.txt").write_text("alpha\n", encoding="utf-8")
            (root / "node_modules").mkdir()
            (root / "node_modules" / "ignored.txt").write_text("ignored", encoding="utf-8")
            first = Path(directory) / "first.tar.gz"
            second = Path(directory) / "second.tar.gz"

            release_tool.deterministic_tar_gz(root, first, 1_700_000_000, set())
            release_tool.deterministic_tar_gz(root, second, 1_700_000_000, set())

            self.assertEqual(release_tool.sha256_file(first), release_tool.sha256_file(second))
            self.assertEqual(
                release_tool.canonical_archive_digest(first),
                release_tool.canonical_archive_digest(second),
            )

    def test_manifest_comparison_detects_content_drift(self) -> None:
        base = {
            "source_sha": "a" * 40,
            "source_date_epoch": 1,
            "protocol_version": "0.6.0",
            "release_version": "0.6.0-alpha.3",
            "sdk_versions": {"javascript": "0.6.0-alpha.3"},
            "artifacts": [
                {
                    "path": "packages/example.tgz",
                    "sha256": "raw-a",
                    "canonical_content_sha256": "content-a",
                }
            ],
        }
        same_content = json.loads(json.dumps(base))
        same_content["artifacts"][0]["sha256"] = "raw-b"
        result = release_tool.compare_manifests(base, same_content)
        self.assertTrue(result["reproducible"])
        self.assertEqual(result["summary"]["raw_digest_exceptions"], 1)

        drifted = json.loads(json.dumps(base))
        drifted["artifacts"][0]["canonical_content_sha256"] = "content-b"
        result = release_tool.compare_manifests(base, drifted)
        self.assertFalse(result["reproducible"])
        self.assertEqual(result["summary"]["canonical_failures"], 1)


if __name__ == "__main__":
    unittest.main()
