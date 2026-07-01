import { useNavigate, useLocation } from "react-router-dom";
import { useStore } from "../store/useStore";

const LINKS = [
  { label: "Dashboard", path: "/dashboard/overview", match: "/dashboard" },
  { label: "Transactions", path: "/transactions", match: "/transactions" },
  { label: "Watchlist", path: "/watchlist", match: "/watchlist" },
  { label: "Research", path: "/research", match: "/research" },
  { label: "Strategy", path: "/strategy", match: "/strategy" },
  { label: "Calculations", path: "/calculations", match: "/calculations" },
];

function initials(email: string | undefined): string {
  if (!email) return "JK";
  const name = email.split("@")[0].replace(/[^A-Za-z]/g, "");
  return (name.slice(0, 2) || "U").toUpperCase();
}

export default function TopNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const user = useStore((s) => s.user);
  const localMode = useStore((s) => s.localMode);
  const signOut = useStore((s) => s.signOut);

  const onAvatar = () => {
    if (localMode) return;
    if (window.confirm("Sign out?")) void signOut();
  };

  return (
    <div className="nav">
      <img src="/inderes-logo.png" alt="inderes" className="brandlogo" />
      {LINKS.map((l) => (
        <button
          key={l.label}
          className={"navlink" + (pathname.startsWith(l.match) ? " on" : "")}
          onClick={() => navigate(l.path)}
        >
          {l.label}
        </button>
      ))}
      <div className="navsp" />
      <button
        className="iconbtn av"
        onClick={onAvatar}
        title={localMode ? "Local mode" : (user?.email || "") + " · click to sign out"}
      >
        {localMode ? "JK" : initials(user?.email)}
      </button>
    </div>
  );
}
