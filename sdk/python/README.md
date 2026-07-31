# LTP Python SDK

Python client SDK for the Liminal Thread Protocol (LTP).

## Installation

For a local checkout:

```bash
python -m pip install ./sdk/python
```

When published to a package registry:

```bash
python -m pip install "ltp-client==0.6.0a3"
```

The repository-wide release version is `0.6.0-alpha.3`. Python package tooling represents the same prerelease using the PEP 440 form `0.6.0a3`.

## Verification

```bash
cd sdk/python
python -m pytest tests/
```

The SDK implements authenticated LTP sessions, canonical envelope serialization, replay protection, hash-chain continuity, encrypted metadata and same-session resume behavior.

## License

MIT. See the repository license for the full terms.
