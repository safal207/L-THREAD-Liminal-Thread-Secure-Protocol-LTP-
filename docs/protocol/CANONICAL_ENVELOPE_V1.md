# Canonical Envelope v1

LTP signatures and hash-chain commitments operate on one language-independent byte sequence.

## Signed fields

The canonical object contains exactly these fields:

1. `type`
2. `thread_id`
3. `session_id`
4. `timestamp`
5. `nonce`
6. `payload`
7. `prev_message_hash`
8. `meta`
9. `content_encoding`

Absent optional fields are represented by the empty string or empty object used by the existing protocol contract. `signature`, `encrypted_metadata`, and `routing_tag` are not recursively included in the signature input.

## Encoding rules

Canonical Envelope v1 follows RFC 8785 / JSON Canonicalization Scheme behavior:

- UTF-8 output without insignificant whitespace;
- object keys sorted recursively by UTF-16 code units;
- ECMAScript-compatible shortest number representation;
- `-0` encoded as `0`;
- NaN and infinities rejected;
- integers outside the IEEE-754 safe range rejected;
- lone Unicode surrogates rejected;
- `prev_message_hash` is always part of the signed and hashed bytes.

## Compatibility

Changing canonical bytes is a protocol boundary. Peers must advertise and agree on Canonical Envelope v1 before authenticated traffic is exchanged. The shared vectors in `tests/security/canonical-envelope-v1.*` are normative and are executed independently by the JavaScript, Python, Rust, and Elixir SDK suites.
