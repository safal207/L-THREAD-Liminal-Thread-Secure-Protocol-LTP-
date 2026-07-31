use ltp_client::serialize_canonical;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{env, fs, path::Path};

#[derive(Deserialize)]
struct Limits {
    max_input_bytes: usize,
    max_depth: usize,
}

#[derive(Deserialize)]
struct CorpusCase {
    id: String,
    category: String,
    raw_json: String,
}

#[derive(Deserialize)]
struct Corpus {
    corpus_digest: String,
    limits: Limits,
    cases: Vec<CorpusCase>,
}

#[derive(Serialize)]
struct CaseResult {
    id: String,
    category: String,
    verdict: &'static str,
    reason: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    canonical_digest: Option<String>,
}

#[derive(Serialize)]
struct Report<'a> {
    schema_version: u8,
    profile: &'static str,
    sdk: &'static str,
    corpus_digest: &'a str,
    limits: LimitsOutput,
    results: Vec<CaseResult>,
}

#[derive(Serialize)]
struct LimitsOutput {
    max_input_bytes: usize,
    max_depth: usize,
}

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

fn rejected(entry: &CorpusCase, reason: &'static str) -> CaseResult {
    CaseResult {
        id: entry.id.clone(),
        category: entry.category.clone(),
        verdict: "REJECTED",
        reason,
        canonical_digest: None,
    }
}

fn classify(entry: &CorpusCase, limits: &Limits) -> CaseResult {
    if entry.raw_json.as_bytes().len() > limits.max_input_bytes {
        return rejected(entry, "INPUT_TOO_LARGE");
    }

    let parsed: Value = match serde_json::from_str(&entry.raw_json) {
        Ok(value) => value,
        Err(_) => return rejected(entry, "INVALID_JSON"),
    };
    if value_depth(&parsed, 0) > limits.max_depth {
        return rejected(entry, "MAX_DEPTH_EXCEEDED");
    }
    if !parsed.is_object() {
        return rejected(entry, "CANONICAL_REJECTED");
    }

    match serialize_canonical(&parsed) {
        Ok(canonical) => {
            let digest = Sha256::digest(canonical.as_bytes());
            CaseResult {
                id: entry.id.clone(),
                category: entry.category.clone(),
                verdict: "ACCEPTED",
                reason: "ACCEPTED",
                canonical_digest: Some(hex::encode(digest)),
            }
        }
        Err(_) => rejected(entry, "CANONICAL_REJECTED"),
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();
    if args.len() != 3 {
        return Err("usage: wp6_differential <corpus.json> <output.json>".into());
    }

    let corpus: Corpus = serde_json::from_str(&fs::read_to_string(Path::new(&args[1]))?)?;
    let results = corpus
        .cases
        .iter()
        .map(|entry| classify(entry, &corpus.limits))
        .collect();
    let report = Report {
        schema_version: 1,
        profile: "org.ltp.wp6.sdk-differential-report.v1",
        sdk: "rust",
        corpus_digest: &corpus.corpus_digest,
        limits: LimitsOutput {
            max_input_bytes: corpus.limits.max_input_bytes,
            max_depth: corpus.limits.max_depth,
        },
        results,
    };
    fs::write(Path::new(&args[2]), format!("{}\n", serde_json::to_string_pretty(&report)?))?;
    Ok(())
}
