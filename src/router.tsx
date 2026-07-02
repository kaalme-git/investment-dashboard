import { createBrowserRouter, Navigate } from "react-router-dom";
import AppShell from "./components/AppShell";
import DashboardLayout from "./screens/dashboard/DashboardLayout";
import OverviewTab from "./screens/dashboard/OverviewTab";
import AllocationTab from "./screens/dashboard/AllocationTab";
import PerformanceTab from "./screens/dashboard/PerformanceTab";
import HoldingsTab from "./screens/dashboard/HoldingsTab";
import DividendsTab from "./screens/dashboard/DividendsTab";
import AnalysisTab from "./screens/dashboard/AnalysisTab";
import TransactionsScreen from "./screens/TransactionsScreen";
import CompanyScreen from "./screens/CompanyScreen";
import ReportScreen from "./screens/ReportScreen";
import ResearchScreen from "./screens/ResearchScreen";
import SettingsScreen from "./screens/SettingsScreen";
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
          { path: "dividends", element: <DividendsTab /> },
          { path: "analysis", element: <AnalysisTab /> },
        ],
      },
      { path: "transactions", element: <TransactionsScreen /> },
      { path: "watchlist", element: <Navigate to="/research" replace /> },
      { path: "company/:ticker", element: <CompanyScreen /> },
      { path: "report/:id", element: <ReportScreen /> },
      { path: "research", element: <ResearchScreen /> },
      { path: "settings", element: <SettingsScreen /> },
      { path: "calculations", element: <CalculationsScreen /> },
      { path: "*", element: <Navigate to="/dashboard/overview" replace /> },
    ],
  },
]);
