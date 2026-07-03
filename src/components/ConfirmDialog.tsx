import { useEffect } from "react";

/** Dashboard-styled confirmation modal (replaces window.confirm for destructive
 *  actions). Render it conditionally; Escape or a backdrop click cancels. */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  variant = "danger",
  onConfirm,
  onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  /** "danger" (red, destructive) or "primary" (brand blue, e.g. saving an edit). */
  variant?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="cdlg-backdrop" onClick={onCancel}>
      <div className="cdlg" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="cdlg-ttl">{title}</div>
        <div className="cdlg-msg">{message}</div>
        <div className="cdlg-acts">
          <button className="cdlg-btn" onClick={onCancel} autoFocus>Cancel</button>
          <button className={"cdlg-btn " + variant} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
