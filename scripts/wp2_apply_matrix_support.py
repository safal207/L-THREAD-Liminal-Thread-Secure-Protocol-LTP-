#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    if new in text:
        return
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected one match, found {count}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "tools/reference-server/server.ts",
    """  frame_digest: string;
  thread_id?: string;
""",
    """  frame_digest: string;
  client_id?: string;
  thread_id?: string;
""",
)
replace_once(
    "tools/reference-server/server.ts",
    """      frame_digest: frameDigest(rawFrame),
      thread_id: state?.threadId,
""",
    """      frame_digest: frameDigest(rawFrame),
      client_id: state?.clientId,
      thread_id: state?.threadId,
""",
)
replace_once(
    "tools/reference-server/server.ts",
    """    const candidateHash = hashEnvelope(logical);
""",
    """    // The chain commits the exact transmitted envelope. Signature checks use
    // the decrypted logical view, but reconnect continuity must follow wire bytes.
    const candidateHash = hashEnvelope(wireFrame);
""",
)
replace_once(
    "tools/reference-server/scenarios.ts",
    """      this.lastSentHash = hashEnvelope(logical);
""",
    """      this.lastSentHash = hashEnvelope(wire);
""",
)
replace_once(
    "tools/reference-server/protocol.ts",
    """  return hmacSha256(`${entityId}:${timestamp}:${deterministicRandomHex}`, macKey);
""",
    """  const digest = hmacSha256(`${entityId}:${timestamp}:${deterministicRandomHex}`, macKey);
  return `hmac-${digest.slice(0, 32)}-${timestamp}`;
""",
)
replace_once(
    "tools/reference-server/protocol.ts",
    """    prev_message_hash: message.prev_message_hash,
    meta: {},
    content_encoding: "",
""",
    """    prev_message_hash: message.prev_message_hash,
    meta: message.meta,
    content_encoding: message.content_encoding,
""",
)
replace_once(
    "tools/reference-server/referenceServer.test.ts",
    'import { runReferenceScenarios } from "./scenarios";\n',
    'import { generateNonce, hashEnvelope } from "./protocol";\nimport { runReferenceScenarios } from "./scenarios";\n',
)
replace_once(
    "tools/reference-server/referenceServer.test.ts",
    'describe("independent LTP reference server", () => {\n',
    '''describe("independent LTP reference server", () => {
  it("emits the cross-SDK canonical HMAC nonce format", () => {
    const nonce = generateNonce("matrix-mac-key", "reference-server", 1_900_000_000_000, "00".repeat(16));
    expect(nonce).toMatch(/^hmac-[0-9a-f]{32}-1900000000000$/);
  });

  it("commits meta and content encoding into the envelope hash", () => {
    const base = {
      type: "event",
      thread_id: "thread",
      session_id: "session",
      timestamp: 1_900_000_000_000,
      nonce: "hmac-0123456789abcdef0123456789abcdef-1900000000000",
      payload: { scenario_id: "canonical-hash" },
      prev_message_hash: "",
      meta: { client_id: "client-a" },
      content_encoding: "json",
    };
    expect(hashEnvelope(base)).not.toBe(hashEnvelope({
      ...base,
      meta: { client_id: "client-b" },
    }));
    expect(hashEnvelope(base)).not.toBe(hashEnvelope({
      ...base,
      content_encoding: "cbor",
    }));
  });

''',
)
replace_once(
    "sdk/js/src/crypto.ts",
    """  payload: any;
  prev_message_hash?: string;
}): Promise<string> {
""",
    """  payload: any;
  prev_message_hash?: string;
  meta?: any;
  content_encoding?: string;
}): Promise<string> {
""",
)
replace_once(
    "sdk/js/src/client.ts",
    """      this.lastSentHash = await hashEnvelope({
        type: envelopeWithSecurity.type,
        thread_id: envelopeWithSecurity.thread_id || envelopeWithPrev.thread_id,
        session_id: envelopeWithSecurity.session_id || envelopeWithPrev.session_id,
        timestamp: envelopeWithSecurity.timestamp || envelopeWithPrev.timestamp,
        nonce: envelopeWithSecurity.nonce!,
        payload: envelopeWithSecurity.payload,
        prev_message_hash: envelopeWithSecurity.prev_message_hash,
      });
""",
    """      // The sender commits the canonical fields exactly as transmitted. For
      // metadata-encrypted frames this means the masked routing fields, not the
      // decrypted logical identifiers used for signature verification.
      this.lastSentHash = await hashEnvelope({
        type: envelopeWithSecurity.type,
        thread_id: envelopeWithSecurity.thread_id,
        session_id: envelopeWithSecurity.session_id,
        timestamp: envelopeWithSecurity.timestamp,
        nonce: envelopeWithSecurity.nonce!,
        payload: envelopeWithSecurity.payload,
        prev_message_hash: envelopeWithSecurity.prev_message_hash,
        meta: envelopeWithSecurity.meta,
        content_encoding: envelopeWithSecurity.content_encoding,
      });
""",
)
replace_once(
    "sdk/elixir/lib/ltp/connection.ex",
    """      client_id: Keyword.fetch!(opts, :client_id),
      device_fingerprint: Keyword.get(opts, :device_fingerprint),
""",
    """      client_id: Keyword.fetch!(opts, :client_id),
      thread_id: Keyword.get(opts, :thread_id),
      session_id: Keyword.get(opts, :session_id),
      device_fingerprint: Keyword.get(opts, :device_fingerprint),
""",
)

cargo_path = ROOT / "sdk/rust/ltp-client/Cargo.toml"
cargo = cargo_path.read_text(encoding="utf-8")
feature_block = """[features]
default = []
reference-interop = []

"""
if feature_block not in cargo:
    marker = "[dependencies]\n"
    if cargo.count(marker) != 1:
        raise RuntimeError("Cargo.toml dependencies marker is ambiguous")
    cargo = cargo.replace(marker, feature_block + marker, 1)
    cargo_path.write_text(cargo, encoding="utf-8")

client_path = ROOT / "sdk/rust/ltp-client/src/client.rs"
client = client_path.read_text(encoding="utf-8")
module_line = "\n#[cfg(all(test, feature = \"reference-interop\"))]\nmod reference_interop_tests;\n"
if "mod reference_interop_tests;" not in client:
    client_path.write_text(client.rstrip() + module_line, encoding="utf-8")

package_path = ROOT / "package.json"
package = json.loads(package_path.read_text(encoding="utf-8"))
package["scripts"]["e2e:four-sdk"] = (
    "pnpm --dir sdk/js build && ts-node tests/e2e/four-sdk/run-matrix.ts"
)
package_path.write_text(json.dumps(package, indent=2) + "\n", encoding="utf-8")

# The temporary workflow's explicit add-list predates these runtime discoveries.
# Stage the verified JS fixes here; no commit occurs unless all four SDKs pass.
subprocess.run(
    ["git", "add", "sdk/js/src/client.ts", "sdk/js/src/crypto.ts"],
    cwd=ROOT,
    check=True,
)

print("WP2 matrix support patch applied")
