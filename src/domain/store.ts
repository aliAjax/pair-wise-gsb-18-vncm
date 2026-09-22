// 记录层：状态迁移与持久化，规则判定委托给判定层

import {
  checkCloseable,
  checkCorrectable,
  checkMutable,
  checkSlotAvailable,
} from "./rules";
import type {
  ActionResult,
  BoardState,
  MicroscopeSlot,
  RetreatCase,
  Revision,
  RiskLevel,
} from "./types";

const STORAGE_KEY = "hxwl-04:retreatment-board";

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

function now(): string {
  return new Date().toISOString();
}

function seedState(): BoardState {
  const t = now();
  return {
    cases: [
      {
        id: "case-seed-1",
        tooth: "#36",
        instrumentSite: "MB2 根管中段，分离器械约 3mm",
        risk: "高",
        slot: "08:30-10:00",
        followupBy: "2026-09-25",
        status: "已占用",
        retrievalResult: null,
        createdAt: t,
        closedAt: null,
      },
      {
        id: "case-seed-2",
        tooth: "#11",
        instrumentSite: "根管上段旧充填物伴桩核",
        risk: "中",
        slot: "10:30-12:00",
        followupBy: "2026-09-29",
        status: "已占用",
        retrievalResult: null,
        createdAt: t,
        closedAt: null,
      },
      {
        id: "case-seed-3",
        tooth: "#46",
        instrumentSite: "远中根管下段分离器械",
        risk: "高",
        slot: "08:30-10:00",
        followupBy: "2026-09-24",
        status: "排队中",
        retrievalResult: null,
        createdAt: t,
        closedAt: null,
      },
      {
        id: "case-seed-4",
        tooth: "#26",
        instrumentSite: "腭根根管台阶伴糊剂超填",
        risk: "低",
        slot: "14:00-15:30",
        followupBy: "2026-10-08",
        status: "排队中",
        retrievalResult: null,
        createdAt: t,
        closedAt: null,
      },
    ],
    revisions: [],
  };
}

export function loadState(): BoardState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState();
    const parsed = JSON.parse(raw) as BoardState;
    if (!Array.isArray(parsed.cases) || !Array.isArray(parsed.revisions)) {
      return seedState();
    }
    return parsed;
  } catch {
    return seedState();
  }
}

