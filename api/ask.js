// Vercel serverless function: POST /api/ask { question, context } → { answer }.
// Thin HTTP wrapper — the logic (Groq call, auth check, guards) lives in _lib/ask.mjs
// so the local dev server can share it.
import { answerQuestion } from "./_lib/ask.mjs";

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "POST only" }); return; }
  const { question, context } = req.body || {};
  const out = await answerQuestion({ question, context, authHeader: req.headers.authorization });
  res.status(out.status).json(out.body);
}
