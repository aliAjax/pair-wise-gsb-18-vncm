import type { Revision } from "../data/types";
import { formatTime } from "./format";

const KIND_CLASS: Record<Revision["kind"], string> = {
  登记: "rev-register",
  排程: "rev-schedule",
  改约: "rev-reschedule",
  风险升级: "rev-escalate",
  更正: "rev-correct",
  取出结果: "rev-extract",
  结案: "rev-close",
};

/** 修订记录：原因、旧值、时间均保留；结案后的变更只可能来自这里的历史 */
export function RevisionsPanel({ revisions }: { revisions: Revision[] }) {
  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>不可变修订流水</p>
          <h2>修订记录</h2>
        </div>
        <span className="rule-chip">原因 · 旧值 · 新值 · 时间</span>
      </div>
      {revisions.length === 0 ? (
        <p className="empty-hint">暂无修订记录</p>
      ) : (
        <div className="table-wrap">
          <table className="history-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>牙位</th>
                <th>类型</th>
                <th>字段</th>
                <th>旧值</th>
                <th>新值</th>
                <th>原因</th>
              </tr>
            </thead>
            <tbody>
              {revisions.map((rev) => (
                <tr key={rev.id}>
                  <td>{formatTime(rev.at)}</td>
                  <td>{rev.tooth}</td>
                  <td>
                    <span className={`rev-kind ${KIND_CLASS[rev.kind]}`}>{rev.kind}</span>
                  </td>
                  <td>{rev.field}</td>
                  <td className="old-value">{rev.oldValue}</td>
                  <td>{rev.newValue}</td>
                  <td>{rev.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
