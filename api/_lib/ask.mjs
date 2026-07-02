// Portfolio Q&A via Groq's free-tier API (OpenAI-compatible). Zero inference
// cost: the free tier is generous enough for a small multi-user dashboard.
// The GROQ_API_KEY lives server-side only; callers must be signed-in users of
// THIS app (Supabase access token verified below) so strangers can't burn the
// shared free quota.
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

const SYSTEM = [
  "You are the analyst assistant inside a personal investment dashboard.",
  "You receive the user's live portfolio as a JSON snapshot and a question about it.",
  "Rules:",
  "- Ground every statement ONLY in the snapshot. Never invent holdings, prices or numbers.",
  "- All values are preformatted strings (EUR amounts, percentages). Quote them as-is; do NOT derive new percentages, sums or ratios yourself unless the arithmetic is trivial and necessary.",
  "- Answer in 3-6 measured, number-specific sentences of plain prose. No headers, bullets or markdown.",
  "- Frame everything as educational analysis, never personalised investment advice; no buy/sell instructions.",
  "- Amounts are EUR; use one decimal for percentages.",
  "- If the snapshot lacks the data to answer, say exactly what is missing.",
  "- If the question is unrelated to this portfolio or investing, decline in one sentence.",
  "",
  "Data legend — use these exact definitions, do not guess:",
  "- holdings[].weight = share of the WHOLE portfolio. stockAnalysis[].weightOfStocks = share of the individual-stock portion only. Never mix the two bases.",
  "- holdings[].totalReturn = return since purchase vs average cost, INCLUDING dividends received; not annualised and not time-weighted.",
  "- performance = TIME-WEIGHTED return (Nordnet convention: deposits/withdrawals excluded, since-sold instruments included) vs the named benchmark, per period. Use THIS for 'how have I performed' questions, not totalReturn.",
  "- holdings[].fwdDivYield = forward dividend yield: next year's Inderes analyst dividend estimate / current price (falls back to trailing figures where no estimate exists).",
  "- holdings[].inderesRec = current Inderes analyst recommendation; '—' means not covered by Inderes.",
  "- stockAnalysis[].pe = current price / Inderes current-year EPS estimate, else Yahoo trailing P/E. 'neg.' = loss-making: no meaningful P/E, excluded from the portfolio P/E.",
  "- stockAnalysis[].companyType = the user's own Growth/Cyclical/Defensive/Neutral classification; 'unclassified' = not labelled yet (neutral in analyses).",
  "- allocationPct.style = Active/Passive/Cash shares of the whole portfolio. targetAllocation.Active and .Passive are targets as a share of INVESTED assets (cash excluded); the other targetAllocation keys are asset-class targets for the whole portfolio.",
  "- dividendsByYear: actual = dividends received that calendar year; estimated = for the current year the analyst-estimated remainder on top of actual, for future years the full-year estimate.",
  "- valueBridge = APPROXIMATE decomposition of how the current value was reached; its components sum exactly to currentValue. netDeposits = cash in minus out (transactions the user marked as excluded, e.g. IPO subscription payments, are removed). inKindTransfers = securities received in kind at acquisition value, with corporate-action swaps netted and excluded subscription payments deducted. dividendsGross + withholdingTax together give net dividend income. marketReturnsEUR is a RESIDUAL: euro-denominated price returns including trading costs and corporate-action effects. Use valueBridge ONLY for 'where did my value come from / how did I get here' questions, and mention that market returns are a residual approximation.",
].join("\n");

/** Answer a portfolio question. Returns { status, body } for the HTTP layer. */
export async function answerQuestion({ question, context, authHeader }) {
  if (!process.env.GROQ_API_KEY) {
    return { status: 503, body: { error: "The assistant isn't configured yet (missing GROQ_API_KEY)." } };
  }
  const q = String(question || "").trim();
  if (!q) return { status: 400, body: { error: "Empty question." } };
  if (q.length > 600) return { status: 400, body: { error: "Please keep the question under 600 characters." } };
  let ctx = "{}";
  try { ctx = JSON.stringify(context ?? {}); } catch { /* keep {} */ }
  if (ctx.length > 24000) return { status: 400, body: { error: "Portfolio context too large." } };

  // only signed-in users of this app may spend the shared free-tier quota
  const supaUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supaKey = process.env.SUPABASE_SECRET_KEY || process.env.VITE_SUPABASE_PUBLIC_KEY;
  if (supaUrl && supaKey) {
    const token = String(authHeader || "").replace(/^Bearer\s+/i, "");
    if (!token) return { status: 401, body: { error: "Sign in to use the assistant." } };
    try {
      const vr = await fetch(`${supaUrl}/auth/v1/user`, { headers: { apikey: supaKey, Authorization: `Bearer ${token}` } });
      if (!vr.ok) return { status: 401, body: { error: "Sign in to use the assistant." } };
    } catch {
      return { status: 502, body: { error: "Could not verify your session — try again." } };
    }
  }

  let res;
  try {
    res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        max_tokens: 500,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: `Portfolio snapshot (JSON):\n${ctx}\n\nQuestion: ${q}` },
        ],
      }),
    });
  } catch {
    return { status: 502, body: { error: "The AI backend is unreachable — try again shortly." } };
  }
  if (res.status === 429) {
    return { status: 429, body: { error: "The assistant is busy (free-tier rate limit) — try again in a minute." } };
  }
  if (!res.ok) return { status: 502, body: { error: "The AI backend returned an error — try again shortly." } };
  const j = await res.json().catch(() => null);
  const answer = j?.choices?.[0]?.message?.content?.trim();
  if (!answer) return { status: 502, body: { error: "The AI backend returned an empty answer — try again." } };
  return { status: 200, body: { answer } };
}
