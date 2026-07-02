import { useStore } from "../../../store/useStore";

const CHIPS = [
  { label: "How concentrated is it?", q: "How concentrated is my portfolio and is that a risk?" },
  { label: "Biggest risks?", q: "What are the biggest risks in my portfolio right now?" },
  { label: "Allocation vs targets", q: "How far is my current allocation from my targets, and what would rebalancing require?" },
  { label: "Growth or defensive tilt?", q: "Is my stock portfolio tilted toward growth, cyclical or defensive companies, and what does that imply?" },
  { label: "Following my strategy?", q: "Does my current portfolio follow the strategy I've written, and where does it deviate?" },
  { label: "Where did my value come from?", q: "Break down how my portfolio reached its current value — contributions, transferred shares, dividends and market returns — and put the market returns in context." },
];

export default function AskAi() {
  const ai = useStore((s) => s.ai);
  const setAiPrompt = useStore((s) => s.setAiPrompt);
  const askAi = useStore((s) => s.askAi);

  const askDisabled = ai.loading || !ai.prompt.trim();

  return (
    <div className="aicard">
      <div className="aihd">
        <span className="aittl">Ask about my portfolio</span>
        <span className="aibadge">AI</span>
      </div>
      <div className="aisub">
        Instant analysis of your holdings, allocation and risk — grounded in the live data on this page.
      </div>
      <div className="airow">
        <div className="aiinwrap">
          <textarea
            className="aiin"
            rows={2}
            placeholder="e.g. Is my portfolio too concentrated in technology?"
            value={ai.prompt}
            onChange={(e) => setAiPrompt(e.target.value)}
          />
        </div>
        <button className="askbtn" onClick={() => askAi()} disabled={askDisabled}>
          {ai.loading ? "Analyzing…" : "Ask"}
        </button>
      </div>
      <div className="aichips">
        {CHIPS.map((c) => (
          <button key={c.label} className="aichip" onClick={() => askAi(c.q)}>
            {c.label}
          </button>
        ))}
      </div>
      {ai.asked && (
        <div className="aianswer">
          {ai.loading ? (
            <span style={{ color: "var(--c-fg-muted)" }}>
              <span className="aispin" />
              Analyzing your portfolio…
            </span>
          ) : (
            ai.answer
          )}
        </div>
      )}
      <div className="aidisc">
        Educational analysis based on your portfolio data — not personalised investment advice. Inderes ratings reflect
        analyst views as of the last update.
      </div>
    </div>
  );
}
