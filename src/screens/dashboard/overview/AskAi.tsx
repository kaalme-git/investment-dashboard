import { useStore } from "../../../store/useStore";

const CHIPS = [
  { label: "How concentrated is it?", q: "How concentrated is my portfolio and is that a risk?" },
  { label: "Biggest risks?", q: "What are the biggest risks in my portfolio right now?" },
  { label: "Inderes Buy-rated holdings", q: "Which of my holdings does Inderes rate Buy or Accumulate, and what share of the portfolio is that?" },
  { label: "Is my allocation balanced?", q: "Is my sector and geographic allocation well balanced?" },
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
        Instant analysis of your holdings, allocation and risk — powered by Claude, grounded in the data on this page.
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
