import { createBrowserRouter, Navigate } from "react-router-dom";
import AppShell from "./components/AppShell";
import { TabPlaceholder } from "./components/Placeholder";
import DashboardLayout from "./screens/dashboard/DashboardLayout";
import OverviewTab from "./screens/dashboard/OverviewTab";
import AllocationTab from "./screens/dashboard/AllocationTab";
import PerformanceTab from "./screens/dashboard/PerformanceTab";
import HoldingsTab from "./screens/dashboard/HoldingsTab";
import TransactionsScreen from "./screens/TransactionsScreen";
import WatchlistScreen from "./screens/WatchlistScreen";
import CompanyScreen from "./screens/CompanyScreen";
import ReportScreen from "./screens/ReportScreen";
import ResearchScreen from "./screens/ResearchScreen";
import StrategyScreen from "./screens/StrategyScreen";
import CalculationsScreen from "./screens/CalculationsScreen";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/dashboard/overview" replace /> },
      {
        path: "dashboard",
        element: <DashboardLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard/overview" replace /> },
          { path: "overview", element: <OverviewTab /> },
          { path: "allocation", element: <AllocationTab /> },
          { path: "performance", element: <PerformanceTab /> },
          { path: "holdings", element: <HoldingsTab /> },
          { path: "dividends", element: <TabPlaceholder label="Dividends" /> },
        ],
      },
      { path: "transactions", element: <TransactionsScreen /> },
      { path: "watchlist", element: <WatchlistScreen /> },
      { path: "company/:ticker", element: <CompanyScreen /> },
      { path: "report/:id", element: <ReportScreen /> },
      { path: "research", element: <ResearchScreen /> },
      { path: "strategy", element: <StrategyScreen /> },
      { path: "calculations", element: <CalculationsScreen /> },
      { path: "*", element: <Navigate to="/dashboard/overview" replace /> },
    ],
  },
]);
