# LTP TOON Payload Mode (v0.3)

## 1. Purpose of TOON in LTP

TOON (Token-Oriented Object Notation) is an optional, compact payload format intended to reduce token counts for LLM-centric workflows.
It is especially useful for:
- affect/state logs (`affect_log`),
- batches of events,
- telemetry/statistics payloads,
- other large arrays of similar objects.

JSON remains the default format. TOON is opt-in and must be mutually understood by the client and server. The LTP envelope remains JSON either way.

## 2. Model

- LTP envelopes stay JSON.
- Inside `payload.data`, applications may send:
  - a normal JSON object/array, or
  - a TOON string.
- A new top-level field, `content_encoding`, declares how to interpret `payload.data`.

## 3. `content_encoding` Field

`content_encoding` is added to the envelope alongside `type`, `thread_id`, etc.

Allowed values:
- `"json"` — standard mode (default if omitted).
- `"toon"` — `payload.data` is a TOON string.

## 4. Examples

### JSON payload (default)

```json
{
  "type": "state_update",
  "thread_id": "abc",
  "session_id": "sess1",
  "content_encoding": "json",
  "payload": {
    "kind": "affect_log",
    "data": [
      { "t": 1, "valence": 0.2, "arousal": -0.1 },
      { "t": 2, "valence": 0.3, "arousal": -0.2 }
    ]
  }
}
```

### TOON payload

```json
{
  "type": "state_update",
  "thread_id": "abc",
  "session_id": "sess1",
  "content_encoding": "toon",
  "payload": {
    "kind": "affect_log",
    "data": "affect_log[2]{t,valence,arousal}:\n  1,0.2,-0.1\n  2,0.3,-0.2\n"
  }
}
```

Here, `payload.data` is a TOON string that the application/LRI layer knows how to interpret.

## 5. When to use TOON

Use TOON for:
- affect logs,
- transition/event batches,
- telemetry or other table-like data.

Keep JSON for:
- deeply nested structures,
- small/one-off messages.

LTP itself does not parse TOON; it only carries the `content_encoding` flag. Real TOON codecs should be supplied by the application or a dedicated library.
