// 展示层入口：组装记录层状态与判定层视图
import { useEffect, useState } from "react";
import "./styles.css";
import { occupancyBySlot, sortQueue } from "./domain/rules";
import * as store from "./domain/store";
import type {
  ActionResult,
  BlockedInfo,
  BoardState,
  MicroscopeSlot,
  RiskLevel,
} from "./domain/types";
import { MICROSCOPE_SLOTS } from "./domain/types";
import { BlockedBanner, RevisionLog } from "./ui/components";
import { CaseCard } from "./ui/CaseCard";

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function RegisterForm({ onSubmit }: { onSubmit: (input: {
  tooth: string;
  instrumentSite: string;
  risk: RiskLevel;
  slot: MicroscopeSlot;
  followupBy: string;
}) => void }) {
  const [tooth, setTooth] = useState("");
  const [site, setSite] = useState("");
  const [risk, setRisk] = useState<RiskLevel>("中");
  const [slot, setSlot] = useState<MicroscopeSlot>(MICROSCOPE_SLOTS[0]);
  const [followupBy, setFollowupBy] = useState("");

  const valid =
    tooth.trim() !== "" && site.trim() !== "" && followupBy.trim() !== "";

  return (
    <form
      className="field-grid"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        onSubmit({
          tooth: tooth.trim(),
          instrumentSite: site.trim(),
          risk,
          slot,
          followupBy,
        });
        setTooth("");
        setSite("");
      }}
    >
      <label>
        <span>牙位</span>
        <input
          placeholder="如 #36"
          value={tooth}
          onChange={(e) => setTooth(e.target.value)}
        />
      </label>
      <label>
        <span>残留器械位置</span>
        <input
          placeholder="如 MB2 根管中段"
          value={site}
          onChange={(e) => setSite(e.target.value)}
        />
      </label>
      <label>
        <span>风险级别</span>
        <select value={risk} onChange={(e) => setRisk(e.target.value as RiskLevel)}>
          <option value="低">低</option>
          <option value="中">中</option>
          <option value="高">高</option>
        </select>
      </label>
      <label>
        <span>显微镜时段</span>
        <select
          value={slot}
          onChange={(e) => setSlot(e.target.value as MicroscopeSlot)}
        >
          {MICROSCOPE_SLOTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>复诊期限</span>
        <input
          type="date"
          value={followupBy}
          onChange={(e) => setFollowupBy(e.target.value)}
        />
      </label>
      <div className="form-footer">
        <button type="submit" className="primary-action" disabled={!valid}>
          登记并排队
        </button>
      </div>
    </form>
  );
}

function App() {
  const [state, setState] = useState<BoardState>(store.loadState);
  const [blocked, setBlocked] = useState<BlockedInfo | null>(null);

  useEffect(() => {
    store.saveState(state);
  }, [state]);

  const run = (fn: (s: BoardState) => ActionResult) => {
    const result = fn(state);
    setState(result.state);
    setBlocked(result.blocked);
  };

  const queue = sortQueue(state.cases);
  const occupancy = occupancyBySlot(state);
  const openCases = state.cases.filter((c) => c.status !== "已结案");
  const closedCases = state.cases.filter((c) => c.status === "已结案");

  const actions = {
    onSchedule: (id: string) => run((s) => store.scheduleCase(s, id)),
    onEscalate: (id: string, risk: RiskLevel, reason: string) =>
      run((s) => store.escalateRisk(s, id, risk, reason)),
    onReschedule: (id: string, slot: MicroscopeSlot, reason: string) =>
      run((s) => store.rescheduleSlot(s, id, slot, reason)),
    onRetrieval: (id: string, result: string) =>
      run((s) => store.registerRetrieval(s, id, result)),
    onClose: (id: string) => run((s) => store.closeCase(s, id)),
    onCorrect: (
      id: string,
      field: "instrumentSite" | "followupBy" | "retrievalResult",
      newValue: string,
      reason: string,
    ) => run((s) => store.correctCase(s, id, field, newValue, reason)),
  };

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-04 · port 5104</p>
          <h1>显微根管再治疗排程台</h1>
          <p className="subtitle">
            登记残留器械位置与风险级别，按时段独占调度显微镜；取出结果未登记不得结案，结案后冻结并保留更正轨迹。
          </p>
        </div>
        <div className="stack-card">
          <span>调度规则</span>
          <strong>同一时段仅一台显微镜 · 风险升级/改约先归还再重排</strong>
        </div>
      </section>

      {blocked && (
        <BlockedBanner blocked={blocked} onDismiss={() => setBlocked(null)} />
      )}

      <section className="metrics-grid">
        <MetricCard label="排队中" value={queue.length} />
        <MetricCard
          label="已占用时段"
          value={state.cases.filter((c) => c.status === "已占用").length}
        />
        <MetricCard label="已结案" value={closedCases.length} />
        <MetricCard
          label="高风险案件"
          value={state.cases.filter((c) => c.risk === "高" && c.status !== "已结案").length}
        />
      </section>

      <section className="workspace">
        <aside className="panel narrow">
          <h2>显微镜时段占用</h2>
          <div className="slot-board">
            {MICROSCOPE_SLOTS.map((slot) => {
              const occupant = occupancy.get(slot);
              return (
                <div
                  key={slot}
                  className={`slot-row ${occupant ? "slot-busy" : "slot-free"}`}
                >
                  <span>{slot}</span>
                  <strong>{occupant ? occupant.tooth : "空闲"}</strong>
                </div>
              );
            })}
          </div>
          <h2>排队序列（风险优先）</h2>
          {queue.length === 0 ? (
            <p className="empty-hint">暂无排队案件</p>
          ) : (
            <ol className="queue-list">
              {queue.map((c) => (
                <li key={c.id}>
                  <strong>{c.tooth}</strong>
                  <span>
                    {c.risk}风险 · {c.slot} · 期限 {c.followupBy}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </aside>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p>牙体牙髓 · 显微再治疗</p>
              <h2>牙位登记</h2>
            </div>
            <button onClick={() => run((s) => ({ state: store.resetState(), blocked: null }))}>
              重置示例数据
            </button>
          </div>
          <RegisterForm
            onSubmit={(input) => run((s) => store.registerCase(s, input))}
          />
        </section>
      </section>

      <section className="records panel">
        <div className="section-heading">
          <div>
            <p>在办案件</p>
            <h2>排队与占用</h2>
          </div>
        </div>
        <div className="case-list">
          {openCases.length === 0 && <p className="empty-hint">暂无在办案件</p>}
          {openCases.map((c) => (
            <CaseCard key={c.id} kase={c} actions={actions} />
          ))}
        </div>
      </section>

      {closedCases.length > 0 && (
        <section className="records panel">
          <div className="section-heading">
            <div>
              <p>已结案（冻结）</p>
              <h2>结案案件</h2>
            </div>
          </div>
          <div className="case-list">
            {closedCases.map((c) => (
              <CaseCard key={c.id} kase={c} actions={actions} />
            ))}
          </div>
        </section>
      )}

      <section className="records panel">
        <div className="section-heading">
          <div>
            <p>审计轨迹</p>
            <h2>修订记录</h2>
          </div>
        </div>
        <RevisionLog revisions={state.revisions} />
      </section>
    </main>
  );
}

export default App;
