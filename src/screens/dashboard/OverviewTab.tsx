import ValueChartCard from "./overview/ValueChartCard";
import AllocationCard from "./overview/AllocationCard";
import AskAi from "./overview/AskAi";
import OverviewTable from "./overview/OverviewTable";

export default function OverviewTab() {
  return (
    <>
      <div className="row2b">
        <ValueChartCard />
        <AllocationCard />
      </div>
      <AskAi />
      <OverviewTable />
    </>
  );
}
