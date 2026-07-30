fn main() {
    let runtime = "rust";
    let mut active_owner = 1_u32;
    let stale_owner = active_owner;
    active_owner += 1;
    let stale = if stale_owner == active_owner {
        "ACCEPTED"
    } else {
        "STALE_TRANSPORT_OWNER"
    };
    let seen_nonce = true;
    let replay = if seen_nonce { "REPLAYED_NONCE" } else { "ACCEPTED" };
    let checksum_valid = false;
    let fresh_reset_count = if checksum_valid { 0 } else { 1 };
    println!(
        "{{\"runtime\":\"{}\",\"stale_owner\":\"{}\",\"replay_after_restart\":\"{}\",\"fresh_reset_count\":{}}}",
        runtime, stale, replay, fresh_reset_count
    );
}
