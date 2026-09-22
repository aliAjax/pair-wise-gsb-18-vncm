// 展示层：纯渲染组件，数据与动作由 App 注入

import type {
  BlockedInfo,
  MicroscopeSlot,
  RetreatCase,
  Revision,
  RiskLevel,
} from "../domain/types";
import { MICROSCOPE_SLOTS } from "../domain/types";

export function BlockedBanner({
  blocked,
  onDismiss,
}: {
  blocked: BlockedInfo;
  onDismiss: () => void;
}) {
  return (
    <section className="blocked-banner" role="alert">
      <div>
        <strong>操作受阻</strong>
        <dl>
          <div>
            <dt>牙位</dt>
            <dd>{blocked.tooth}</dd>
          </div>
          <div>
            <dt>时段</dt>
            <dd>{blocked.slot}</dd>
          </div>
          <div>
            <dt>风险原值</dt>
            <dd>{blocked.risk}</dd>
          </div>
          <div>
            <dt>命中条件</dt>
            <dd>{blocked.condition}</dd>
          </div>
        </dl>
      </div>
      <button onClick={onDismiss}>知道了</button>
    </section>
  );
}

export function SlotSelect({
  value,
  onChange,
}: {
  value: MicroscopeSlot;
  onChange: (slot: MicroscopeSlot) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as MicroscopeSlot)}
    >
      {MICROSCOPE_SLOTS.map((slot) => (
        <option key={slot} value={slot}>
          {slot}
        </option>
      ))}
    </select>
  );
}

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  return <span className={`risk-badge risk-${risk}`}>{risk}风险</span>;
}

export function StatusBadge({ status }: { status: RetreatCase["status"] }) {
  const cls =
    status === "已占用" ? "status-occupied"
    : status === "已结案" ? "status-closed"
    : "status-queued";
  return <span className={`status-badge ${cls}`}>{status}</span>;
}

export function RevisionLog({ revisions }: { revisions: Revision[] }) {
  if (revisions.length === 0) {
    return <p className="empty-hint">暂无修订记录</p>;
  }
  return (
    <div className="revision-list">
      {[...revisions].reverse().map((rev) => (
        <article key={rev.id} className="revision-card">
          <header>
            <strong>{rev.tooth}</strong>
            <span className="revision-kind">{rev.kind}</span>
            <time>{new Date(rev.at).toLocaleString("zh-CN")}</time>
          </header>
          <p>
            {rev.field}：<s>{rev.oldValue || "（空）"}</s> →{" "}
            <b>{rev.newValue}</b>
          </p>
          <p className="revision-reason">原因：{rev.reason}</p>
        </article>
      ))}
    </div>
  );
}
