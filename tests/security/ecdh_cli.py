#!/usr/bin/env python3
import sys
import json
import os

# Add SDK path to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../sdk/python')))

from ltp_client.crypto import generate_ecdh_key_pair, derive_shared_secret

def main():
    if len(sys.argv) < 2:
        print("Usage: ecdh_cli.py <command> [args...]")
        sys.exit(1)

    command = sys.argv[1]

    if command == "generate":
        private, public = generate_ecdh_key_pair()
        print(json.dumps({
            "private": private,
            "public": public
        }))

    elif command == "derive":
        if len(sys.argv) < 4:
            print("Usage: ecdh_cli.py derive <private_hex> <public_hex>")
            sys.exit(1)
        
        private_hex = sys.argv[2]
        public_hex = sys.argv[3]
        
        secret = derive_shared_secret(private_hex, public_hex)
        print(json.dumps({
            "secret": secret
        }))

    else:
        print(f"Unknown command: {command}")
        sys.exit(1)

if __name__ == "__main__":
    main()

