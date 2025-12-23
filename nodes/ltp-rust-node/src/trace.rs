use anyhow::{Context, Result};
use ed25519_dalek::{Signer, SigningKey};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::fs::{File, OpenOptions};
use tokio::io::AsyncWriteExt;
use tokio::sync::Mutex;
use tracing::{info, warn};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TraceEntry {
    pub i: u64,
    pub timestamp_ms: u64,
    pub direction: String,
    pub session_id: String,
    pub frame: Value,
    pub prev_hash: String,
    pub hash: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub signature: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub alg: Option<String>,
}

pub struct TraceLogger {
    file: Mutex<File>,
    last_hash: Mutex<String>,
    counter: Mutex<u64>,
    signing_key: Option<SigningKey>,
}

impl TraceLogger {
    pub async fn new<P: AsRef<Path>>(path: P) -> Result<Self> {
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .read(true) // Need read to recover state
            .open(&path)
            .await?;

        let (last_hash, counter) = recover_state(path.as_ref())?;

        // P1-3: Load signing key from env if present
        let signing_key = if let Ok(key_hex) = std::env::var("NODE_SIGNING_KEY") {
            if let Ok(bytes) = hex::decode(&key_hex) {
                if bytes.len() == 32 {
                    let key: [u8; 32] = bytes.try_into().unwrap();
                    Some(SigningKey::from_bytes(&key))
                } else {
                    warn!("NODE_SIGNING_KEY present but invalid length (expected 32 bytes hex)");
                    None
                }
            } else {
                warn!("NODE_SIGNING_KEY present but invalid hex");
                None
            }
        } else {
            None
        };

        if signing_key.is_some() {
            info!("Trace signing enabled (ed25519)");
        }

        Ok(Self {
            file: Mutex::new(file),
            last_hash: Mutex::new(last_hash),
            counter: Mutex::new(counter),
            signing_key,
        })
    }

    pub async fn log(&self, direction: &str, session_id: &str, payload: &impl Serialize) -> Result<()> {
        let timestamp_ms = SystemTime::now()
            .duration_since(UNIX_EPOCH)?
            .as_millis() as u64;

        let frame_json = serde_json::to_value(payload)?;

        let mut last_hash_guard = self.last_hash.lock().await;
        let mut counter_guard = self.counter.lock().await;

        let prev_hash = last_hash_guard.clone();
        let i = *counter_guard;
        *counter_guard += 1;

        let frame_bytes = canonical_json_bytes(&frame_json)?;

        let mut hasher = Sha256::new();
        hasher.update(prev_hash.as_bytes());
        hasher.update(&frame_bytes);

        let current_hash = format!("{:x}", hasher.finalize());
        *last_hash_guard = current_hash.clone();

        // P1-3: Optional Signing
        let (signature, alg) = if let Some(key) = &self.signing_key {
            // Sign the current_hash
            let sig = key.sign(current_hash.as_bytes());
            (Some(hex::encode(sig.to_bytes())), Some("ed25519".to_string()))
        } else {
            (None, None)
        };

        let entry = TraceEntry {
            i,
            timestamp_ms,
            direction: direction.to_string(),
            session_id: session_id.to_string(),
            frame: frame_json,
            prev_hash,
            hash: current_hash,
            signature,
            alg,
        };

        let mut file_guard = self.file.lock().await;
        let json_line = serde_json::to_string(&entry)?;
        file_guard.write_all(json_line.as_bytes()).await?;
        file_guard.write_all(b"\n").await?;
        file_guard.flush().await?;

        Ok(())
    }
}

