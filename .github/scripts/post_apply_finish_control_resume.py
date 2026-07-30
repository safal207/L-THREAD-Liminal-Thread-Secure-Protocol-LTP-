# post-apply-v4
from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    target = Path(path)
    text = target.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one match, found {count}")
    target.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "sdk/js/src/__tests__/controlResumeSecurity.test.ts",
    "function assert(condition: unknown, message: string): asserts condition {",
    "function assert(condition: unknown, message: string): void {",
    "JavaScript assertion helper",
)
replace_once(
    "sdk/js/src/__tests__/controlResumeSecurity.test.ts",
    "run().catch((error) => { console.error(error); process.exitCode = 1; });",
    "run().then(() => (process as any).exit(0)).catch((error) => { console.error(error); (process as any).exit(1); });",
    "JavaScript deterministic exit",
)
replace_once(
    "sdk/js/tests/client.test.js",
    """    clientId: 'hb-client',
    storage,
    heartbeat: { intervalMs: 5, timeoutMs: 15 },
""",
    """    clientId: 'hb-client',
    storage,
    sessionMacKey: 'heartbeat-session-key',
    heartbeat: { intervalMs: 5, timeoutMs: 15 },
""",
    "heartbeat fixture negotiated key",
)
replace_once(
    "sdk/elixir/test/ltp/control_resume_security_test.exs",
    "defp state(overrides \\ %{}) do",
    "defp state(overrides \\\\ %{}) do",
    "Elixir state default argument",
)
replace_once(
    "sdk/elixir/test/ltp/control_resume_security_test.exs",
    "defp signed_control(type, key, overrides \\ %{}) do",
    "defp signed_control(type, key, overrides \\\\ %{}) do",
    "Elixir signed control default argument",
)

print("Applied post-patch compatibility corrections")
