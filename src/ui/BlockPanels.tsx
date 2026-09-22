import type { BlockInfo } from "../data/types";
import { formatTime } from "./format";

/** 受阻提示：显示牙位、时段、风险原值、命中条件 */
export function BlockBanner({ block }: { block: BlockInfo | null }) {
  if (!block) return null;
  return (
    <section className="block-banner" role="alert">
      <div className="block-title">
        <span className="block-dot" />
        <strong>
          操作受阻 · {block.action}
        </strong>
      </div>
      <dl className="block-facts">
        <div>
          <dt>牙位</dt>
          <dd>{block.tooth}</dd>
        </div>
        <div>
          <dt>时段</dt>
          <dd>{block.slot || "—"}</dd>
        </div>
        <div>
          <dt>风险原值</dt>
          <dd>{block.riskOriginal}</dd>
        </div>
        <div className="block-condition">
          <dt>命中条件</dt>
          <dd>{block.condition}</dd>
        </div>
      </dl>
      <time>{formatTime(block.at)}</time>
    </section>
  );
}

export function BlockHistoryPanel({ blocked }: { blocked: BlockInfo[] }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>持久化记录</p>
          <h2>受阻台账</h2>
        </div>
        <span className="rule-chip">刷新后保留</span>
      </div>
      {blocked.length === 0 ? (
        <p className="empty-hint">暂无受阻记录</p>
      ) : (
        <div className="table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>动作</th>
                <th>牙位</th>
                <th>时段</th>
                <th>风险原值</th>
                <th>命中条件</th>
              </tr>
            </thead>
            <tbody>
              {blocked.map((block) => (
                <tr key={block.id}>
                  <td>{formatTime(block.at)}</td>
                  <td>{block.action}</td>
                  <td>{block.tooth}</td>
                  <td>{block.slot || "—"}</td>
                  <td>{block.riskOriginal}</td>
                  <td className="condition-cell">{block.condition}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
