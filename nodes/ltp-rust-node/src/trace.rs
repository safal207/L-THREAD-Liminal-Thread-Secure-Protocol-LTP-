use anyhow::{Context, Result};
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

pub struct TraceLogger {
    file: Mutex<File>,
    last_hash: Mutex<String>,
    counter: Mutex<u64>,
}

impl TraceLogger {
    pub async fn new<P: AsRef<Path>>(path: P) -> Result<Self> {
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .read(true) // Need read to recover state
            .open(&path)
            .await?;

        // Recover state from the last line of the file
        // Since we are in async context and need to initialize, let's use std::fs for initial sync read (startup phase)
        // or implementing async backward reading.
        // For simplicity and correctness in v0.1: use std::fs to read last line synchronously before wrapping in tokio File.
        // But we already opened it as tokio file.
        // Let's close and re-open or just use std::fs for recovery.

        let (last_hash, counter) = recover_state(path.as_ref())?;

        Ok(Self {
            file: Mutex::new(file),
            last_hash: Mutex::new(last_hash),
            counter: Mutex::new(counter),
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

        // Canonicalize (CPU bound) - could spawn_blocking but it's probably fast enough for small frames.
        // For strictness, if frames are huge, this should be offloaded. Assuming small frames for v0.1.
        let frame_bytes = canonical_json_bytes(&frame_json)?;

        let mut hasher = Sha256::new();
        hasher.update(prev_hash.as_bytes());
        hasher.update(&frame_bytes);

        let current_hash = format!("{:x}", hasher.finalize());
        *last_hash_guard = current_hash.clone();

        let entry = TraceEntry {
            i,
            timestamp_ms,
            direction: direction.to_string(),
            session_id: session_id.to_string(),
            frame: frame_json,
            prev_hash,
            hash: current_hash,
        };

        let mut file_guard = self.file.lock().await;
        let json_line = serde_json::to_string(&entry)?;
        file_guard.write_all(json_line.as_bytes()).await?;
        file_guard.write_all(b"\n").await?;
        file_guard.flush().await?; // Ensure written to OS buffer. fsync (sync_all) is safer but slower.

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

    // Naive implementation: seek to end and search backwards for newline
    // Optimization: read last N bytes.
    let mut pos = metadata.len() as i64;
    // Buffer removed as unused in my implementation below

    // Read backwards 4KB at a time
    let chunk_size = 4096;
    let mut last_line_end = pos; // The end of the file or just before trailing newline

    // Handle trailing newline if exists
    if pos > 0 {
        file.seek(SeekFrom::End(-1))?;
        let mut buf = [0u8; 1];
        file.read_exact(&mut buf)?;
        if buf[0] == b'\n' {
            pos -= 1;
            last_line_end = pos;
        }
    }

    // Now find the previous newline
    while pos > 0 {
        let read_len = std::cmp::min(pos, chunk_size) as usize;
        pos -= read_len as i64;
        file.seek(SeekFrom::Start(pos as u64))?;

        let mut chunk = vec![0u8; read_len];
        file.read_exact(&mut chunk)?;

        if let Some(idx) = chunk.iter().rposition(|&b| b == b'\n') {
            // Found the start of the last line
            pos += idx as i64 + 1;
            break;
        }
    }

    // Read the last line
    file.seek(SeekFrom::Start(pos as u64))?;
    let len = last_line_end - pos;
    if len <= 0 && pos == 0 && metadata.len() > 0 {
         // Special case: file has content but no newline, or just one line without trailing newline logic handled above
         // If len <= 0 here it might mean something weird or empty line logic.
         // Let's rely on BufReader logic for simpler "read all if small, else read tail"?
         // Actually, if we just rely on parsing the last non-empty line.
    }

    // Let's re-use BufReader from the seek position
    let mut reader = std::io::BufReader::new(file);
    let mut line = String::new();
    reader.read_to_string(&mut line)?; // Read until EOF

    // Parse the last line (it might contain multiple lines if we read a chunk, but we positioned at the last newline)
    // Actually, `pos` points to start of last line. `read_to_string` reads everything from there.
    // If the file ends with newline, `line` will be the content of last line + newline (if we adjusted logic correctly).

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

        // Verify hash 1
        let frame1_bytes = canonical_json_bytes(&entry1.frame)?;
        let mut hasher1 = Sha256::new();
        hasher1.update(entry1.prev_hash.as_bytes());
        hasher1.update(&frame1_bytes);
        assert_eq!(entry1.hash, format!("{:x}", hasher1.finalize()));

        let entry2: TraceEntry = serde_json::from_str(&lines[1])?;
        assert_eq!(entry2.i, 1);
        assert_eq!(entry2.prev_hash, entry1.hash);

        // Verify hash 2
        let frame2_bytes = canonical_json_bytes(&entry2.frame)?;
        let mut hasher2 = Sha256::new();
        hasher2.update(entry2.prev_hash.as_bytes());
        hasher2.update(&frame2_bytes);
        assert_eq!(entry2.hash, format!("{:x}", hasher2.finalize()));

        Ok(())
    }

    #[tokio::test]
    async fn test_tamper_detection() -> Result<()> {
        let temp_file = NamedTempFile::new()?;
        let path = temp_file.path().to_owned();
        let logger = TraceLogger::new(&path).await?;

        logger.log("in", "s1", &serde_json::json!({"a": 1})).await?;
        logger.log("out", "s1", &serde_json::json!({"b": 2})).await?;

        let file = std::fs::File::open(&path)?;
        let reader = BufReader::new(file);
        let mut lines: Vec<String> = reader.lines().collect::<Result<_, _>>()?;

        // Tamper with the first frame content
        let mut entry1: TraceEntry = serde_json::from_str(&lines[0])?;
        entry1.frame = serde_json::json!({"a": 999}); // changed value
        lines[0] = serde_json::to_string(&entry1)?;

        // Verification logic
        let e1: TraceEntry = serde_json::from_str(&lines[0])?;
        // e2 is unused in test logic but needed for continuity check if we were running full verify
        let _e2: TraceEntry = serde_json::from_str(&lines[1])?;

        // Check 1
        let fb1 = canonical_json_bytes(&e1.frame)?;
        let mut h1 = Sha256::new();
        h1.update(e1.prev_hash.as_bytes());
        h1.update(&fb1);
        let computed_h1 = format!("{:x}", h1.finalize());

        assert_ne!(computed_h1, e1.hash);

        Ok(())
    }

    #[tokio::test]
    async fn test_persistence_recovery() -> Result<()> {
        let temp_file = NamedTempFile::new()?;
        let path = temp_file.path().to_owned();

        // First session
        {
            let logger = TraceLogger::new(&path).await?;
            logger.log("in", "s1", &serde_json::json!({"msg": 1})).await?;
        } // logger drops, file closed

        // Second session
        {
            let logger = TraceLogger::new(&path).await?;
            logger.log("out", "s1", &serde_json::json!({"msg": 2})).await?;
        }

        let file = std::fs::File::open(&path)?;
        let reader = BufReader::new(file);
        let lines: Vec<String> = reader.lines().collect::<Result<_, _>>()?;

        assert_eq!(lines.len(), 2);

        let entry1: TraceEntry = serde_json::from_str(&lines[0])?;
        let entry2: TraceEntry = serde_json::from_str(&lines[1])?;

        assert_eq!(entry1.i, 0);
        assert_eq!(entry2.i, 1);
        assert_eq!(entry2.prev_hash, entry1.hash); // Linkage preserved

        Ok(())
    }
}
