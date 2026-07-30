const runtime = "javascript";
let activeOwner = 1;
const seen = new Set(["nonce-1"]);
let freshResetCount = 0;
const staleOwner = activeOwner;
activeOwner += 1;
const stale = staleOwner === activeOwner ? "ACCEPTED" : "STALE_TRANSPORT_OWNER";
const replay = seen.has("nonce-1") ? "REPLAYED_NONCE" : "ACCEPTED";
const checksumValid = false;
if (!checksumValid) freshResetCount += 1;
console.log(JSON.stringify({
  runtime,
  stale_owner: stale,
  replay_after_restart: replay,
  fresh_reset_count: freshResetCount,
}));
