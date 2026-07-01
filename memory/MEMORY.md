# Memory index

- [Dev environment](dev-environment.md) — how to run/build/screenshot the dashboard; Node is portable, not system-installed
- [Build plan & decisions](build-plan-decisions.md) — approved plan, Vercel + stubbed-AI decisions, screen build order, real-data importer
- [stockflow MCP](stockflow-mcp.md) — Yahoo Finance market-data MCP server: location, yfinance-version fix, .HE suffix quirk
- [Dynamic architecture](dynamic-architecture.md) — live pipeline: transactions → /api/prices (Yahoo resolver) → buildPortfolio; generic, no hardcoded ISINs
- [Accounts & cache](accounts-and-cache.md) — Supabase multi-user (auth + per-user transactions) + shared incremental price cache; env vars, tables, keep-alive cron
