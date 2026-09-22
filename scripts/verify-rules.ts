import { decide } from "../src/domain/rules";
import { checkConsistency, selectOccupancy, selectQueue } from "../src/domain/selectors";
import { seedState } from "../src/data/seed";
import type { BoardState } from "../src/data/types";

let passed = 0;
let failed = 0;

function assert(name: string, cond: boolean, detail = ""): void {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name} ${detail}`);
  }
}

function find(state: BoardState, tooth: string) {
  return state.cases.find((c) => c.tooth === tooth)!;
}

let s = seedState;
const now = Date.now();

console.log("1. 登记");
{
  const r = decide(s, {
    type: "register",
    input: { tooth: "47", instrumentLocation: "近颊断针", risk: "中", followUpDue: "2026-10-01" },
  });
  assert("登记成功并入队", r.blocked === null);
  s = r.state;
  assert("新牙位排队无时段", find(s, "#47").status === "排队" && find(s, "#47").slot === null);
  const dup = decide(s, {
    type: "register",
    input: { tooth: "#36", instrumentLocation: "x", risk: "低", followUpDue: "2026-10-01" },
  });
  assert("重复牙位受阻", dup.blocked !== null && dup.blocked.tooth === "#36");
  assert("受阻不改变状态", dup.state.cases.length === s.cases.length);
  s = dup.state;
  const miss = decide(s, {
    type: "register",
    input: { tooth: "", instrumentLocation: "", risk: "低", followUpDue: "" },
  });
  assert("缺字段受阻含命中条件", miss.blocked!.condition.includes("命中条件"));
}

console.log("2. 同一时段一台显微镜");
{
  const c47 = find(s, "#47");
  const r = decide(s, { type: "schedule", caseId: c47.id, slot: "09-23 09:00" });
  assert("占用冲突受阻", r.blocked !== null);
  assert("受阻含牙位/时段/风险原值/命中条件",
    r.blocked!.tooth === "#47" &&
    r.blocked!.slot === "09-23 09:00" &&
    r.blocked!.riskOriginal === "中" &&
    r.blocked!.condition.includes("#36"));
  assert("冲突后仍排队未占用", find(r.state, "#47").status === "排队");
  s = r.state;
  const ok = decide(s, { type: "schedule", caseId: c47.id, slot: "09-24 14:00" });
  assert("空闲时段排程成功", ok.blocked === null && find(ok.state, "#47").slot === "09-24 14:00");
  s = ok.state;
}

console.log("3. 改约：先归还再重排");
{
  const c36 = find(s, "#36");
  const before = c36.queuedAt;
  // 改约到一个被占用时段 -> 先释放、排队、受阻
  const conflict = decide(s, { type: "reschedule", caseId: c36.id, slot: "09-23 10:30" });
  assert("改约冲突受阻", conflict.blocked !== null);
  const c36b = find(conflict.state, "#36");
  assert("已归还原占用并回到排队", c36b.slot === null && c36b.status === "排队");
  assert("重新排队票据刷新", c36b.queuedAt >= before);
  assert("对方占用未被破坏", find(conflict.state, "#11").slot === "09-23 10:30");
  assert("改约留下归还修订",
    conflict.state.revisions.some((r) => r.caseId === c36.id && r.kind === "改约" && r.oldValue === "09-23 09:00"));
  s = conflict.state;
  // 改约到空闲时段
  const ok = decide(s, { type: "reschedule", caseId: c36.id, slot: "09-25 09:00" });
  assert("改约到空闲时段成功", ok.blocked === null && find(ok.state, "#36").slot === "09-25 09:00");
  s = ok.state;
}

console.log("4. 风险升级：先归还再排队");
{
  const c11 = find(s, "#11");
  const same = decide(s, { type: "escalate", caseId: c11.id, risk: "中" });
  assert("非升级（中→中）受阻", same.blocked !== null && same.blocked.riskOriginal === "中");
  const down = decide(s, { type: "escalate", caseId: c11.id, risk: "低" });
  assert("降级受阻", down.blocked !== null);
  const up = decide(s, { type: "escalate", caseId: c11.id, risk: "高" });
  const c11b = find(up.state, "#11");
  assert("升级成功", up.blocked === null && c11b.risk === "高");
  assert("升级后归还时段并排队", c11b.slot === null && c11b.status === "排队");
  assert("升级保留风险旧值", up.state.revisions.some((r) =>
    r.kind === "风险升级" && r.field === "风险级别" && r.oldValue === "中" && r.newValue === "高"));
  s = up.state;
}

console.log("5. 取出结果未登记不得结案 / 结案冻结");
{
  const c47 = find(s, "#47");
  const noResult = decide(s, { type: "close", caseId: c47.id });
  assert("无取出结果结案受阻", noResult.blocked !== null && noResult.blocked.condition.includes("取出结果未登记"));
  const reg = decide(s, { type: "recordExtraction", caseId: c47.id, result: "完整取出" });
  assert("登记取出结果成功", reg.blocked === null && find(reg.state, "#47").extractionResult === "完整取出");
  s = reg.state;
  const closed = decide(s, { type: "close", caseId: c47.id });
  assert("有取出结果结案成功", closed.blocked === null);
  s = closed.state;
  const frozenActs = [
    decide(s, { type: "schedule", caseId: c47.id, slot: "09-26 09:00" }),
    decide(s, { type: "escalate", caseId: c47.id, risk: "高" }),
    decide(s, { type: "correct", caseId: c47.id, field: "followUpDue", newValue: "2026-11-01", reason: "x" }),
  ];
  assert("结案后所有变更受阻且冻结", frozenActs.every((r) => r.blocked !== null && r.blocked.condition.includes("冻结")));
  assert("冻结尝试不产生修订", frozenActs.every((r) => r.state.revisions.length === s.revisions.length));
}

console.log("6. 更正保留原因/旧值/时间");
{
  const c46 = find(s, "#46");
  const noReason = decide(s, {
    type: "correct", caseId: c46.id, field: "instrumentLocation", newValue: "修正描述", reason: "  ",
  });
  assert("更正无原因受阻", noReason.blocked !== null);
  const ok = decide(s, {
    type: "correct", caseId: c46.id, field: "instrumentLocation", newValue: "影像复核：远舌弯曲处", reason: "CBCT复核",
  });
  const rev = ok.state.revisions.find((r) => r.kind === "更正")!;
  assert("更正写入原因/旧值/新值/时间",
    rev.reason === "CBCT复核" &&
    rev.oldValue === "近舌根管弯曲处金属碎屑" &&
    rev.newValue === "影像复核：远舌弯曲处" &&
    typeof rev.at === "number");
  s = ok.state;
}

console.log("7. 一致性");
{
  const issues = checkConsistency(s);
  assert("最终状态无牙位/排队/占用矛盾", issues.length === 0, issues.map((i) => i.message).join("; "));
  const occ = selectOccupancy(s).map((o) => o.slot);
  assert("占用台每个时段唯一", new Set(occ).size === occ.length);
  const q = selectQueue(s, now).map((q) => q.item.tooth);
  assert("队列仅含排队牙位", q.includes("#11") && q.includes("#46") && !q.includes("#47"));
  const order = selectQueue(s, now);
  assert("队列按 queuedAt 升序",
    order.every((item, i) => i === 0 || order[i - 1].item.queuedAt <= item.item.queuedAt));
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
