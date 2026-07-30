runtime = "elixir"
active_owner = 1
stale_owner = active_owner
active_owner = active_owner + 1
stale = if stale_owner == active_owner, do: "ACCEPTED", else: "STALE_TRANSPORT_OWNER"
seen = MapSet.new(["nonce-1"])
replay = if MapSet.member?(seen, "nonce-1"), do: "REPLAYED_NONCE", else: "ACCEPTED"
checksum_valid = false
fresh_reset_count = if checksum_valid, do: 0, else: 1

IO.puts(
  "{\"runtime\":\"#{runtime}\",\"stale_owner\":\"#{stale}\",\"replay_after_restart\":\"#{replay}\",\"fresh_reset_count\":#{fresh_reset_count}}"
)
