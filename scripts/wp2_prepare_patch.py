#!/usr/bin/env python3
from pathlib import Path

path = Path(__file__).with_name("wp2_apply_wire_compat.py")
text = path.read_text(encoding="utf-8")
old = '''replace_once(
    "tools/reference-server/server.ts",
    """      thread_id: state.threadId,
      session_id: state.sessionId,
""",
    """      protocol_version: state.protocolVersion,
      thread_id: state.threadId,
      session_id: state.sessionId,
""",
)
'''
new = '''replace_once(
    "tools/reference-server/server.ts",
    """      seen_nonces: [...state.seenNonces].sort(),
      thread_id: state.threadId,
      session_id: state.sessionId,
""",
    """      seen_nonces: [...state.seenNonces].sort(),
      protocol_version: state.protocolVersion,
      thread_id: state.threadId,
      session_id: state.sessionId,
""",
)
'''
if new not in text:
    if text.count(old) != 1:
        raise RuntimeError(f"expected one ambiguous state-digest patch block, found {text.count(old)}")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("WP2 patch contract prepared")
