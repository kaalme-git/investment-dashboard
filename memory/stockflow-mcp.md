---
name: stockflow-mcp
description: The stockflow (Yahoo Finance) MCP server added for market data — location, fixes, quirks
metadata:
  type: reference
---

Added the **stockflow** MCP server (github.com/twolven/mcp-stockflow, Yahoo Finance via yfinance) for market data, per user request.

- Cloned to `C:/Users/KasperMellas/mcp-servers/mcp-stockflow` (OUTSIDE the OneDrive app folder). Isolated venv at `.venv`.
- Registered in project-scoped `.mcp.json` at the dashboard repo root (server name `stockflow`; command = venv python + stockflow.py). `.mcp.json` is in `.vercelignore`.
- **Fix applied:** repo pins `yfinance==0.2.36` which is BROKEN against 2026 Yahoo ("Expecting value: line 1 column 1" JSON error, even for AAPL). Upgraded the venv to **yfinance 1.5.1** (+curl_cffi) → works. If deps are ever reinstalled from requirements.txt, re-upgrade yfinance.
- Tools: `get_stock_data_v2` (info: price/sector/currency/name/marketcap/ratings), `get_historical_data_v2`, `get_options_chain_v2`. Input param is `symbol`.
- **Finnish/Nordic tickers need the exchange suffix** (Yahoo): e.g. `NESTE.HE`, `KNEBV.HE` (Helsinki `.HE`, Stockholm `.ST`). The Nordnet export only has ISINs — ISIN→Yahoo-ticker mapping is NOT provided, so wiring holdings to prices needs a mapping step. Yahoo coverage of Finnish small-caps (Inderes, Boreo, Fondia, Easor, CapMan) is uncertain; the [[dev-environment]] `inderes-api` skill / inderes-private MCP is better for Finnish coverage + ISIN.
- MCP servers load at Claude Code **startup** — after adding `.mcp.json` the user must restart/reload Claude Code and approve the new `stockflow` server before its tools are callable. **NOW ACTIVE (user restarted 2026-07-01):** tools `mcp__stockflow__get_stock_data_v2` + `get_historical_data_v2` (period+interval, e.g. 5y/1wk) work. Yahoo resolves funds by **ISIN as the symbol** — e.g. `IE00BMTD2M99` → "Nordnet Eurooppa Indeksi" €182.12. Used to value the Nordnet index fund at market on the dashboard (was stuck at cost; +5.4%).
- Caveat: an MCP server is a DEV-TIME tool for the agent; the deployed web app can't call it directly. To show live prices in the cloud app, bake fetched data into the data layer or add a backend endpoint.
