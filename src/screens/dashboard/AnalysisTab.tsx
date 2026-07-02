import { useNavigate } from "react-router-dom";
import { useStore, type StockStyle } from "../../store/useStore";
import { eur } from "../../data/format";

const TYPE_CLS: Record<StockStyle, string> = { growth: "an-growth", cyclical: "an-cyclical", defensive: "an-defensive", neutral: "an-neutral" };

// P/E 14–16 is considered "normal" and doesn't tilt the aggressiveness scale.
const PE_NEUTRAL_LO = 14;
const PE_NEUTRAL_HI = 16;

/** Analysis of the individual-stock portfolio: composition by user-set company
 *  type (Growth / Cyclical / Defensive / Neutral), portfolio P/E, and two 0–100 scales:
 *  • Aggressiveness — growth share tilts up, defensive share down (±50); the
 *    portfolio P/E adds up to ±20 outside the neutral 14–16 band; loss-making
 *    holdings tilt toward aggressive (up to +20 by value share).
 *  • Macro risk — the BALANCE of cyclical vs defensive value (50 = neutral).
 *  Neutral and unclassified stocks are average in both scales. */
export default function AnalysisTab() {
  const navigate = useNavigate();
  const stocks = useStore((s) => s.portfolio.analysisStocks);
  const stockStyles = useStore((s) => s.stockStyles);
  const setStockStyle = useStore((s) => s.setStockStyle);

  const total = stocks.reduce((s, h) => s + h.value, 0);
  const share = (st: StockStyle | null) =>
    total > 0
      ? stocks.filter((h) => (stockStyles[h.isin] ?? null) === st).reduce((s, h) => s + h.value, 0) / total
      : 0;
  const growth = share("growth");
  const cyclical = share("cyclical");
  const defensive = share("defensive");
  const neutral = share("neutral");
  const unclassified = share(null);

  // portfolio P/E — harmonic value-weighted (Σ value ÷ Σ earnings), the standard
  // convention: it equals total value over total earnings of the covered stocks.
  const covered = stocks.filter((h) => h.pe != null && h.pe > 0);
  const coveredValue = covered.reduce((s, h) => s + h.value, 0);
  const earnings = covered.reduce((s, h) => s + h.value / (h.pe as number), 0);
  const portPe = earnings > 0 ? coveredValue / earnings : null;
  const peCoverage = total > 0 ? (coveredValue / total) * 100 : 0;

  // aggressiveness 0–100: 50 neutral + composition tilt ±50 + P/E tilt ±20
  // + loss-making tilt (negative earnings → aggressive, up to +20 by value share)
  let peTilt = 0;
  if (portPe != null) {
    if (portPe > PE_NEUTRAL_HI) peTilt = Math.min((portPe - PE_NEUTRAL_HI) / PE_NEUTRAL_HI, 1) * 20;
    else if (portPe < PE_NEUTRAL_LO) peTilt = -Math.min((PE_NEUTRAL_LO - portPe) / (PE_NEUTRAL_LO / 2), 1) * 20;
  }
  const lossShare = total > 0 ? stocks.filter((h) => h.peSrc === "loss-making").reduce((s, h) => s + h.value, 0) / total : 0;
  const lossTilt = lossShare * 20;
  const aggr = Math.max(0, Math.min(100, 50 + (growth - defensive) * 50 + peTilt + lossTilt));
  const aggrLabel = aggr >= 70 ? "Aggressive" : aggr >= 55 ? "Moderately aggressive" : aggr > 45 ? "Balanced" : aggr > 30 ? "Moderately defensive" : "Defensive";

  // macro risk 0–100: centered — the balance of cyclical vs defensive value.
  // Growth, Neutral and Unclassified count as average (they don't tilt the scale).
  const macro = Math.max(0, Math.min(100, 50 + (cyclical - defensive) * 50));
  const macroLabel = macro >= 70 ? "High" : macro >= 55 ? "Elevated" : macro > 45 ? "Balanced" : macro > 30 ? "Moderately low" : "Low";

  const pct = (v: number) => (v * 100).toFixed(1) + "%";
  const rows = [...stocks].sort((a, b) => b.value - a.value);

  return (
    <>
      <div className="kstrip k5an">
        <Kpi k="Portfolio P/E (stocks)" v={portPe != null ? portPe.toFixed(1) : "—"} sub={portPe != null ? `covers ${peCoverage.toFixed(0)}% of stock value` : "no P/E data"} />
        <Kpi k="Growth" v={pct(growth)} cls="an-growth" />
        <Kpi k="Cyclical" v={pct(cyclical)} cls="an-cyclical" />
        <Kpi k="Defensive" v={pct(defensive)} cls="an-defensive" />
        <Kpi k="Neutral" v={pct(neutral)} cls="an-neutral" />
      </div>

      <div className="row2b">
        <ScaleCard
          title="Aggressiveness"
          score={aggr}
          label={aggrLabel}
          left="Defensive"
          right="Aggressive"
          hint={`Growth share pushes up, defensive share down; portfolio P/E outside ${PE_NEUTRAL_LO}–${PE_NEUTRAL_HI} tilts the scale (${peTilt >= 0 ? "+" : ""}${peTilt.toFixed(0)} now)${lossTilt > 0.5 ? `; loss-making holdings add +${lossTilt.toFixed(0)}` : ""}.`}
        />
        <ScaleCard
          title="Macro risk"
          score={macro}
          label={macroLabel}
          left="Low"
          right="High"
          hint="The balance of cyclical vs defensive value in your stock portfolio — 50 is neutral. Growth, Neutral and Unclassified don't tilt the scale."
        />
      </div>

      {unclassified > 0.005 && (
        <div className="card an-note">
          <b>{pct(unclassified)}</b> of your stock value is unclassified — it counts as neutral in both scales. Set the
          company type below or on each company's page.
        </div>
      )}

      <div className="card antable">
        <div className="anhead">
          <span>Stock</span>
          <span className="r">P/E</span>
          <span className="c">Type</span>
          <span className="r">Value</span>
          <span className="r">Weight</span>
        </div>
        {rows.map((h) => {
          const st = stockStyles[h.isin] ?? null;
          return (
            <div className="anrow" key={h.isin}>
              <span className="anco" onClick={() => navigate(`/company/${encodeURIComponent(h.ticker)}`)}>
                <b className="num">{h.ticker}</b>
                <span className="anconame">{h.name}</span>
              </span>
              <span className="num r" title={h.peSrc !== "—" ? h.peSrc : undefined}>{h.peStr}</span>
              <span className="c">
                <select
                  className={"ansel" + (st ? " " + TYPE_CLS[st] : "")}
                  value={st ?? ""}
                  onChange={(e) => setStockStyle(h.isin, (e.target.value || null) as StockStyle | null)}
                >
                  <option value="">Unclassified</option>
                  <option value="growth">Growth</option>
                  <option value="cyclical">Cyclical</option>
                  <option value="defensive">Defensive</option>
                  <option value="neutral">Neutral</option>
                </select>
              </span>
              <span className="num r">{h.valueStr}</span>
              <span className="num r">{h.weightStr}</span>
            </div>
          );
        })}
        {!rows.length && <div className="emptyhint" style={{ padding: "18px" }}>No individual stocks in the portfolio.</div>}
      </div>

      <div className="srcnote">
        Individual stocks only; weights are shares of the stock portfolio ({eur(total)}). P/E is the current price ÷
        Inderes current-year EPS estimate, falling back to Yahoo Finance trailing P/E; loss-making companies show
        "neg.", are excluded from the portfolio P/E, and tilt the aggressiveness scale up. Company types are your own
        classifications, saved to your account — Neutral counts as average in both scales. Portfolio P/E is
        value-weighted (total value ÷ total earnings).
      </div>
    </>
  );
}

function Kpi({ k, v, sub, cls = "" }: { k: string; v: string; sub?: string; cls?: string }) {
  return (
    <div className="kc">
      <div className="klbl">{k}</div>
      <div className={"knum num " + cls}>{v}</div>
      {sub && <div className="ansub">{sub}</div>}
    </div>
  );
}

function ScaleCard({ title, score, label, left, right, hint }: { title: string; score: number; label: string; left: string; right: string; hint: string }) {
  return (
    <div className="card anscale">
      <div className="cardhd sm">
        <span className="cardttl sm">{title}</span>
        <span className="anscore">
          <b className="num">{Math.round(score)}</b>/100 · {label}
        </span>
      </div>
      <div className="antrack">
        <div className="anmark" style={{ left: score + "%" }} />
      </div>
      <div className="anends">
        <span>{left}</span>
        <span>{right}</span>
      </div>
      <div className="modehint">{hint}</div>
    </div>
  );
}
