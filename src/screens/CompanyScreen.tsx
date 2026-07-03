import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStore } from "../store/useStore";
import { reportsForTicker, mapRes } from "../data/research";
import ResearchCard from "../components/ResearchCard";
import Attachments from "../components/Attachments";
import ConfirmDialog from "../components/ConfirmDialog";
import { type CompanyFile, listCompanyFiles, uploadCompanyFile, deleteCompanyFile, deleteScopeFiles } from "../data/filesRepo";
import { supabaseEnabled } from "../lib/supabase";

const stCls: Record<string, string> = { Portfolio: "st-pf", Watchlist: "st-wl", Inactive: "st-in" };
const fmtTs = (ts: number) =>
  ts ? new Date(ts).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "earlier";

export default function CompanyScreen() {
  const navigate = useNavigate();
  const { ticker = "" } = useParams();
  const watchlist = useStore((s) => s.watchlist);
  const notes = useStore((s) => s.notes);
  const addNote = useStore((s) => s.addNote);
  const removeNote = useStore((s) => s.removeNote);
  const addWatchTicker = useStore((s) => s.addWatchTicker);
  const companyMetrics = useStore((s) => s.portfolio.companyMetrics);
  const isHeld = useStore((s) => s.portfolio.isHeld);
  const setStyleOverride = useStore((s) => s.setStyleOverride);
  const stockStyles = useStore((s) => s.stockStyles);
  const setStockStyle = useStore((s) => s.setStockStyle);
  const user = useStore((s) => s.user);
  const [draft, setDraft] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  // collapsed-by-default notes: ids the user has expanded
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleNote = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  // ---- attachments (Supabase Storage): "general" scope + one per posted note ----
  const filesOn = supabaseEnabled && !!user;
  const [filesByScope, setFilesByScope] = useState<Record<string, CompanyFile[]>>({});
  const [uploadScope, setUploadScope] = useState<string | null>(null); // scope currently uploading
  const [fileError, setFileError] = useState<string | null>(null);
  const pickScope = useRef("general");
  const fileInput = useRef<HTMLInputElement>(null);

  const reloadFiles = async () => {
    if (!filesOn || !user) return;
    setFilesByScope(await listCompanyFiles(user.id, ticker));
  };
  useEffect(() => { void reloadFiles(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id, ticker]);

  const pickFor = (scope: string) => {
    pickScope.current = scope;
    setFileError(null);
    fileInput.current?.click();
  };
  const onFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!f || !user) return;
    setUploadScope(pickScope.current);
    try {
      await uploadCompanyFile(user.id, ticker, pickScope.current, f);
      await reloadFiles();
    } catch (err) {
      setFileError(String((err as Error)?.message || err));
    } finally {
      setUploadScope(null);
    }
  };
  const onFileDelete = async (f: CompanyFile) => {
    try { await deleteCompanyFile(f.path); await reloadFiles(); }
    catch (err) { setFileError(String((err as Error)?.message || err)); }
  };
  // note deletion goes through a styled confirmation modal (cannot be recovered)
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  const confirmDeleteNote = () => {
    if (!pendingDelete) return;
    if (filesOn && user) void deleteScopeFiles(user.id, ticker, "note-" + pendingDelete.id).then(() => reloadFiles());
    removeNote(ticker, pendingDelete.id);
    setPendingDelete(null);
  };
  const deleteMsg = (() => {
    if (!pendingDelete) return "";
    const nFiles = (filesByScope["note-" + pendingDelete.id] || []).length;
    return (
      `"${pendingDelete.title}"` +
      (nFiles > 0 ? ` and its ${nFiles} attached file${nFiles === 1 ? "" : "s"}` : "") +
      " will be permanently deleted. This cannot be undone."
    );
  })();

  const metrics = companyMetrics(ticker);
  const held = isHeld(ticker);
  const wEntry = watchlist.find((w) => w.ticker === ticker);
  const status = held ? "Portfolio" : wEntry ? "Watchlist" : "Inactive";
  const name = metrics?.name || wEntry?.name || ticker;
  const reports = reportsForTicker(ticker).map(mapRes);
  const companyNotes = [...(notes[ticker] || [])].sort((a, b) => b.ts - a.ts);

  const post = () => {
    if (!draft.trim() || !titleDraft.trim()) return;
    addNote(ticker, titleDraft, draft);
    setTitleDraft("");
    setDraft("");
  };

  return (
    <>
      <div className="subhead">
        <div className="cohd">
          <button className="cobackbtn" onClick={() => navigate(-1)}>
            ← Back
          </button>
          <div>
            <div className="cottl">
              <span className="coname">{name}</span>
              <span className="num cotick">{ticker}</span>
              <span className={"stbadge " + stCls[status]}>{status}</span>
            </div>
            <div className="asof">
              {metrics ? `${metrics.sector} · ${metrics.region}` : "—"}
            </div>
          </div>
        </div>
      </div>

      <div className="body">
        {metrics && (
          <div className="cometrics">
            <Metric k="Last price" v={metrics.lastStr} />
            <Metric k="Market value" v={metrics.valueStr} />
            <Metric k="Day" v={metrics.dayStr} cls={metrics.dayCls} />
            <Metric k="Total return" v={metrics.totalStr} cls={metrics.totCls} />
            <Metric k="Weight" v={metrics.weightStr} />
            <Metric k="Shares" v={metrics.sharesStr} />
            <Metric k="Avg cost" v={metrics.avgStr} />
            <Metric k="Div. yield" v={metrics.yieldStr} />
            <Metric k="Inderes target" v={metrics.targetStr} />
            <div className="cm">
              <div className="cmk">Inderes rec.</div>
              <div className="cmv">
                <span className={"rec " + metrics.recCls}>{metrics.recShort}</span>
              </div>
            </div>
          </div>
        )}

        {metrics && (
          <div className="card clscard">
            <div className="cardttl">Classification</div>
            <div className="clsbuckets">
              <ClsBucket k="Sector" v={metrics.bucketSector} />
              <ClsBucket k="Region" v={metrics.bucketRegion} />
              <ClsBucket k="Asset" v={metrics.bucketAsset} />
              <ClsBucket k="Style" v={metrics.bucketStyle} />
            </div>

            {metrics.bucketStyle !== "Cash & equivalents" && metrics.isin && (
              <div className="clsovr">
                <span className="clssub" style={{ margin: 0 }}>Classify as</span>
                <div className="periodrow">
                  <button
                    className={"pbtn" + (metrics.bucketStyle === "Active" ? " on" : "")}
                    onClick={() => setStyleOverride(metrics.isin, "active")}
                  >
                    Active
                  </button>
                  <button
                    className={"pbtn" + (metrics.bucketStyle === "Passive" ? " on" : "")}
                    onClick={() => setStyleOverride(metrics.isin, "passive")}
                  >
                    Passive
                  </button>
                </div>
                {metrics.styleOverridden && (
                  <span className="clsovrnote">
                    Overridden · auto is {metrics.styleAuto}
                    <button className="clsreset" onClick={() => setStyleOverride(metrics.isin, null)}>reset</button>
                  </span>
                )}
              </div>
            )}

            {metrics.bucketAsset === "Stocks" && metrics.isin && (
              <div className="clsovr">
                <span className="clssub" style={{ margin: 0 }}>Company type</span>
                <div className="selwrap">
                  <select
                    className="sel"
                    value={stockStyles[metrics.isin] ?? ""}
                    onChange={(e) => setStockStyle(metrics.isin, (e.target.value || null) as "growth" | "cyclical" | "defensive" | "neutral" | null)}
                  >
                    <option value="">Unclassified</option>
                    <option value="growth">Growth</option>
                    <option value="cyclical">Cyclical</option>
                    <option value="defensive">Defensive</option>
                    <option value="neutral">Neutral</option>
                  </select>
                </div>
                <span className="clsovrnote">Used by the Analysis tab (aggressiveness &amp; macro-risk scales).</span>
              </div>
            )}
            {metrics.fundSectors && (
              <div className="clssectors">
                <div className="clssub">Sector look-through (fund holdings)</div>
                <div className="clssrows">
                  {metrics.fundSectors.map((s) => (
                    <div className="clssrow" key={s.label}>
                      <span className="clsslbl">{s.label}</span>
                      <div className="clsstrack">
                        <div className="clssfill" style={{ width: s.pctStr }} />
                      </div>
                      <span className="num clsspct">{s.pctStr}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="clssub">How it's derived</div>
            <div className="clsvars">
              {metrics.clsVars.map((r) => (
                <div className="clsvar" key={r.k}>
                  <span className="clsvk">{r.k}</span>
                  <span className="clsvv">{r.v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {status === "Watchlist" && !metrics && (
          <div className="card conote-empty">
            On your <b>watchlist</b> — not held yet, so live market data isn't shown. Add it via a transaction to populate
            metrics.
          </div>
        )}

        {status === "Inactive" && (
          <div className="card conote-empty">
            This company is <b>inactive</b> — not currently in your portfolio or watchlist. Your notes are kept.{" "}
            <button className="wlopen" onClick={() => addWatchTicker(ticker, name)}>
              Add to watchlist
            </button>
          </div>
        )}

        {filesOn && (
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.png,.jpg,.jpeg"
            style={{ display: "none" }}
            onChange={(e) => void onFilePicked(e)}
          />
        )}

        {filesOn && (
          <div className="card attcard">
            <div className="cardttl">Attachments</div>
            <div className="modehint" style={{ marginTop: 2 }}>
              Files saved to your account and tied to {ticker} — reports, spreadsheets, notes from meetings…
            </div>
            {fileError && <div className="atterr">{fileError}</div>}
            <Attachments
              files={filesByScope.general || []}
              busy={uploadScope === "general"}
              onPick={() => pickFor("general")}
              onDelete={(f) => void onFileDelete(f)}
            />
          </div>
        )}

        {reports.length > 0 && (
          <div className="cores">
            <div className="coresttl">Inderes research</div>
            <div className="reslist">
              {reports.map((r) => (
                <ResearchCard key={r.id} r={r} onClick={() => navigate(`/report/${r.id}`)} />
              ))}
            </div>
          </div>
        )}

        <div className="card conotes">
          <div className="cardttl">Notes</div>
          <div className="noteform">
            <input
              className="notetitlein"
              placeholder="Title — e.g. Q2 result thoughts"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              maxLength={80}
            />
            <textarea
              className="stratin notein"
              rows={3}
              placeholder="Add a note — valuation thoughts, what to watch for, a decision you made…"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") post(); }}
            />
            <div className="noteformfoot">
              <span className="modehint">Saved to your account and tied to {ticker}.</span>
              <button className="askbtn notepost" onClick={post} disabled={!draft.trim() || !titleDraft.trim()}>Post note</button>
            </div>
          </div>

          {companyNotes.length === 0 ? (
            <div className="emptyhint" style={{ padding: "14px 2px 4px" }}>No notes yet — post your first above.</div>
          ) : (
            <div className="notelist">
              {companyNotes.map((n) => {
                const open = expanded.has(n.id);
                return (
                  <div className="noteitem" key={n.id}>
                    <div className="notehead" onClick={() => toggleNote(n.id)}>
                      <button
                        className={"notechev" + (open ? " open" : "")}
                        onClick={(e) => { e.stopPropagation(); toggleNote(n.id); }}
                        title={open ? "Collapse note" : "Expand note"}
                        aria-expanded={open}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      <span className="notetitle">{n.title}</span>
                      <span className="notets">{fmtTs(n.ts)}</span>
                      <button
                        className="notedel"
                        onClick={(e) => { e.stopPropagation(); setPendingDelete({ id: n.id, title: n.title }); }}
                        title="Delete note (and its attachments)"
                      >
                        Delete
                      </button>
                    </div>
                    {open && (
                      <>
                        <div className="notetext">{n.text}</div>
                        {filesOn && (
                          <Attachments
                            compact
                            files={filesByScope["note-" + n.id] || []}
                            busy={uploadScope === "note-" + n.id}
                            onPick={() => pickFor("note-" + n.id)}
                            onDelete={(f) => void onFileDelete(f)}
                          />
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete note?"
          message={deleteMsg}
          confirmLabel="Delete note"
          onConfirm={confirmDeleteNote}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </>
  );
}

function Metric({ k, v, cls = "" }: { k: string; v: string; cls?: string }) {
  return (
    <div className="cm">
      <div className="cmk">{k}</div>
      <div className={"cmv num " + cls}>{v}</div>
    </div>
  );
}

function ClsBucket({ k, v }: { k: string; v: string }) {
  return (
    <div className="clsb">
      <div className="clsbk">{k}</div>
      <div className="clsbv">{v}</div>
    </div>
  );
}
