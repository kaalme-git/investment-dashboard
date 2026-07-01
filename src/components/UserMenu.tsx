import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "../store/useStore";

function initials(email: string): string {
  const name = (email || "").split("@")[0].replace(/[^A-Za-z]/g, "");
  return (name.slice(0, 2) || "U").toUpperCase();
}

// Account menu: the avatar opens a small popover showing the signed-in email and
// a Log out button (the standard avatar-dropdown convention). Closes on outside
// click or Escape. In local mode there's no account, so it's a static badge.
export default function UserMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const user = useStore((s) => s.user);
  const localMode = useStore((s) => s.localMode);
  const signOut = useStore((s) => s.signOut);
  const email = user?.email || "";

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  return (
    <div className="usermenu" ref={ref}>
      <button
        className="iconbtn av"
        onClick={() => setOpen((o) => !o)}
        title={localMode ? "Local mode" : email}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {localMode ? "JK" : initials(email)}
      </button>

      {open && (
        <div className="usermenu-pop" role="menu">
          <div className="um-head">
            <div className="um-caption">{localMode ? "Mode" : "Signed in as"}</div>
            <div className="um-email" title={email}>{localMode ? "Local mode" : email}</div>
          </div>
          <button className="um-item" role="menuitem" onClick={() => { setOpen(false); navigate("/settings"); }}>
            <svg className="um-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
              <path
                d="M19.4 12a7.6 7.6 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7.3 7.3 0 0 0-2-1.2L14.4 2h-4l-.5 2.6a7.3 7.3 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1c.6.5 1.3.9 2 1.2l.5 2.6h4l.5-2.6c.7-.3 1.4-.7 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
            Settings
          </button>
          {!localMode && (
            <button className="um-item danger" role="menuitem" onClick={() => { setOpen(false); void signOut(); }}>
              <svg className="um-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                <path d="M10 17l-5-5 5-5M5 12h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Log out
            </button>
          )}
        </div>
      )}
    </div>
  );
}
