import AllocToggle from "../../../components/AllocToggle";
import AllocDonutLegend from "../../../components/AllocDonutLegend";

export default function AllocationCard() {
  return (
    <div className="card alloccard">
      <div className="cardhd">
        <span className="cardttl sm">Allocation</span>
        <AllocToggle />
      </div>
      <AllocDonutLegend />
    </div>
  );
}
