use ltp_client::serialize_canonical;
use serde_json::Value;

#[test]
fn canonical_envelope_v1_matches_shared_golden_vector() {
    let fixture: Value = serde_json::from_str(include_str!(
        "../../../../tests/security/canonical-envelope-v1.json"
    ))
    .expect("fixture must be valid JSON");
    let expected = include_str!("../../../../tests/security/canonical-envelope-v1.txt").trim_end();
    assert_eq!(serialize_canonical(&fixture).unwrap(), expected);
}

#[test]
fn canonical_envelope_v1_rejects_unsafe_integer() {
    let fixture = serde_json::json!({"payload": {"unsafe": 9_007_199_254_740_992_u64}});
    assert!(serialize_canonical(&fixture).is_err());
}
