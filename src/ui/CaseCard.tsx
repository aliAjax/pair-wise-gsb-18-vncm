// 展示层：单个牙位案件卡片，动作回调由 App 注入

import { useState } from "react";
import type { MicroscopeSlot, RetreatCase, RiskLevel } from "../domain/types";
import { RiskBadge, SlotSelect, StatusBadge } from "./components";

interface CaseActions {
  onSchedule: (id: string) => void;
  onEscalate: (id: string, risk: RiskLevel, reason: string) => void;
  onReschedule: (id: string, slot: MicroscopeSlot, reason: string) => void;
  onRetrieval: (id: string, result: string) => void;
  onClose: (id: string) => void;
  onCorrect: (
    id: string,
    field: "instrumentSite" | "followupBy" | "retrievalResult",
    newValue: string,
    reason: string,
  ) => void;
}

function OpenCaseBody({ kase, actions }: { kase: RetreatCase; actions: CaseActions }) {
  const [slot, setSlot] = useState<MicroscopeSlot>(kase.slot);
  const [risk, setRisk] = useState<RiskLevel>(kase.risk);
  const [reason, setReason] = useState("");
  const [retrieval, setRetrieval] = useState(kase.retrievalResult ?? "");

  return (
    <>
      <div className="case-actions">
        {kase.status === "排队中" && (
          <button
            className="primary-action"
            onClick={() => actions.onSchedule(kase.id)}
          >
            尝试排程占用
          </button>
        )}
        <div className="action-group">
          <SlotSelect value={slot} onChange={setSlot} />
          <button
            disabled={slot === kase.slot}
            onClick={() => actions.onReschedule(kase.id, slot, reason)}
          >
            改约
          </button>
        </div>
        <div className="action-group">
          <select
            value={risk}
            onChange={(e) => setRisk(e.target.value as RiskLevel)}
          >
            <option value="低">低</option>
            <option value="中">中</option>
            <option value="高">高</option>
          </select>
          <button
            disabled={risk === kase.risk}
            onClick={() => actions.onEscalate(kase.id, risk, reason)}
          >
            调整风险
          </button>
        </div>
        <input
          className="reason-input"
          placeholder="操作原因（改约/调风险时留痕）"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
      <div className="case-actions">
        <input
          placeholder="登记取出结果，如：分离器械已取出"
          value={retrieval}
          onChange={(e) => setRetrieval(e.target.value)}
        />
        <button
          disabled={!retrieval.trim() || retrieval === kase.retrievalResult}
          onClick={() => actions.onRetrieval(kase.id, retrieval.trim())}
        >
          登记取出结果
        </button>
        <button className="danger-action" onClick={() => actions.onClose(kase.id)}>
          结案
        </button>
      </div>
    </>
  );
}

function ClosedCaseBody({ kase, actions }: { kase: RetreatCase; actions: CaseActions }) {
  const [field, setField] = useState<
    "instrumentSite" | "followupBy" | "retrievalResult"
  >("instrumentSite");
  const [newValue, setNewValue] = useState("");
  const [reason, setReason] = useState("");

  return (
    <div className="case-actions frozen">
      <span className="frozen-hint">已冻结 · 更正将保留原因、旧值与时间</span>
      <select
        value={field}
        onChange={(e) =>
          setField(
            e.target.value as "instrumentSite" | "followupBy" | "retrievalResult",
          )
        }
      >
        <option value="instrumentSite">残留器械位置</option>
        <option value="followupBy">复诊期限</option>
        <option value="retrievalResult">取出结果</option>
      </select>
      <input
        placeholder="更正后的新值"
        value={newValue}
        onChange={(e) => setNewValue(e.target.value)}
      />
      <input
        placeholder="更正原因（必填）"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <button
        disabled={!newValue.trim()}
        onClick={() => {
          actions.onCorrect(kase.id, field, newValue.trim(), reason.trim());
          setNewValue("");
          setReason("");
        }}
      >
        提交更正
      </button>
    </div>
  );
}

export function CaseCard({
  kase,
  actions,
}: {
  kase: RetreatCase;
  actions: CaseActions;
}) {
  return (
    <article className={`case-card ${kase.status === "已结案" ? "is-closed" : ""}`}>
      <header>
        <h3>{kase.tooth}</h3>
        <StatusBadge status={kase.status} />
        <RiskBadge risk={kase.risk} />
      </header>
      <dl className="case-fields">
        <div>
          <dt>残留器械位置</dt>
          <dd>{kase.instrumentSite}</dd>
        </div>
        <div>
          <dt>显微镜时段</dt>
          <dd>{kase.slot}</dd>
        </div>
        <div>
          <dt>复诊期限</dt>
          <dd>{kase.followupBy}</dd>
        </div>
        <div>
          <dt>取出结果</dt>
          <dd>{kase.retrievalResult ?? "未登记"}</dd>
        </div>
      </dl>
      {kase.status === "已结案" ? (
        <ClosedCaseBody kase={kase} actions={actions} />
      ) : (
        <OpenCaseBody kase={kase} actions={actions} />
      )}
    </article>
  );
}