export function saveState(state: BoardState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState(): BoardState {
  const fresh = seedState();
  saveState(fresh);
  return fresh;
}

function ok(state: BoardState): ActionResult {
  return { state, blocked: null };
}

function fail(state: BoardState, blocked: ActionResult["blocked"]): ActionResult {
  return { state, blocked };
}

function patchCase(
  state: BoardState,
  id: string,
  patch: Partial<RetreatCase>,
): BoardState {
  return {
    ...state,
    cases: state.cases.map((c) => (c.id === id ? { ...c, ...patch } : c)),
  };
}

function appendRevision(state: BoardState, rev: Omit<Revision, "id" | "at">): BoardState {
  return {
    ...state,
    revisions: [...state.revisions, { ...rev, id: uid("rev"), at: now() }],
  };
}

/** 登记牙位案件：进入排队序列 */
export function registerCase(
  state: BoardState,
  input: {
    tooth: string;
    instrumentSite: string;
    risk: RiskLevel;
    slot: MicroscopeSlot;
    followupBy: string;
  },
): ActionResult {
  const kase: RetreatCase = {
    id: uid("case"),
    tooth: input.tooth,
    instrumentSite: input.instrumentSite,
    risk: input.risk,
    slot: input.slot,
    followupBy: input.followupBy,
    status: "排队中",
    retrievalResult: null,
    createdAt: now(),
    closedAt: null,
  };
  return ok({ ...state, cases: [...state.cases, kase] });
}

/** 尝试占用显微镜时段：命中时段独占则受阻 */
export function scheduleCase(state: BoardState, id: string): ActionResult {
  const kase = state.cases.find((c) => c.id === id);
  if (!kase) return fail(state, null);
  const mutable = checkMutable(kase);
  if (!mutable.ok) return fail(state, mutable.blocked);
  const verdict = checkSlotAvailable(state, kase);
  if (!verdict.ok) return fail(state, verdict.blocked);
  return ok(patchCase(state, id, { status: "已占用" }));
}

/**
 * 释放占用并重新排队，随后按新参数自动重排。
 * 风险升级与改约共用此路径：先归还原占用，再重新排队。
 */
function releaseAndRequeue(
  state: BoardState,
  id: string,
  patch: Partial<RetreatCase>,
  revision: Omit<Revision, "id" | "at">,
): ActionResult {
  const kase = state.cases.find((c) => c.id === id);
  if (!kase) return fail(state, null);
  const mutable = checkMutable(kase);
  if (!mutable.ok) return fail(state, mutable.blocked);

  // 第一步：归还原占用，回到排队序列并写入新参数
  let next = patchCase(state, id, { ...patch, status: "排队中" });
  next = appendRevision(next, revision);

  // 第二步：重新排队后尝试占用目标时段
  const updated = next.cases.find((c) => c.id === id)!;
  const verdict = checkSlotAvailable(next, updated);
  if (!verdict.ok) return fail(next, verdict.blocked);
  return ok(patchCase(next, id, { status: "已占用" }));
}

/** 风险升级：先归还原占用再重新排队 */
export function escalateRisk(
  state: BoardState,
  id: string,
  risk: RiskLevel,
  reason: string,
): ActionResult {
  const kase = state.cases.find((c) => c.id === id);
  if (!kase) return fail(state, null);
  if (kase.risk === risk) return ok(state);
  return releaseAndRequeue(state, id, { risk }, {
    caseId: id,
    tooth: kase.tooth,
    kind: "风险升级",
    field: "风险级别",
    oldValue: kase.risk,
    newValue: risk,
    reason: reason || "风险升级",
  });
}

/** 改约时段：先归还原占用再重新排队 */
export function rescheduleSlot(
  state: BoardState,
  id: string,
  slot: MicroscopeSlot,
  reason: string,
): ActionResult {
  const kase = state.cases.find((c) => c.id === id);
  if (!kase) return fail(state, null);
  if (kase.slot === slot) return ok(state);
  return releaseAndRequeue(state, id, { slot }, {
    caseId: id,
    tooth: kase.tooth,
    kind: "改约",
    field: "显微镜时段",
    oldValue: kase.slot,
    newValue: slot,
    reason: reason || "改约",
  });
}

/** 登记取出结果 */
export function registerRetrieval(
  state: BoardState,
  id: string,
  result: string,
): ActionResult {
  const kase = state.cases.find((c) => c.id === id);
  if (!kase) return fail(state, null);
  const mutable = checkMutable(kase);
  if (!mutable.ok) return fail(state, mutable.blocked);
  return ok(patchCase(state, id, { retrievalResult: result }));
}

/** 结案：取出结果未登记不得结案；结案后释放时段并冻结 */
export function closeCase(state: BoardState, id: string): ActionResult {
  const kase = state.cases.find((c) => c.id === id);
  if (!kase) return fail(state, null);
  const verdict = checkCloseable(kase);
  if (!verdict.ok) return fail(state, verdict.blocked);
  return ok(patchCase(state, id, { status: "已结案", closedAt: now() }));
}

/** 结案后更正：冻结案件的唯一修改通道，保留原因、旧值与时间 */
export function correctCase(
  state: BoardState,
  id: string,
  field: "instrumentSite" | "followupBy" | "retrievalResult",
  newValue: string,
  reason: string,
): ActionResult {
  const kase = state.cases.find((c) => c.id === id);
  if (!kase) return fail(state, null);
  const verdict = checkCorrectable(kase, reason);
  if (!verdict.ok) return fail(state, verdict.blocked);

  const fieldLabel =
    field === "instrumentSite" ? "残留器械位置"
    : field === "followupBy" ? "复诊期限"
    : "取出结果";
  const oldValue = String(kase[field] ?? "");

  let next = patchCase(state, id, { [field]: newValue });
  next = appendRevision(next, {
    caseId: id,
    tooth: kase.tooth,
    kind: "结案更正",
    field: fieldLabel,
    oldValue,
    newValue,
    reason,
  });
  return ok(next);
}
