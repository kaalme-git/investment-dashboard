// Local dev API server — mirrors the Vercel /api/prices function so the app can
// fetch live prices during `npm run dev`. Vite proxies /api → this (port 5174).
// Loads .env.local so the shared Supabase price cache works locally too.
import http from "node:http";
import fs from "node:fs";

// minimal .env.local loader (Vite loads it for the client; Node needs it too)
try {
  for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#") || !s.includes("=")) continue;
    const i = s.indexOf("=");
    const k = s.slice(0, i).trim();
    const v = s.slice(i + 1).trim();
    if (!(k in process.env)) process.env[k] = v;
  }
} catch { /* no .env.local → direct-Yahoo fallback */ }

const { resolvePrices, cacheEnabled } = await import("./api/_lib/cache.mjs");

const PORT = 5174;
http
  .createServer((req, res) => {
    const u = new URL(req.url, "http://localhost");
    if (u.pathname !== "/api/prices") { res.writeHead(404); res.end(); return; }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      try {
        let isins = String(u.searchParams.get("isins") || "").split(",").map((s) => s.trim()).filter(Boolean);
        let start = u.searchParams.get("start") || "2021-06-01";
        let force = u.searchParams.get("force") === "1";
        if (body) { const b = JSON.parse(body); if (b.isins) isins = b.isins; if (b.start) start = b.start; if (b.force) force = true; }
        const data = await resolvePrices(isins, start, force);
        res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
        res.end(JSON.stringify({ data, generatedAt: new Date().toISOString() }));
      } catch (e) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: String(e?.message || e) }));
      }
    });
  })
  .listen(PORT, () => console.log(`dev price API on http://localhost:${PORT}/api/prices  (cache: ${cacheEnabled ? "Supabase" : "direct Yahoo"})`));
