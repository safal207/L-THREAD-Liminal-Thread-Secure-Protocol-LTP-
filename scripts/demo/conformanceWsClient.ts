import WebSocket from "ws";

const port = Number(process.env.WS_PORT) || 4002;
const mode = process.argv[2] ?? "calm";
const socket = new WebSocket(`ws://127.0.0.1:${port}/ws/conformance-self-test`);

socket.on("open", () => {
  socket.send(
    JSON.stringify({
      type: "conformance_self_test",
      v: "0.1",
      id: `req-${Date.now()}`,
      payload: { mode },
    }),
  );
});

socket.on("message", (data) => {
  try {
    const parsed = JSON.parse(data.toString());
    console.log(JSON.stringify(parsed, null, 2));
  } catch (error) {
    console.error("Failed to parse response", error);
  } finally {
    socket.close();
  }
});

socket.on("error", (error) => {
  console.error("WebSocket error", error);
});
