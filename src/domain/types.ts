// 记录层数据模型：显微根管再治疗排程台

export type RiskLevel = "低" | "中" | "高";

export type CaseStatus = "排队中" | "已占用" | "已结案";

/** 显微镜时段（每日固定台次） */
export const MICROSCOPE_SLOTS = [
  "08:30-10:00",
  "10:30-12:00",
  "14:00-15:30",
  "16:00-17:30",
] as const;

export type MicroscopeSlot = (typeof MICROSCOPE_SLOTS)[number];

/** 牙位再治疗案件 */
export interface RetreatCase {
  id: string;
  tooth: string; // 牙位，如 #36
  instrumentSite: string; // 残留器械位置，如 MB2 根管中段
  risk: RiskLevel; // 风险级别
  slot: MicroscopeSlot; // 申请/占用的显微镜时段
  followupBy: string; // 复诊期限 YYYY-MM-DD
  status: CaseStatus;
  retrievalResult: string | null; // 取出结果，未登记不得结案
  createdAt: string;
  closedAt: string | null;
}

/** 修订记录：风险升级、改约、结案后更正均留痕 */
export interface Revision {
  id: string;
  caseId: string;
  tooth: string;
  kind: "风险升级" | "改约" | "结案更正";
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
  at: string;
}

export interface BoardState {
  cases: RetreatCase[];
  revisions: Revision[];
}

/** 受阻信息：牙位、时段、风险原值、命中条件 */
export interface BlockedInfo {
  tooth: string;
  slot: string;
  risk: RiskLevel;
  condition: string;
  at: string;
}

export type RuleResult = { ok: true } | { ok: false; blocked: BlockedInfo };

export interface ActionResult {
  state: BoardState;
  blocked: BlockedInfo | null;
}
