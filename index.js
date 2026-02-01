import handler from "./LLM.js";
import http from "http";

let server = http.createServer(handler);

let port = process.env.PORT || 5000;

server.listen(port, "0.0.0.0", async () => {
  console.log(`LLM is listening on http://localhost:${port}`);
});
