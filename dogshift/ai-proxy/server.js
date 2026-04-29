import express from "express";

const app = express();
app.use(express.json());

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

console.log("SERVER STARTING...");

app.post("/v1/chat/completions", async (req, res) => {
  try {
    const messages = (req.body.messages || []).map((msg) => {
      const content = Array.isArray(msg.content)
        ? msg.content
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("\n")
        : msg.content;

      return { role: msg.role, content };
    });

    const body = {
      model: "deepseek-chat",
      messages,
    };

    const r = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + DEEPSEEK_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await r.json();
    res.json(data);
  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({ error: "proxy failed" });
  }
});

app.listen(3001, () => {
  console.log("Proxy OK http://localhost:3001");
});
