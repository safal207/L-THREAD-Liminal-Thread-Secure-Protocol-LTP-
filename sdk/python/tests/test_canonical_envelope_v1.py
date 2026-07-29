import json
from pathlib import Path

import pytest

from ltp_client.crypto import _serialize_canonical

ROOT = Path(__file__).resolve().parents[3]


def test_canonical_envelope_v1_matches_shared_golden_vector() -> None:
    fixture = json.loads((ROOT / "tests/security/canonical-envelope-v1.json").read_text(encoding="utf-8"))
    expected = (ROOT / "tests/security/canonical-envelope-v1.txt").read_text(encoding="utf-8").rstrip("\n")
    assert _serialize_canonical(fixture) == expected


def test_canonical_envelope_v1_rejects_unsafe_integer() -> None:
    with pytest.raises(ValueError, match="safe range"):
        _serialize_canonical({"payload": {"unsafe": 2**53}})
