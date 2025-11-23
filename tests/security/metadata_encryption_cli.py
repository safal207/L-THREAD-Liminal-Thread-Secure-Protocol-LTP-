#!/usr/bin/env python3
"""
CLI tool for testing metadata encryption across SDKs
"""
import sys
import json
import os

# Add SDK path to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../sdk/python')))

from ltp_client.crypto import encrypt_metadata, decrypt_metadata

def main():
    if len(sys.argv) < 2:
        print("Usage: metadata_encryption_cli.py <command> [args...]")
        sys.exit(1)

    command = sys.argv[1]

    if command == "encrypt":
        if len(sys.argv) < 4:
            print("Usage: metadata_encryption_cli.py encrypt <metadata_json> <encryption_key>")
            sys.exit(1)
        
        metadata_json = sys.argv[2]
        encryption_key = sys.argv[3]
        
        encrypted = encrypt_metadata(metadata_json, encryption_key)
        print(json.dumps({
            "encrypted": encrypted
        }))

    elif command == "decrypt":
        if len(sys.argv) < 4:
            print("Usage: metadata_encryption_cli.py decrypt <encrypted_data> <encryption_key>")
            sys.exit(1)
        
        encrypted_data = sys.argv[2]
        encryption_key = sys.argv[3]
        
        try:
            decrypted = decrypt_metadata(encrypted_data, encryption_key)
            print(json.dumps({
                "decrypted": decrypted
            }))
        except Exception as e:
            print(json.dumps({
                "error": str(e)
            }))
            sys.exit(1)

    else:
        print(f"Unknown command: {command}")
        sys.exit(1)

if __name__ == "__main__":
    main()

