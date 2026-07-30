#!/usr/bin/env python3
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def replace_once(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text(encoding="utf-8")
    if new in text:
        return
    if text.count(old) != 1:
        raise RuntimeError(f"{path}: expected one match, found {text.count(old)}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "tests/e2e/four-sdk/javascript_adapter.ts",
    "reconnect: { enabled: false, maxRetries: 0, baseDelayMs: 50, maxDelayMs: 50 },",
    "reconnect: { maxRetries: 0, baseDelayMs: 50, maxDelayMs: 50 },",
)
replace_once(
    "tests/e2e/four-sdk/javascript_adapter.ts",
    '''import {
  generateNonce,
  hashEnvelope,
  LtpClient,
  LtpEnvelope,
  signMessage,
} from "../../../sdk/js/src";
''',
    '''import WebSocket from "ws";

(globalThis as any).WebSocket = WebSocket;
const {
  generateNonce,
  hashEnvelope,
  LtpClient,
  signMessage,
} = require("../../../sdk/js/dist") as Record<string, any>;
type LtpEnvelope = any;
''',
)
replace_once(
    "sdk/js/src/client.ts",
    """  private async handleMessageAsync(message: LtpMessage): Promise<void> {
    const envelopeMsg = message as LtpEnvelope;
    await this.decryptMetadataIfNeeded(envelopeMsg);
""",
    """  private async handleMessageAsync(message: LtpMessage): Promise<void> {
    const envelopeMsg = message as LtpEnvelope;
    // Preserve the exact transmitted fields for the receive hash-chain. Metadata
    // decryption produces the logical view used for signature/application checks.
    const wireEnvelope = { ...envelopeMsg } as LtpEnvelope;
    await this.decryptMetadataIfNeeded(envelopeMsg);
""",
)
replace_once(
    "sdk/js/src/client.ts",
    """    if (!(await this.verifyMessageSecurity(envelopeMsg, macKey))) {
""",
    """    if (!(await this.verifyMessageSecurity(envelopeMsg, macKey, wireEnvelope))) {
""",
)
replace_once(
    "sdk/js/src/client.ts",
    """  private async verifyMessageSecurity(
    envelope: LtpEnvelope,
    macKey?: string
  ): Promise<boolean> {
""",
    """  private async verifyMessageSecurity(
    envelope: LtpEnvelope,
    macKey?: string,
    wireEnvelope: LtpEnvelope = envelope
  ): Promise<boolean> {
""",
)
replace_once(
    "sdk/js/src/client.ts",
    """      this.lastReceivedHash = await hashEnvelope({
        type: envelope.type,
        thread_id: envelope.thread_id!,
        session_id: envelope.session_id,
        timestamp: envelope.timestamp,
        nonce: envelope.nonce!,
        payload: envelope.payload,
        prev_message_hash: envelope.prev_message_hash,
      });
""",
    """      this.lastReceivedHash = await hashEnvelope({
        type: wireEnvelope.type,
        thread_id: wireEnvelope.thread_id,
        session_id: wireEnvelope.session_id,
        timestamp: wireEnvelope.timestamp,
        nonce: wireEnvelope.nonce!,
        payload: wireEnvelope.payload,
        prev_message_hash: wireEnvelope.prev_message_hash,
        meta: wireEnvelope.meta,
        content_encoding: wireEnvelope.content_encoding,
      });
""",
)

# The matrix workflow commits only after every native SDK and all 40 verdicts pass.
subprocess.run(["git", "add", "sdk/js/src/client.ts"], cwd=ROOT, check=True)

print("WP2 adapter compatibility fixes applied")
