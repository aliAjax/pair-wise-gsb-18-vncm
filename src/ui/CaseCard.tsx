import { useState } from "react";
import type { BlockInfo, RiskLevel, ToothCase } from "../data/types";
import type { BoardAction, CorrectableField } from "../domain/rules";
import { display, plusDays } from "./format";

type Mode =
  | null
  | "schedule"
  | "escalate"
  | "correct"
  | "extract";

interface CaseCardProps {
  item: ToothCase;
  overdue: boolean;
  slotOptions: string[];
  act: (action: BoardAction) => BlockInfo | null;
}

const RISK_LEVELS: RiskLevel[] = ["低", "中", "高"];
const CORRECT_FIELDS: { value: CorrectableField; label: string }[] = [
  { value: "instrumentLocation", label: "残留器械位置" },
  { value: "followUpDue", label: "复诊期限" },
  { value: "extractionResult", label: "取出结果" },
];

export function CaseCard({ item, overdue, slotOptions, act }: CaseCardProps) {
  const [mode, setMode] = useState<Mode>(null);
  const [slot, setSlot] = useState("");
  const [risk, setRisk] = useState<RiskLevel>("高");
  const [field, setField] = useState<CorrectableField>("instrumentLocation");
  const [newValue, setNewValue] = useState("");
  const [reason, setReason] = useState("");
  const [result, setResult] = useState("");

  const frozen = item.status === "已结案";
  const done = (blocked: BlockInfo | null): boolean => {
    if (blocked === null) {
      setMode(null);
      setSlot("");
      setNewValue("");
      setReason("");
      setResult("");
      return true;
    }
    return false;
  };

  const submitSchedule = () => {
    const action: BoardAction =
      item.status === "已排程"
        ? { type: "reschedule", caseId: item.id, slot }
        : { type: "schedule", caseId: item.id, slot };
    if (done(act(action))) setSlot("");
  };

  const submitEscalate = () => done(act({ type: "escalate", caseId: item.id, risk }));

  const submitCorrect = () =>
    done(act({ type: "correct", caseId: item.id, field, newValue, reason }));

  const submitExtract = () => done(act({ type: "recordExtraction", caseId: item.id, result }));

  const submitClose = () => done(act({ type: "close", caseId: item.id }));

  return (
    <article className={`record-card case-card status-${item.status}`}>
      <div className="case-main">
        <div className="case-head">
          <h3>{item.tooth}</h3>
          <span className={`status-pill status-tag-${item.status}`}>{item.status}</span>
          <span className={`risk-badge risk-${item.risk}`}>{item.risk}风险</span>
          {overdue && <span className="due-tag danger">复诊逾期</span>}
          {frozen && <span className="frozen-tag">已冻结</span>}
        </div>
        <dl className="case-facts">
          <div>
            <dt>残留器械位置</dt>
            <dd>{item.instrumentLocation}</dd>
          </div>
          <div>
            <dt>显微镜时段</dt>
            <dd>{display(item.slot)}</dd>
          </div>
          <div>
            <dt>复诊期限</dt>
            <dd className={overdue ? "text-danger" : ""}>{item.followUpDue}</dd>
          </div>
          <div className="case-result">
            <dt>取出结果</dt>
            <dd className={item.extractionResult === null ? "text-warn" : ""}>
              {display(item.extractionResult)}
            </dd>
          </div>
        </dl>

        {!frozen && (
          <div className="case-actions">
            <button
              className={mode === "schedule" ? "active-toggle" : ""}
              onClick={() => setMode(mode === "schedule" ? null : "schedule")}
            >
              {item.status === "已排程" ? "改约" : "安排时段"}
            </button>
            <button
              className={mode === "escalate" ? "active-toggle" : ""}
              onClick={() => setMode(mode === "escalate" ? null : "escalate")}
            >
              风险升级
            </button>
            <button
              className={mode === "extract" ? "active-toggle" : ""}
              onClick={() => setMode(mode === "extract" ? null : "extract")}
              disabled={item.extractionResult !== null}
              title={item.extractionResult !== null ? "已登记，变更请走更正" : undefined}
            >
              登记取出结果
            </button>
            <button
              className={mode === "correct" ? "active-toggle" : ""}
              onClick={() => setMode(mode === "correct" ? null : "correct")}
            >
              更正
            </button>
            <button className="primary-action" onClick={submitClose}>
              结案
            </button>
          </div>
        )}

        {mode === "schedule" && (
          <div className="inline-form">
            <label>
              <span>{item.status === "已排程" ? "新显微镜时段（先归还再重排）" : "显微镜时段"}</span>
              <input
                list="slot-options"
                value={slot}
                placeholder="如 09-24 09:00"
                onChange={(e) => setSlot(e.target.value)}
              />
            </label>
            <div className="slot-suggestions">
              {slotOptions.slice(0, 5).map((option) => (
                <button key={option} type="button" onClick={() => setSlot(option)}>
                  {option}
                </button>
              ))}
            </div>
            <button className="primary-action" onClick={submitSchedule}>
              确认{item.status === "已排程" ? "改约" : "安排"}
            </button>
          </div>
        )}

        {mode === "escalate" && (
          <div className="inline-form">
            <label>
              <span>
                升级目标（风险原值：{item.risk}；升级后{item.slot !== null ? "归还原时段并重新排队" : "重新排队"}）
              </span>
              <select value={risk} onChange={(e) => setRisk(e.target.value as RiskLevel)}>
                {RISK_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}风险
                  </option>
                ))}
              </select>
            </label>
            <button className="primary-action" onClick={submitEscalate}>
              确认升级
            </button>
          </div>
        )}

        {mode === "extract" && (
          <div className="inline-form">
            <label>
              <span>取出结果（未登记不得结案）</span>
              <textarea
                rows={2}
                value={result}
                placeholder="如：超声工作尖松解后完整取出，无残留"
                onChange={(e) => setResult(e.target.value)}
              />
            </label>
            <button className="primary-action" onClick={submitExtract}>
              提交取出结果
            </button>
          </div>
        )}

        {mode === "correct" && (
          <div className="inline-form">
            <label>
              <span>更正字段</span>
              <select
                value={field}
                onChange={(e) => {
                  setField(e.target.value as CorrectableField);
                  setNewValue("");
                }}
              >
                {CORRECT_FIELDS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>
                旧值：
                {field === "extractionResult"
                  ? display(item.extractionResult)
                  : field === "followUpDue"
                    ? item.followUpDue
                    : item.instrumentLocation}
              </span>
              {field === "followUpDue" ? (
                <input
                  type="date"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                />
              ) : (
                <textarea
                  rows={2}
                  value={newValue}
                  placeholder="填写更正后的新值"
                  onChange={(e) => setNewValue(e.target.value)}
                />
              )}
            </label>
            <label>
              <span>更正原因（必填，随旧值与时间一并保留）</span>
              <input
                value={reason}
                placeholder="如：影像复核后修正位置描述"
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            {field === "followUpDue" && (
              <div className="slot-suggestions">
                {[7, 14, 21].map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setNewValue(plusDays(item.followUpDue, days))}
                  >
                    顺延 {days} 天
                  </button>
                ))}
              </div>
            )}
            <button className="primary-action" onClick={submitCorrect}>
              提交更正
            </button>
          </div>
        )}
      </div>
    </article>
  );
}
