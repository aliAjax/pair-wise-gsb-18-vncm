import type { BlockInfo, BoardState, Revision, ToothCase } from "../data/types";

// 判定层：纯派生数据（无副作用），展示层只从这里取视图模型

export interface QueueItem {
  item: ToothCase;
  order: number;
  overdue: boolean;
}

export interface SlotOccupancy {
  slot: string;
  case: ToothCase;
}

export interface BoardMetrics {
  queued: number;
  scheduled: number;
  closed: number;
  pendingExtraction: number;
}

function isOverdue(item: ToothCase, now: number): boolean {
  if (item.status === "已结案") return false;
  const due = Date.parse(`${item.followUpDue}T23:59:59`);
  if (Number.isNaN(due)) return false;
  return due < now;
}

/** 队列：排队中按重新排队时刻（queuedAt）升序；已排程/已结案不在队列 */
export function selectQueue(state: BoardState, now: number): QueueItem[] {
  return state.cases
    .filter((item) => item.status === "排队")
    .sort((a, b) => a.queuedAt - b.queuedAt)
    .map((item, index) => ({ item, order: index + 1, overdue: isOverdue(item, now) }));
}

/** 显微镜时段占用：同一时段最多一台；按时间标签排序 */
export function selectOccupancy(state: BoardState): SlotOccupancy[] {
  return state.cases
    .filter((item) => item.status !== "已结案" && item.slot !== null)
    .map((item) => ({ slot: item.slot as string, case: item }))
    .sort((a, b) => (a.slot < b.slot ? -1 : a.slot > b.slot ? 1 : 0));
}

export function selectMetrics(state: BoardState): BoardMetrics {
  return {
    queued: state.cases.filter((item) => item.status === "排队").length,
    scheduled: state.cases.filter((item) => item.status === "已排程").length,
    closed: state.cases.filter((item) => item.status === "已结案").length,
    pendingExtraction: state.cases.filter((item) => item.extractionResult === null).length,
  };
}

/** 一致性自检：刷新后牙位、排队、占用必须互不矛盾 */
export interface ConsistencyIssue {
  message: string;
}

export function checkConsistency(state: BoardState): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const seenTeeth = new Set<string>();
  const slotOwners = new Map<string, string>();

  for (const item of state.cases) {
    if (seenTeeth.has(item.tooth)) {
      issues.push({ message: `牙位 ${item.tooth} 重复登记` });
    }
    seenTeeth.add(item.tooth);

    if (item.status === "排队" && item.slot !== null) {
      issues.push({ message: `牙位 ${item.tooth} 处于排队却仍占用时段 ${item.slot}` });
    }
    if (item.status === "已结案") {
      if (item.extractionResult === null) {
        issues.push({ message: `牙位 ${item.tooth} 已结案但缺少取出结果` });
      }
      if (item.slot !== null) {
        issues.push({ message: `牙位 ${item.tooth} 已结案但未释放时段 ${item.slot}` });
      }
    }
    if (item.status === "已排程" && item.slot === null) {
      issues.push({ message: `牙位 ${item.tooth} 已排程但缺时段` });
    }
    if (item.slot !== null && item.status !== "已结案") {
      const owner = slotOwners.get(item.slot);
      if (owner) {
        issues.push({
          message: `同一时段 ${item.slot} 被 ${owner} 与 ${item.tooth} 同时占用`,
        });
      } else {
        slotOwners.set(item.slot, item.tooth);
      }
    }
  }
  return issues;
}

export function selectCasesView(state: BoardState, now: number) {
  return state.cases
    .slice()
    .sort((a, b) => a.queuedAt - b.queuedAt)
    .map((item) => ({ item, overdue: isOverdue(item, now) }));
}

export function selectRevisions(state: BoardState): Revision[] {
  return state.revisions.slice().sort((a, b) => b.at - a.at);
}

export function selectBlocked(state: BoardState): BlockInfo[] {
  return state.blocked.slice().sort((a, b) => b.at - a.at);
}
