import type { ReactNode } from "react";

/** Small "i" info icon that reveals a popover on hover/focus. The popover opens
 *  downward and right-aligned so it stays inside cards that clip overflow
 *  (holdings / overview tables use overflow:hidden). */
export default function InfoTip({ children, label = "More information" }: { children: ReactNode; label?: string }) {
  return (
    <span className="infotip" tabIndex={0} role="note" aria-label={label}>
      <span className="infotip-ic" aria-hidden="true">i</span>
      <span className="infotip-pop">{children}</span>
    </span>
  );
}
