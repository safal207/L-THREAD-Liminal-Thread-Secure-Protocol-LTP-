const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// --- Helper Functions ---

function canonicalize(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(canonicalize);
  }
  const sorted = {};
  Object.keys(obj).sort().forEach(key => {
    sorted[key] = canonicalize(obj[key]);
  });
  return sorted;
}

function generateAuditLog(frames, keyId = "stream-key-1") {
  const entries = [];
  let prevHash = "0".repeat(64);

  // Start timestamps relative to now for realism
  const startTime = new Date();

  frames.forEach((frame, index) => {
    // Adjust timestamp if not provided
    if (!frame.ts) {
        frame.ts = new Date(startTime.getTime() + index * 1000).toISOString();
    }

    // Ensure standard fields
    if (!frame.v) frame.v = "0.1";
    if (!frame.id) frame.id = `frame-${index + 1}`;

    const entry = {
      ts: frame.ts,
      frame: frame,
      prev_hash: prevHash,
      signature: "SIMULATED_SIG_" + crypto.randomBytes(4).toString('hex'),
      key_id: keyId,
      alg: "ed25519"
    };

    const frameBytes = Buffer.from(JSON.stringify(canonicalize(frame)), 'utf8');
    const hasher = crypto.createHash('sha256');
    hasher.update(prevHash);
    hasher.update(frameBytes);
    const hash = hasher.digest('hex');

    entry.hash = hash;
    entries.push(entry);
    prevHash = hash;
  });

  return entries;
}

function writeTrace(filename, frames) {
    const log = generateAuditLog(frames);
    const jsonl = log.map(e => JSON.stringify(e)).join('\n');

    const dir = 'artifacts/traces/content';
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }

    const filepath = path.join(dir, filename);
    fs.writeFileSync(filepath, jsonl);
    console.log(`Generated ${filepath}`);
}

// --- Scenarios ---

// 1. Safe Stream (Live-stream + AI co-host)
const safeStreamFrames = [
    { type: "hello", payload: { agent: "LTP-Stream-Guardian", version: "1.0", stream_id: "live_8823" } },
    { type: "heartbeat", payload: { state: "streaming", viewers: 1205, sentiment: "positive" } },
    // Event: User Chat
    { type: "heartbeat", payload: { event: "chat_message", user: "Viewer42", content: "Hello AI! Any tips for the game?" } },
    // Goal
    { type: "orientation", payload: { goal: "assist_user", context: "gaming_stream" } },
    // AI Proposal
    { type: "route_request", payload: { target: "send_chat_response", content: "Hi Viewer42! Try checking the hidden chest behind the waterfall." } },
    // Admissibility Check
    {
        type: "route_response",
        payload: {
            branches: [
                { id: "b1", confidence: 0.99, status: "admissible", reason: "content_safe" }
            ]
        }
    }
];

// 2. Blocked AI Joke (AI prevented from being toxic)
const blockedAiFrames = [
    { type: "hello", payload: { agent: "LTP-Stream-Guardian", version: "1.0", stream_id: "live_9912" } },
    { type: "heartbeat", payload: { state: "streaming", viewers: 5400 } },
    // Event: User Request
    { type: "heartbeat", payload: { event: "chat_message", user: "TrollUser", content: "Tell me a spicy joke!" } },
    { type: "orientation", payload: { goal: "entertain", style: "humorous" } },

    // AI Proposal 1 (Toxic)
    {
        type: "route_request",
        payload: {
            target: "send_chat_response",
            content: "Why did the [ethnic group] cross the road? To steal the [offensive object]!"
        }
    },
    // Admissibility: BLOCKED
    {
        type: "route_response",
        payload: {
            branches: [
                {
                    id: "b1",
                    confidence: 0.0,
                    status: "blocked",
                    reason: "policy_violation:hate_speech",
                    policy_ref: "twitch_tos_v4.1"
                }
            ]
        }
    },

    // AI Proposal 2 (Recovery)
    {
        type: "route_request",
        payload: {
            target: "send_chat_response",
            content: "I can't tell that kind of joke. But why did the scarecrow win an award? Because he was outstanding in his field!"
        }
    },
    // Admissibility: ALLOWED
    {
        type: "route_response",
        payload: {
            branches: [
                { id: "b2", confidence: 1.0, status: "admissible", reason: "safe_content" }
            ]
        }
    }
];

// 3. Kids Mode (Family-safe enforcement)
const kidsModeFrames = [
    { type: "hello", payload: { agent: "LTP-Kids-Safe", version: "2.0", profile: "under_13" } },
    { type: "heartbeat", payload: { state: "watching", content_rating: "G", parental_controls: "strict" } },

    // Event: Stream tries to switch to generic feed which might be unsafe
    { type: "heartbeat", payload: { event: "algorithm_recommendation", video_id: "vid_666_horror", tags: ["scary", "blood"] } },

    { type: "orientation", payload: { goal: "autoplay_next" } },

    // Proposed Transition: Play Video
    {
        type: "route_request",
        payload: {
            target: "play_video",
            video_id: "vid_666_horror"
        }
    },

    // Admissibility: BLOCKED
    {
        type: "route_response",
        payload: {
            branches: [
                {
                    id: "branch_play",
                    confidence: 0.0,
                    status: "blocked",
                    reason: "policy_violation:kids_mode_strict",
                    details: "Content tags 'blood' not allowed in profile 'under_13'"
                },
                {
                    id: "branch_skip",
                    confidence: 1.0,
                    status: "admissible",
                    reason: "fallback_safe_content",
                    instruction: "skip_to_next_safe_video"
                }
            ]
        }
    }
];

// --- Execution ---

writeTrace('safe_stream.trace.jsonl', safeStreamFrames);
writeTrace('blocked_ai_joke.trace.jsonl', blockedAiFrames);
writeTrace('kids_mode.trace.jsonl', kidsModeFrames);
