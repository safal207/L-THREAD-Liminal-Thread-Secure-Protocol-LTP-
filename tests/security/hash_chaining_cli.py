#!/usr/bin/env python3
"""
CLI tool for testing hash chaining across SDKs
"""
import sys
import json
import os

# Add SDK path to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../sdk/python')))

from ltp_client.crypto import hash_envelope

def main():
    if len(sys.argv) < 2:
        print("Usage: hash_chaining_cli.py <command> [args...]")
        sys.exit(1)

    command = sys.argv[1]

    if command == "hash":
        if len(sys.argv) < 3:
            print("Usage: hash_chaining_cli.py hash <message_json>")
            sys.exit(1)
        import os
        message_json_or_path = sys.argv[2]
        if os.path.exists(message_json_or_path):
            with open(message_json_or_path, "r", encoding="utf-8") as f:
                message_json = f.read()
        else:
            message_json = message_json_or_path
        message = json.loads(message_json)
        # Canonicalize and serialize
        from ltp_client.crypto import _canonical_message, _serialize_canonical
        canonical = _canonical_message(message)
        print('  [DEBUG][PY] canonical:', json.dumps(canonical, separators=(",", ":"), sort_keys=True), file=sys.stderr)
        serialized = _serialize_canonical(message)
        print('  [DEBUG][PY] serialized:', serialized, file=sys.stderr)
        print('  [DEBUG][PY] bytes:', serialized.encode('utf-8').hex(), file=sys.stderr)
        
        # Convert to format expected by hash_envelope
        envelope = {
            'type': message.get('type'),
            'thread_id': message.get('thread_id'),
            'session_id': message.get('session_id'),
            'timestamp': message.get('timestamp'),
            'nonce': message.get('nonce'),
            'payload': message.get('payload'),
            'prev_message_hash': message.get('prev_message_hash')
        }
        
        hash_value = hash_envelope(envelope)
        print(json.dumps({
            "hash": hash_value
        }))

    else:
        print(f"Unknown command: {command}")
        sys.exit(1)

if __name__ == "__main__":
    main()

