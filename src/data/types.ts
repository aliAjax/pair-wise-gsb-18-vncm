// 记录层：显微根管再治疗排程台的领域数据结构

export type RiskLevel = "低" | "中" | "高";

export type CaseStatus = "排队" | "已排程" | "已结案";

/** 牙位登记：残留器械位置、风险级别、显微镜时段、复诊期限 */
export interface ToothCase {
  id: string;
  /** 牙位，如 #36 */
  tooth: string;
  /** 残留器械位置 */
  instrumentLocation: string;
  /** 风险级别 */
  risk: RiskLevel;
  /** 显微镜时段，null 表示未占用时段、处于排队中 */
  slot: string | null;
  /** 复诊期限 YYYY-MM-DD */
  followUpDue: string;
  /** 取出结果，未登记为 null，未登记不得结案 */
  extractionResult: string | null;
  status: CaseStatus;
  /** 排队次序时间戳，风险升级/改约后刷新为当前时间，落到队尾 */
  queuedAt: number;
  createdAt: number;
}

export type RevisionKind =
  | "登记"
  | "排程"
  | "改约"
  | "风险升级"
  | "更正"
  | "取出结果"
  | "结案";

/** 修订记录：原因、旧值、时间均保留 */
export interface Revision {
  id: string;
  caseId: string;
  tooth: string;
  kind: RevisionKind;
  field: string;
  oldValue: string;
  newValue: string;
  reason: string;
  at: number;
}

/** 受阻记录：牙位、时段、风险原值、命中条件 */
export interface BlockInfo {
  id: string;
  caseId: string | null;
  /** 触发受阻的动作，如 安排时段 / 风险升级 / 改约 / 结案 */
  action: string;
  tooth: string;
  slot: string;
  riskOriginal: string;
  /** 命中条件 */
  condition: string;
  at: number;
}

export interface BoardState {
  version: 1;
  seq: number;
  cases: ToothCase[];
  revisions: Revision[];
  blocked: BlockInfo[];
}
