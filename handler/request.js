import { LLM_TASKS } from "../ds/folder.js";

const LLM_ENDPOINT = "http://localhost:11434/api/chat"; // Ollama / Qwen server

async function streamFromLLM(messages, callback_url, request_id, user) {
  console.log(messages);
  const res = await fetch(LLM_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "qwen2.5", messages, stream: true }),
  });

  if (!res.ok) throw new Error(await res.text());
  if (!res.body) throw new Error("Streaming not supported");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalText = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop(); // keep incomplete JSON

    for (const line of lines) {
      if (!line.trim()) continue;

      let json;
      try {
        json = JSON.parse(line);
      } catch {
        continue; // ignore malformed chunks
      }

      if (json.message?.content) {
        finalText += json.message.content;
        console.log(finalText);
      }
    }
  }

  // Update task as completed
  await (
    await LLM_TASKS()
  ).updateOne(
    { _id: request_id },
    {
      $set: { status: "completed", output: finalText, completedAt: new Date() },
    },
  );

  // Call the callback URL with the final result
  try {
    await fetch(callback_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ request_id, user, output: finalText }),
    });
    console.log(`[LLM] Callback sent for request ${request_id}`);
  } catch (err) {
    console.error("Error sending callback:", err);
  }
}

const request = async (req, res) => {
  const { user, messages, callback_url, request_id } = req.body;
  if (!user || !messages || !callback_url || !request_id) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Save initial task
  await (
    await LLM_TASKS()
  ).insertOne({
    _id: request_id,
    user,
    messages,
    status: "processing",
    createdAt: new Date(),
  });

  // Respond immediately so agent is not blocked
  res.json({ status: "ok", request_id });

  // Start streaming from LLM
  streamFromLLM(messages, callback_url, request_id, user).catch((err) => {
    console.error("Streaming error:", err);
    LLM_TASKS().then((Tasks) => {
      Tasks.updateOne(
        { _id: request_id },
        { $set: { status: "failed", error: err.message } },
      );
    });
  });
};

export { request };
