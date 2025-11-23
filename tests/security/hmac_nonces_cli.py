#!/usr/bin/env python3
"""
CLI tool for testing HMAC-based nonces across SDKs
"""
import sys
import json
import os

# Add SDK path to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../sdk/python')))

from ltp_client.crypto import hmac_sha256

def generate_nonce(mac_key: str, client_id: str, timestamp: int) -> str:
    """Generate HMAC-based nonce"""
    import hashlib
    # Format: HMAC-SHA256(macKey, clientId:timestamp:random)
    # For deterministic testing, we use a fixed random component
    # In production, this would be a random value
    import secrets
    random_component = secrets.token_hex(16)  # 32 hex chars
    input_data = f"{client_id}:{timestamp}:{random_component}"
    nonce = hmac_sha256(input_data, mac_key)
    return nonce

def main():
    if len(sys.argv) < 2:
        print("Usage: hmac_nonces_cli.py <command> [args...]")
        sys.exit(1)

    command = sys.argv[1]

    if command == "generate":
        if len(sys.argv) < 5:
            print("Usage: hmac_nonces_cli.py generate <mac_key> <client_id> <timestamp>")
            sys.exit(1)
        
        mac_key = sys.argv[2]
        client_id = sys.argv[3]
        timestamp = int(sys.argv[4])
        
        nonce = generate_nonce(mac_key, client_id, timestamp)
        print(json.dumps({
            "nonce": nonce
        }))

    else:
        print(f"Unknown command: {command}")
        sys.exit(1)

if __name__ == "__main__":
    main()

