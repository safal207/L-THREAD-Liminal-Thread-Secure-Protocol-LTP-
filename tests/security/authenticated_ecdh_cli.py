#!/usr/bin/env python3
"""
CLI tool for testing Authenticated ECDH across SDKs
"""
import sys
import json
import os

# Add SDK path to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../sdk/python')))

from ltp_client.crypto import (
    generate_ecdh_key_pair,
    sign_ecdh_public_key,
    verify_ecdh_public_key
)

def main():
    if len(sys.argv) < 2:
        print("Usage: authenticated_ecdh_cli.py <command> [args...]")
        sys.exit(1)

    command = sys.argv[1]

    if command == "generate":
        private, public = generate_ecdh_key_pair()
        print(json.dumps({
            "private": private,
            "public": public
        }))

    elif command == "sign":
        if len(sys.argv) < 6:
            print("Usage: authenticated_ecdh_cli.py sign <public_key> <client_id> <timestamp> <secret_key>")
            sys.exit(1)
        
        public_key = sys.argv[2]
        client_id = sys.argv[3]
        timestamp = int(sys.argv[4])
        secret_key = sys.argv[5]
        
        signature = sign_ecdh_public_key(public_key, client_id, timestamp, secret_key)
        print(json.dumps({
            "signature": signature
        }))

    elif command == "verify":
        if len(sys.argv) < 7:
            print("Usage: authenticated_ecdh_cli.py verify <public_key> <client_id> <timestamp> <signature> <secret_key>")
            sys.exit(1)
        
        public_key = sys.argv[2]
        client_id = sys.argv[3]
        timestamp = int(sys.argv[4])
        signature = sys.argv[5]
        secret_key = sys.argv[6]
        
        result = verify_ecdh_public_key(public_key, client_id, timestamp, signature, secret_key)
        print(json.dumps({
            "valid": result["valid"],
            "error": result.get("error")
        }))

    else:
        print(f"Unknown command: {command}")
        sys.exit(1)

if __name__ == "__main__":
    main()

