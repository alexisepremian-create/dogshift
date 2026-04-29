import express, { type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";

const app = express();
const PORT = process.env.PORT ?? 4000;

// ── Middleware ──────────────────────────────────────────────────────────────

app.use(helmet());
app.use(cors());
app.use(express.json());

// ── Routes ─────────────────────────────────────────────────────────────────

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/hello", (req: Request, res: Response) => {
  const name = req.query.name ?? "World";
  res.json({ message: `Hello, ${name}!` });
});

// ── 404 handler ────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Not found" });
});

// ── Start server ───────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

export default app;
