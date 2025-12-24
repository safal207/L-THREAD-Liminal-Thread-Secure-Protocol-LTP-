# What LTP Does NOT Do

It is crucial to understand the boundaries of the protocol. LTP is the **Traffic Control System**, not the **Driver** or the **Car**.

### 1. LTP is NOT an AI Model
*   LTP does not "know" what hate speech is.
*   It does not "watch" video pixels to detect nudity.
*   **What it does:** It asks *your* existing detection models (e.g., Azure Content Safety, OpenAI Mod API) for a score, and then **enforces** the decision based on that score.

### 2. LTP is NOT a Platform API
*   LTP does not replace the Twitch API or YouTube Data API.
*   It does not handle video encoding, RTMP ingestion, or chat websocket connections.
*   **What it does:** It sits *behind* the API, managing the logic flow of "Should I allow this API call?"

### 3. LTP is NOT Automatic Censorship
*   LTP has no opinions. It enforces *your* rules.
*   If you set a policy to "Allow Everything," LTP will faithfully record that you allowed toxic content.
*   **What it does:** It makes your policy choices **transparent and irrevocable**. You cannot hide that you allowed it.

### 4. LTP Cannot Stop Physical Reality
*   If a streamer physically shouts something into a microphone, LTP cannot stop the sound waves (unless the stream has a delay buffer integrated with LTP).
*   **What it does:** For *synthetic* or *mediated* events (AI text, TTS, chat messages, ad inserts), it provides absolute control. For live physical feeds, it provides an audit log of when/why the feed was cut.
