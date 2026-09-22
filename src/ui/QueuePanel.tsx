import type { QueueItem } from "../domain/selectors";

export function QueuePanel({ queue }: { queue: QueueItem[] }) {
  return (
    <aside className="panel narrow">
      <h2>排队队列</h2>
      <p className="panel-note">风险升级或改约：先归还原占用，再按当前时刻落到队尾</p>
      {queue.length === 0 ? (
        <p className="empty-hint">暂无排队牙位</p>
      ) : (
        <ol className="queue-list">
          {queue.map(({ item, order, overdue }) => (
            <li key={item.id} className={overdue ? "queue-row overdue" : "queue-row"}>
              <span className="queue-order">{String(order).padStart(2, "0")}</span>
              <div>
                <strong>{item.tooth}</strong>
                <span className={`risk-badge risk-${item.risk}`}>{item.risk}风险</span>
                {overdue && <span className="due-tag">复诊逾期 {item.followUpDue}</span>}
                {!overdue && <span className="due-tag muted">期限 {item.followUpDue}</span>}
              </div>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
