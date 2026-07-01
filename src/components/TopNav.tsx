import { useNavigate, useLocation } from "react-router-dom";
import UserMenu from "./UserMenu";

const LINKS = [
  { label: "Dashboard", path: "/dashboard/overview", match: "/dashboard" },
  { label: "Transactions", path: "/transactions", match: "/transactions" },
  { label: "Watchlist", path: "/watchlist", match: "/watchlist" },
  { label: "Research", path: "/research", match: "/research" },
  { label: "Strategy", path: "/strategy", match: "/strategy" },
  { label: "Calculations", path: "/calculations", match: "/calculations" },
];

export default function TopNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

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
      <UserMenu />
    </div>
  );
}
