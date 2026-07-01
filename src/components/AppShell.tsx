import { Outlet } from "react-router-dom";
import TopNav from "./TopNav";

export default function AppShell() {
  return (
    <div className="page">
      <div className="dash">
        <TopNav />
        <Outlet />
      </div>
    </div>
  );
}
