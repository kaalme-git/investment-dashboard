import type { AllocDim } from "../data/types";
import { useStore } from "../store/useStore";

const DIMS: { key: AllocDim; label: string }[] = [
  { key: "sector", label: "Sector" },
  { key: "region", label: "Region" },
  { key: "asset", label: "Asset" },
  { key: "style", label: "Style" },
];

/** Sector / Region / Asset / Style segmented toggle — shared by Overview and
 *  the Allocation tab (both read the same allocMode from the store). */
export default function AllocToggle() {
  const allocMode = useStore((s) => s.allocMode);
  const setAllocMode = useStore((s) => s.setAllocMode);
  return (
    <div className="toggle">
      {DIMS.map((d) => (
        <button
          key={d.key}
          className={"tgl" + (allocMode === d.key ? " on" : "")}
          onClick={() => setAllocMode(d.key)}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}
