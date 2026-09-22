import { useMemo, useState } from "react";
import "./styles.css";
import { dispatch, resetBoard, useBoardState } from "./data/store";
import type { BoardAction, RegisterInput } from "./domain/rules";
import {
  checkConsistency,
  selectBlocked,
  selectCasesView,
  selectMetrics,
  selectOccupancy,
  selectQueue,
  selectRevisions,
} from "./domain/selectors";
import type { BlockInfo } from "./data/types";
import { formatDate } from "./ui/format";
import { MetricsPanel } from "./ui/MetricsPanel";
import { QueuePanel } from "./ui/QueuePanel";
import { OccupancyPanel } from "./ui/OccupancyPanel";
import { RegisterForm } from "./ui/RegisterForm";
import { CaseCard } from "./ui/CaseCard";
import { BlockBanner, BlockHistoryPanel } from "./ui/BlockPanels";
import { RevisionsPanel } from "./ui/RevisionsPanel";

const BASE_SLOTS = [
  "09-23 09:00",
  "09-23 10:30",
  "09-23 14:00",
  "09-24 09:00",
  "09-24 10:30",
  "09-24 14:00",
  "09-25 09:00",
];

function App() {
  const state = useBoardState();
  const now = useMemo(() => Date.now(), []);
  const [latestBlock, setLatestBlock] = useState<BlockInfo | null>(null);

  const metrics = selectMetrics(state);
  const queue = selectQueue(state, now);
  const occupancy = selectOccupancy(state);
  const casesView = selectCasesView(state, now);
  const revisions = selectRevisions(state);
  const blocked = selectBlocked(state);
  const issues = checkConsistency(state);

  // 显微镜时段建议：已有占用 + 预设班次，去重排序
  const slotOptions = useMemo(() => {
    return Array.from(new Set([...occupancy.map((o) => o.slot), ...BASE_SLOTS])).sort((a, b) =>
      a < b ? -1 : 1,
    );
  }, [occupancy]);

  const act = (action: BoardAction): BlockInfo | null => {
    const result = dispatch(action);
    setLatestBlock(result.blocked);
    return result.blocked;
  };

  const register = (input: RegisterInput): BlockInfo | null =>
    act({ type: "register", input });

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-04 · port 5104 · 显微根管再治疗排程台</p>
          <h1>显微根管再治疗排程台</h1>
          <p className="subtitle">
            按牙位登记残留器械位置、风险级别、显微镜时段与复诊期限；单台显微镜一时段仅排一台，
            风险升级或改约先归还原占用再重新排队；取出结果未登记不得结案，结案后冻结。
          </p>
        </div>
        <div className="stack-card">
          <span>分层架构 · 无新增依赖</span>
          <strong>记录层（localStorage） → 判定层（纯规则） → 展示层（React）</strong>
          <button className="reset-button" onClick={resetBoard}>
            恢复演示数据
          </button>
        </div>
      </section>

      <MetricsPanel metrics={metrics} />

      <BlockBanner block={latestBlock} />

      {issues.length > 0 && (
        <section className="consistency-banner" role="alert">
          <strong>一致性告警：</strong>
          {issues.map((issue) => (
            <span key={issue.message}>{issue.message}</span>
          ))}
        </section>
      )}

      <section className="workspace">
        <QueuePanel queue={queue} />
        <div className="panel-stack">
          <RegisterForm onRegister={register} today={formatDate(now)} />
          <OccupancyPanel occupancy={occupancy} slotOptions={slotOptions} />
        </div>
      </section>

      <section className="records panel">
        <div className="section-heading">
          <div>
            <p>牙位档案</p>
            <h2>再治疗病例（排队 / 已排程 / 已结案冻结）</h2>
          </div>
          <span className="rule-chip">全部操作经判定层校验</span>
        </div>
        <div className="record-list">
          {casesView.map(({ item, overdue }) => (
            <CaseCard
              key={item.id}
              item={item}
              overdue={overdue}
              slotOptions={slotOptions}
              act={act}
            />
          ))}
        </div>
      </section>

      <RevisionsPanel revisions={revisions} />
      <BlockHistoryPanel blocked={blocked} />
    </main>
  );
}

export default App;
