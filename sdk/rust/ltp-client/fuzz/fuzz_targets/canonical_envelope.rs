#![no_main]

use libfuzzer_sys::fuzz_target;
use serde_json::Value;

const MAX_INPUT_BYTES: usize = 65_536;
const MAX_DEPTH: usize = 32;

fn value_depth(value: &Value, depth: usize) -> usize {
    match value {
        Value::Array(items) => items
            .iter()
            .map(|item| value_depth(item, depth + 1))
            .fold(depth + 1, usize::max),
        Value::Object(map) => map
            .values()
            .map(|item| value_depth(item, depth + 1))
            .fold(depth + 1, usize::max),
        _ => depth,
    }
}

fuzz_target!(|data: &[u8]| {
    if data.len() > MAX_INPUT_BYTES {
        return;
    }
    let Ok(text) = std::str::from_utf8(data) else {
        return;
    };
    let Ok(value) = serde_json::from_str::<Value>(text) else {
        return;
    };
    if value_depth(&value, 0) > MAX_DEPTH {
        return;
    }

    let _ = ltp_client::serialize_canonical(&value);
});
