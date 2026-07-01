import { useEffect, useRef, useState } from "react";
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
          {!localMode && (
            <button
              className="um-item"
              role="menuitem"
              onClick={() => { setOpen(false); void signOut(); }}
            >
              Log out
            </button>
          )}
        </div>
      )}
    </div>
  );
}
