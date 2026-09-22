// 判定层：纯函数规则，不依赖记录层与展示层

import type {
  BoardState,
  CaseStatus,
  MicroscopeSlot,
  RetreatCase,
  RiskLevel,
  RuleResult,
} from "./types";

const RISK_RANK: Record<RiskLevel, number> = { 高: 0, 中: 1, 低: 2 };

function blocked(
  kase: Pick<RetreatCase, "tooth" | "slot" | "risk">,
  condition: string,
  slotOverride?: string,
): RuleResult {
  return {
    ok: false,
    blocked: {
      tooth: kase.tooth,
      slot: slotOverride ?? kase.slot,
      risk: kase.risk, // 风险原值
      condition,
      at: new Date().toISOString(),
    },
  };
}

/** 时段占用者：同一时段只能安排一台显微镜 */
export function slotOccupant(
  state: BoardState,
  slot: MicroscopeSlot,
  excludeId?: string,
): RetreatCase | undefined {
  return state.cases.find(
    (c) => c.status === "已占用" && c.slot === slot && c.id !== excludeId,
  );
}

/** 规则一：时段独占。占用前判定 */
export function checkSlotAvailable(
  state: BoardState,
  kase: RetreatCase,
): RuleResult {
  const occupant = slotOccupant(state, kase.slot, kase.id);
  if (occupant) {
    return blocked(
      kase,
      `同一时段只能安排一台显微镜：${kase.slot} 已被 ${occupant.tooth} 占用`,
    );
  }
  return { ok: true };
}

/** 规则二：结案门禁。取出结果未登记不得结案 */
export function checkCloseable(kase: RetreatCase): RuleResult {
  if (kase.status === "已结案") {
    return blocked(kase, "案件已结案，不得重复结案");
  }
  if (!kase.retrievalResult || kase.retrievalResult.trim() === "") {
    return blocked(kase, "取出结果未登记，不得结案");
  }
  return { ok: true };
}

/** 规则三：结案冻结。结案后直接修改被拦截，须走更正流程 */
export function checkMutable(kase: RetreatCase): RuleResult {
  if (kase.status === "已结案") {
    return blocked(kase, "案件已结案冻结，更正须登记原因并保留旧值与时间");
  }
  return { ok: true };
}

/** 规则四：更正门禁。仅结案案件允许更正，且必须填写原因 */
export function checkCorrectable(kase: RetreatCase, reason: string): RuleResult {
  if (kase.status !== "已结案") {
    return blocked(kase, "仅结案案件需要更正流程，未结案案件可直接修改");
  }
  if (!reason || reason.trim() === "") {
    return blocked(kase, "结案更正必须登记原因");
  }
  return { ok: true };
}

/** 排队序列：风险高者优先，同级按复诊期限先到先排 */
export function sortQueue(cases: RetreatCase[]): RetreatCase[] {
  return cases
    .filter((c) => c.status === "排队中")
    .sort((a, b) => {
      const byRisk = RISK_RANK[a.risk] - RISK_RANK[b.risk];
      if (byRisk !== 0) return byRisk;
      return a.followupBy.localeCompare(b.followupBy);
    });
}

/** 占用视图：时段 → 占用案件 */
export function occupancyBySlot(
  state: BoardState,
): Map<MicroscopeSlot, RetreatCase> {
  const map = new Map<MicroscopeSlot, RetreatCase>();
  for (const c of state.cases) {
    if (c.status === "已占用") map.set(c.slot, c);
  }
  return map;
}

export function isOpenStatus(status: CaseStatus): boolean {
  return status !== "已结案";
}