fn recover_state(path: &Path) -> Result<(String, u64)> {
    if !path.exists() {
        return Ok(("0".repeat(64), 0));
    }

    let mut file = std::fs::File::open(path)?;
    let metadata = file.metadata()?;
    if metadata.len() == 0 {
        return Ok(("0".repeat(64), 0));
    }

    let mut pos = metadata.len() as i64;
    let chunk_size = 4096;
    let mut last_line_end = pos;

    if pos > 0 {
        file.seek(SeekFrom::End(-1))?;
        let mut buf = [0u8; 1];
        file.read_exact(&mut buf)?;
        if buf[0] == b'\n' {
            pos -= 1;
            last_line_end = pos;
        }
    }

    while pos > 0 {
        let read_len = std::cmp::min(pos, chunk_size) as usize;
        pos -= read_len as i64;
        file.seek(SeekFrom::Start(pos as u64))?;

        let mut chunk = vec![0u8; read_len];
        file.read_exact(&mut chunk)?;

        if let Some(idx) = chunk.iter().rposition(|&b| b == b'\n') {
            pos += idx as i64 + 1;
            break;
        }
    }

    file.seek(SeekFrom::Start(pos as u64))?;
    // let len = last_line_end - pos; // Unused variable warning fix

    let mut reader = std::io::BufReader::new(file);
    let mut line = String::new();
    reader.read_to_string(&mut line)?;

    let trimmed = line.trim();
    if trimmed.is_empty() {
         return Ok(("0".repeat(64), 0));
    }

    let entry: TraceEntry = serde_json::from_str(trimmed)
        .context("Failed to parse last line of trace log during recovery")?;

    Ok((entry.hash, entry.i + 1))
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
        Value::Array(arr) => {
            Value::Array(arr.iter().map(canonicalize_json).collect())
        }
        _ => v.clone(),
    }
}

fn canonical_json_bytes(frame: &Value) -> anyhow::Result<Vec<u8>> {
    let canon = canonicalize_json(frame);
    let bytes = serde_json::to_vec(&canon)?;
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{BufRead, BufReader};
    use tempfile::NamedTempFile;

    #[tokio::test]
    async fn test_trace_chain_integrity() -> Result<()> {
        let temp_file = NamedTempFile::new()?;
        let path = temp_file.path().to_owned();
        let logger = TraceLogger::new(&path).await?;

        let msg1 = serde_json::json!({"b": 2, "a": 1});
        logger.log("in", "s1", &msg1).await?;

        let msg2 = serde_json::json!({"z": 9, "y": 8});
        logger.log("out", "s1", &msg2).await?;

        let file = std::fs::File::open(&path)?;
        let reader = BufReader::new(file);
        let lines: Vec<String> = reader.lines().collect::<Result<_, _>>()?;

        assert_eq!(lines.len(), 2);

        let entry1: TraceEntry = serde_json::from_str(&lines[0])?;
        assert_eq!(entry1.i, 0);
        assert_eq!(entry1.prev_hash, "0".repeat(64));

        let frame1_bytes = canonical_json_bytes(&entry1.frame)?;
        let mut hasher1 = Sha256::new();
        hasher1.update(entry1.prev_hash.as_bytes());
        hasher1.update(&frame1_bytes);
        assert_eq!(entry1.hash, format!("{:x}", hasher1.finalize()));

        let entry2: TraceEntry = serde_json::from_str(&lines[1])?;
        assert_eq!(entry2.i, 1);
        assert_eq!(entry2.prev_hash, entry1.hash);

        let frame2_bytes = canonical_json_bytes(&entry2.frame)?;
        let mut hasher2 = Sha256::new();
        hasher2.update(entry2.prev_hash.as_bytes());
        hasher2.update(&frame2_bytes);
        assert_eq!(entry2.hash, format!("{:x}", hasher2.finalize()));

        Ok(())
    }

    #[tokio::test]
    async fn test_signing() -> Result<()> {
        let temp_file = NamedTempFile::new()?;
        let path = temp_file.path().to_owned();

        // Generate a random key for testing
        let mut csprng = rand::rngs::OsRng;
        let signing_key = SigningKey::generate(&mut csprng);
        let key_bytes = signing_key.to_bytes();
        let key_hex = hex::encode(key_bytes);

        // Set env var for logger
        std::env::set_var("NODE_SIGNING_KEY", key_hex);

        let logger = TraceLogger::new(&path).await?;
        logger.log("in", "s1", &serde_json::json!({"msg": "signed"})).await?;

        let file = std::fs::File::open(&path)?;
        let reader = BufReader::new(file);
        let lines: Vec<String> = reader.lines().collect::<Result<_, _>>()?;

        let entry: TraceEntry = serde_json::from_str(&lines[0])?;
        assert!(entry.signature.is_some());
        assert_eq!(entry.alg, Some("ed25519".to_string()));

        std::env::remove_var("NODE_SIGNING_KEY");
        Ok(())
    }
}
