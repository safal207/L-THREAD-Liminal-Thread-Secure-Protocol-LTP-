#!/usr/bin/env python3
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
    "sdk/rust/ltp-client/src/types.rs",
    '''fn current_unix_timestamp() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64
}
''',
    '''fn current_unix_timestamp() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis() as i64
}
''',
)

replace_once(
    "sdk/rust/ltp-client/src/client.rs",
    '''    #[test]
    fn receive_chain_requires_previous_hash_after_first_commit() {
''',
    '''    #[test]
    fn outbound_timestamps_use_unix_milliseconds() {
        let client = LtpClient::new("ws://example.com", "client");
        let event = client
            .build_event_envelope("timestamp", serde_json::json!({"value": 1}))
            .expect("event envelope");
        assert!(
            event.timestamp >= 1_000_000_000_000,
            "timestamp {} is not expressed in milliseconds",
            event.timestamp
        );
    }

    #[test]
    fn receive_chain_requires_previous_hash_after_first_commit() {
''',
)

replace_once(
    "sdk/elixir/lib/ltp/connection.ex",
    '''    WebSockex.start_link(state.url, __MODULE__, state, name: Keyword.get(opts, :name))
''',
    '''    case Keyword.get(opts, :name) do
      nil -> WebSockex.start_link(state.url, __MODULE__, state)
      name -> WebSockex.start_link(state.url, __MODULE__, state, name: name)
    end
''',
)

replace_once(
    "sdk/elixir/lib/ltp/connection.ex",
    '''      if state.thread_id and state.security_state_initialized do
''',
    '''      if state.thread_id && state.security_state_initialized do
''',
)

connection_path = ROOT / "sdk/elixir/lib/ltp/connection.ex"
connection = connection_path.read_text(encoding="utf-8")
old_guard = "      if public_key and state.secret_key do\n"
new_guard = "      if public_key && state.secret_key do\n"
if old_guard in connection:
    count = connection.count(old_guard)
    if count != 2:
        raise RuntimeError(
            f"sdk/elixir/lib/ltp/connection.ex: expected two ECDH guards, found {count}"
        )
    connection_path.write_text(connection.replace(old_guard, new_guard), encoding="utf-8")
elif connection.count(new_guard) != 2:
    raise RuntimeError(
        "sdk/elixir/lib/ltp/connection.ex: patched ECDH guards are incomplete"
    )

subprocess.run(
    [
        "git",
        "add",
        "sdk/rust/ltp-client/src/types.rs",
        "sdk/rust/ltp-client/src/client.rs",
        "sdk/elixir/lib/ltp/connection.ex",
    ],
    cwd=ROOT,
    check=True,
)

print("WP2 Rust timestamp and Elixir handshake fixes applied")
