/** Body-level placeholder for dashboard sub-tabs not built yet. */
export function TabPlaceholder({ label }: { label: string }) {
  return (
    <div className="card phcard">
      <div className="cardttl">{label}</div>
      <div className="emptyhint">This section isn't built yet — coming in a later phase.</div>
    </div>
  );
}

/** Full-section placeholder (own subhead) for nav sections not built yet. */
export function SectionPlaceholder({ title, sub }: { title: string; sub?: string }) {
  return (
    <>
      <div className="subhead">
        <div>
          <div className="ttl">{title}</div>
          {sub && <div className="asof">{sub}</div>}
        </div>
      </div>
      <div className="body">
        <div className="card phcard">
          <div className="cardttl">{title}</div>
          <div className="emptyhint">This section isn't built yet — coming in a later phase.</div>
        </div>
      </div>
    </>
  );
}
