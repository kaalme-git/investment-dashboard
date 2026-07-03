import { type CompanyFile, fileUrl, MAX_FILE_MB } from "../data/filesRepo";

const fmtSize = (b: number) => (b >= 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " kB");

/** Attachment list for one scope (the asset page or a single note): download on
 *  click, delete per file, plus an "Attach file" trigger. `compact` renders the
 *  smaller inline variant used under posted notes. */
export default function Attachments({
  files,
  busy,
  compact = false,
  onPick,
  onDelete,
}: {
  files: CompanyFile[];
  busy: boolean;
  compact?: boolean;
  onPick: () => void;
  onDelete: (f: CompanyFile) => void;
}) {
  const open = async (f: CompanyFile) => {
    const url = await fileUrl(f.path);
    if (url) window.open(url, "_blank", "noopener");
  };

  return (
    <div className={"attwrap" + (compact ? " attcompact" : "")}>
      {files.map((f) => (
        <div className="attrow" key={f.path}>
          <button className="attname" onClick={() => void open(f)} title="Download">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M21.4 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.2-9.19a4 4 0 1 1 5.65 5.66l-9.2 9.19a2 2 0 0 1-2.82-2.83l8.48-8.48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{f.name}</span>
          </button>
          <span className="attsize num">{fmtSize(f.size)}</span>
          <button className="attdel" onClick={() => onDelete(f)} title="Delete file">✕</button>
        </div>
      ))}
      <button className="attadd" onClick={onPick} disabled={busy}>
        {busy ? "Uploading…" : `+ Attach file (max ${MAX_FILE_MB} MB)`}
      </button>
    </div>
  );
}
