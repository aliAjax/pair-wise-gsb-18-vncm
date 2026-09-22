import type { SlotOccupancy } from "../domain/selectors";

export function OccupancyPanel({
  occupancy,
  slotOptions,
}: {
  occupancy: SlotOccupancy[];
  slotOptions: string[];
}) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>单台显微镜</p>
          <h2>时段占用台</h2>
        </div>
        <span className="rule-chip">同一时段仅可安排一台</span>
      </div>
      <datalist id="slot-options">
        {slotOptions.map((slot) => (
          <option key={slot} value={slot} />
        ))}
      </datalist>
      {occupancy.length === 0 ? (
        <p className="empty-hint">当前无时段占用</p>
      ) : (
        <div className="slot-grid">
          {occupancy.map(({ slot, case: item }) => (
            <article key={slot} className="slot-card">
              <div className="slot-time">{slot}</div>
              <div className="slot-body">
                <strong>{item.tooth}</strong>
                <span className={`risk-badge risk-${item.risk}`}>{item.risk}风险</span>
                <p>{item.instrumentLocation}</p>
                <p className="slot-due">复诊期限 {item.followUpDue}</p>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
