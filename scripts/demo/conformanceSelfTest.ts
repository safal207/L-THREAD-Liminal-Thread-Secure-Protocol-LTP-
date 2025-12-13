import http from "http";

const port = Number(process.env.PORT) || 4000;
const mode = process.argv[2] ?? "calm";

http
  .get({
    host: "127.0.0.1",
    port,
    path: `/conformance/self-test?mode=${encodeURIComponent(mode)}`,
    headers: { Accept: "application/json" },
  })
  .on("response", (res) => {
    const chunks: Buffer[] = [];
    res.on("data", (chunk) => chunks.push(chunk));
    res.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf-8");
      console.log(body);
      process.exitCode = res.statusCode && res.statusCode >= 400 ? 1 : 0;
    });
  })
  .on("error", (error) => {
    console.error("Failed to request self-test endpoint", error);
    process.exitCode = 1;
  });
