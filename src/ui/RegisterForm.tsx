import { useState } from "react";
import type { BlockInfo, RiskLevel } from "../data/types";

interface RegisterFormProps {
  onRegister: (input: {
    tooth: string;
    instrumentLocation: string;
    risk: RiskLevel;
    followUpDue: string;
  }) => BlockInfo | null;
  today: string;
}

export function RegisterForm({ onRegister, today }: RegisterFormProps) {
  const [tooth, setTooth] = useState("");
  const [instrumentLocation, setInstrumentLocation] = useState("");
  const [risk, setRisk] = useState<RiskLevel>("中");
  const [followUpDue, setFollowUpDue] = useState(today);

  const submit = () => {
    const blocked = onRegister({ tooth, instrumentLocation, risk, followUpDue });
    // 仅成功时清空；受阻保留输入，便于修正重试
    if (blocked === null) {
      setTooth("");
      setInstrumentLocation("");
    }
  };

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p>牙体牙髓 · 显微根管再治疗</p>
          <h2>牙位登记</h2>
        </div>
        <span className="rule-chip">登记后进入排队，不直接占用时段</span>
      </div>
      <div className="field-grid register-grid">
        <label>
          <span>牙位</span>
          <input
            value={tooth}
            placeholder="如 #36"
            onChange={(e) => setTooth(e.target.value)}
          />
        </label>
        <label>
          <span>风险级别</span>
          <select value={risk} onChange={(e) => setRisk(e.target.value as RiskLevel)}>
            <option value="低">低风险</option>
            <option value="中">中风险</option>
            <option value="高">高风险</option>
          </select>
        </label>
        <label>
          <span>残留器械位置</span>
          <input
            value={instrumentLocation}
            placeholder="如 MB 根管距根尖 3mm 断针"
            onChange={(e) => setInstrumentLocation(e.target.value)}
          />
        </label>
        <label>
          <span>复诊期限</span>
          <input
            type="date"
            value={followUpDue}
            onChange={(e) => setFollowUpDue(e.target.value)}
          />
        </label>
      </div>
      <div className="register-action">
        <button className="primary-action" onClick={submit}>
          登记并入队
        </button>
      </div>
    </section>
  );
}
