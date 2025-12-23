use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs::File;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TraceEntry {
    pub i: u64,
    pub timestamp_ms: u64,
    pub direction: String,
    pub session_id: String,
    pub frame: Value,
    pub prev_hash: String,
    pub hash: String,
}

fn canonicalize_json(v: &Value) -> Value {
    match v {
        Value::Object(map) => {
            let mut sorted = BTreeMap::new();
            for (k, val) in map.iter() {
                sorted.insert(k.clone(), canonicalize_json(val));
            }
            let mut new_map = serde_json::Map::new();
            for (k, val) in sorted {
                new_map.insert(k, val);
            }
            Value::Object(new_map)
        }
        Value::Array(arr) => Value::Array(arr.iter().map(canonicalize_json).collect()),
        _ => v.clone(),
    }
}

fn canonical_json_bytes(frame: &Value) -> Result<Vec<u8>> {
    let canon = canonicalize_json(frame);
    let bytes = serde_json::to_vec(&canon)?;
    Ok(bytes)
}

fn verify_trace_file(path: PathBuf) -> Result<()> {
    let file = File::open(&path).with_context(|| format!("Failed to open {}", path.display()))?;
    let reader = BufReader::new(file);

    let mut prev_hash = "0".repeat(64);
    let mut expected_i = 0;

    for (line_num, line) in reader.lines().enumerate() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }

        let entry: TraceEntry = serde_json::from_str(&line)
            .with_context(|| format!("Failed to parse line {}", line_num + 1))?;

        if entry.i != expected_i {
            anyhow::bail!(
                "Sequence break at line {}: expected i={}, got i={}",
                line_num + 1,
                expected_i,
                entry.i
            );
        }

        if entry.prev_hash != prev_hash {
            anyhow::bail!(
                "Hash chain broken at line {} (i={}): prev_hash mismatch.\nExpected: {}\nGot:      {}",
                line_num + 1,
                entry.i,
                prev_hash,
                entry.prev_hash
            );
        }

        let frame_bytes = canonical_json_bytes(&entry.frame)?;
        let mut hasher = Sha256::new();
        hasher.update(prev_hash.as_bytes());
        hasher.update(&frame_bytes);
        let computed_hash = format!("{:x}", hasher.finalize());

        if computed_hash != entry.hash {
            anyhow::bail!(
                "Integrity check failed at line {} (i={}).\nExpected hash: {}\nActual hash:   {}",
                line_num + 1,
                entry.i,
                computed_hash,
                entry.hash
            );
        }

        prev_hash = entry.hash;
        expected_i += 1;
    }

    println!(
        "Trace verified successfully. {} entries processed.",
        expected_i
    );
    Ok(())
}

fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 2 {
        eprintln!("Usage: {} <trace_file.jsonl>", args[0]);
        std::process::exit(1);
    }

    verify_trace_file(PathBuf::from(&args[1]))
}
