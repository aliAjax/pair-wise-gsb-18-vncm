import type { BoardMetrics } from "../domain/selectors";

const cards: {
  key: keyof BoardMetrics;
  label: string;
  hint: string;
  tone: string;
}[] = [
  { key: "queued", label: "排队中牙位", hint: "等待显微镜时段", tone: "status-watch" },
  { key: "scheduled", label: "已占用时段", hint: "一台显微镜/一时段", tone: "status-ok" },
  { key: "pendingExtraction", label: "取出结果未登记", hint: "未登记不得结案", tone: "status-danger" },
  { key: "closed", label: "已结案冻结", hint: "更正仅见修订记录", tone: "status-frozen" },
];

export function MetricsPanel({ metrics }: { metrics: BoardMetrics }) {
  return (
    <section className="metrics-grid">
      {cards.map((card, index) => (
        <article className="metric-card" key={card.key}>
          <span>{card.label}</span>
          <strong>{metrics[card.key]}</strong>
          <p className="metric-hint">{card.hint}</p>
          <i className={`${card.tone} metric-bar-${index}`} />
        </article>
      ))}
    </section>
  );
}
