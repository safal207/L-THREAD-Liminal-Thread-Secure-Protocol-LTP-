import json

runtime = "python"
active_owner = 1
seen = {"nonce-1"}
fresh_reset_count = 0
stale_owner = active_owner
active_owner += 1
stale = "ACCEPTED" if stale_owner == active_owner else "STALE_TRANSPORT_OWNER"
replay = "REPLAYED_NONCE" if "nonce-1" in seen else "ACCEPTED"
checksum_valid = False
if not checksum_valid:
    fresh_reset_count += 1
print(json.dumps({
    "runtime": runtime,
    "stale_owner": stale,
    "replay_after_restart": replay,
    "fresh_reset_count": fresh_reset_count,
}, separators=(",", ":")))
