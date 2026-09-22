import type {
  BlockInfo,
  BoardState,
  Revision,
  RiskLevel,
  ToothCase,
} from "../data/types";

// 判定层：排程规则全部集中于此，纯函数、无副作用、不依赖 React/存储
// 规则：
// 1. 牙位登记残留器械位置、风险级别、显微镜时段、复诊期限
// 2. 同一时段只能安排一台显微镜
// 3. 风险升级或改约时先归还原占用再重新排队
// 4. 取出结果未登记不得结案；结案后冻结
// 5. 更正保留原因、旧值和时间

export type RegisterInput = {
  tooth: string;
  instrumentLocation: string;
  risk: RiskLevel;
  followUpDue: string;
};

export type CorrectableField = "instrumentLocation" | "followUpDue" | "extractionResult";

export type BoardAction =
  | { type: "register"; input: RegisterInput }
  | { type: "schedule"; caseId: string; slot: string }
  | { type: "reschedule"; caseId: string; slot: string }
  | { type: "escalate"; caseId: string; risk: RiskLevel }
  | {
      type: "correct";
      caseId: string;
      field: CorrectableField;
      newValue: string;
      reason: string;
    }
  | { type: "recordExtraction"; caseId: string; result: string }
  | { type: "close"; caseId: string };

export interface DecisionResult {
  state: BoardState;
  blocked: BlockInfo | null;
}

const RISK_ORDER: Record<RiskLevel, number> = { 低: 1, 中: 2, 高: 3 };
const MAX_BLOCKS = 20;

function nextId(kind: "C" | "R" | "B", seq: number): string {
  return `${kind}-${String(seq).padStart(4, "0")}`;
}

function normalizeTooth(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return /^\d/.test(trimmed) ? `#${trimmed}` : trimmed;
}

function normalizeSlot(raw: string): string {
  return raw.trim();
}

function pushRevision(state: BoardState, rev: Omit<Revision, "id">, seq: number): Revision {
  return { ...rev, id: nextId("R", seq) };
}

function makeBlock(
  state: BoardState,
  parts: {
    caseId: string | null;
    action: string;
    tooth: string;
    slot: string;
    riskOriginal: string;
    condition: string;
  },
): BlockInfo {
  return {
    id: nextId("B", state.seq),
    caseId: parts.caseId,
    action: parts.action,
    tooth: parts.tooth,
    slot: parts.slot,
    riskOriginal: parts.riskOriginal,
    condition: parts.condition,
    at: Date.now(),
  };
}

/** 追加受阻记录并截断长度；受阻同样持久化，刷新后仍可见 */
function withBlock(state: BoardState, block: BlockInfo): BoardState {
  const blocked = [...state.blocked, block].slice(-MAX_BLOCKS);
  return { ...state, blocked, seq: state.seq + 1 };
}

function reject(state: BoardState, block: BlockInfo): DecisionResult {
  return { state: withBlock(state, block), blocked: block };
}

function updateCase(
  state: BoardState,
  caseId: string,
  patch: Partial<ToothCase>,
): ToothCase[] {
  return state.cases.map((item) =>
    item.id === caseId ? { ...item, ...patch } : item,
  );
}

function commit(
  state: BoardState,
  cases: ToothCase[],
  revisions: Revision[],
): BoardState {
  return {
    ...state,
    cases,
    revisions: [...state.revisions, ...revisions],
    seq: state.seq + revisions.length,
  };
}

/** 占用判定：已结案档案不再占用时点；其余同一时段唯一 */
function occupantOf(state: BoardState, slot: string, excludeId?: string): ToothCase | undefined {
  return state.cases.find(
    (item) =>
      item.status !== "已结案" &&
      item.slot === slot &&
      item.id !== excludeId,
  );
}

function frozenBlock(state: BoardState, target: ToothCase, action: string): DecisionResult {
  return reject(
    state,
    makeBlock(state, {
      caseId: target.id,
      action,
      tooth: target.tooth,
      slot: target.slot ?? "—",
      riskOriginal: target.risk,
      condition: "命中条件：该牙位已结案并冻结，结案后禁止任何变更",
    }),
  );
}

function decideRegister(state: BoardState, input: RegisterInput): DecisionResult {
  const tooth = normalizeTooth(input.tooth);
  const location = input.instrumentLocation.trim();
  const due = input.followUpDue.trim();

  const fail = (condition: string) =>
    reject(
      state,
      makeBlock(state, {
        caseId: null,
        action: "登记建档",
        tooth: tooth || "—",
        slot: "—",
        riskOriginal: input.risk,
        condition,
      }),
    );

  if (!tooth) return fail("命中条件：牙位不能为空");
  if (!location) return fail("命中条件：残留器械位置必须登记");
  if (!due) return fail("命中条件：复诊期限必须登记");
  if (state.cases.some((item) => item.tooth === tooth)) {
    return fail(`命中条件：牙位 ${tooth} 已存在（含已结案档案），不得重复登记`);
  }

  const now = Date.now();
  const id = nextId("C", state.seq);
  const created: ToothCase = {
    id,
    tooth,
    instrumentLocation: location,
    risk: input.risk,
    slot: null,
    followUpDue: due,
    extractionResult: null,
    status: "排队",
    queuedAt: now,
    createdAt: now,
  };
  const revision = pushRevision(
    state,
    {
      caseId: id,
      tooth,
      kind: "登记",
      field: "—",
      oldValue: "—",
      newValue: "登记建档，进入排队",
      reason: "初诊登记",
      at: now,
    },
    state.seq + 1,
  );
  return {
    state: {
      ...state,
      cases: [...state.cases, created],
      revisions: [...state.revisions, revision],
      seq: state.seq + 2,
    },
    blocked: null,
  };
}

function decideSchedule(state: BoardState, caseId: string, rawSlot: string): DecisionResult {
  const target = state.cases.find((item) => item.id === caseId);
  if (!target) return reject(state, missingCaseBlock(state, caseId, "安排时段"));
  if (target.status === "已结案") return frozenBlock(state, target, "安排时段");

  const slot = normalizeSlot(rawSlot);
  if (!slot) {
    return reject(
      state,
      makeBlock(state, {
        caseId: target.id,
        action: "安排时段",
        tooth: target.tooth,
        slot: "—",
        riskOriginal: target.risk,
        condition: "命中条件：显微镜时段不能为空",
      }),
    );
  }
  if (target.slot !== null) {
    return reject(
      state,
      makeBlock(state, {
        caseId: target.id,
        action: "安排时段",
        tooth: target.tooth,
        slot: target.slot,
        riskOriginal: target.risk,
        condition: "命中条件：该牙位已占用时段，改约须先归还原占用，请使用「改约」",
      }),
    );
  }

  const occupant = occupantOf(state, slot, target.id);
  if (occupant) {
    return reject(
      state,
      makeBlock(state, {
        caseId: target.id,
        action: "安排时段",
        tooth: target.tooth,
        slot,
        riskOriginal: target.risk,
        condition: `命中条件：同一时段只能安排一台显微镜，时段 ${slot} 已被 ${occupant.tooth} 占用`,
      }),
    );
  }

  const now = Date.now();
  const revision = pushRevision(
    state,
    {
      caseId: target.id,
      tooth: target.tooth,
      kind: "排程",
      field: "显微镜时段",
      oldValue: "空（排队中）",
      newValue: slot,
      reason: "安排显微镜时段",
      at: now,
    },
    state.seq,
  );
  return {
    state: commit(
      state,
      updateCase(state, target.id, { slot, status: "已排程" }),
      [revision],
    ),
    blocked: null,
  };
}

function decideReschedule(state: BoardState, caseId: string, rawSlot: string): DecisionResult {
  const target = state.cases.find((item) => item.id === caseId);
  if (!target) return reject(state, missingCaseBlock(state, caseId, "改约"));
  if (target.status === "已结案") return frozenBlock(state, target, "改约");

  const slot = normalizeSlot(rawSlot);
  const oldSlot = target.slot;
  if (!slot) {
    return reject(
      state,
      makeBlock(state, {
        caseId: target.id,
        action: "改约",
        tooth: target.tooth,
        slot: target.slot ?? "—",
        riskOriginal: target.risk,
        condition: "命中条件：新显微镜时段不能为空",
      }),
    );
  }
  if (oldSlot === slot) {
    return reject(
      state,
      makeBlock(state, {
        caseId: target.id,
        action: "改约",
        tooth: target.tooth,
        slot,
        riskOriginal: target.risk,
        condition: "命中条件：新时段与当前占用一致，无需改约",
      }),
    );
  }

  const now = Date.now();

  // 规则：改约先归还原占用、再重新排队（排队票据刷新到当前时刻）
  const releasedCases = updateCase(state, target.id, {
    slot: null,
    status: "排队",
    queuedAt: now,
  });
  const releasedState = { ...state, cases: releasedCases };

  const occupant = occupantOf(releasedState, slot, target.id);
  if (occupant) {
    // 已归还并回到队尾；新时段命中唯一占用条件
    const revision = pushRevision(
      releasedState,
      {
        caseId: target.id,
        tooth: target.tooth,
        kind: "改约",
        field: "显微镜时段",
        oldValue: oldSlot ?? "空（排队中）",
        newValue: "空（已归还，重新排队）",
        reason: `改约先归还原占用，再重新排队；目标时段 ${slot} 受阻`,
        at: now,
      },
      releasedState.seq,
    );
    const intermediate = commit(releasedState, releasedCases, [revision]);
    return reject(
      intermediate,
      makeBlock(intermediate, {
        caseId: target.id,
        action: "改约",
        tooth: target.tooth,
        slot,
        riskOriginal: target.risk,
        condition: `命中条件：同一时段只能安排一台显微镜，时段 ${slot} 已被 ${occupant.tooth} 占用；原占用 ${oldSlot ?? "无"} 已归还，牙位回到队尾`,
      }),
    );
  }

  const revision = pushRevision(
    releasedState,
    {
      caseId: target.id,
      tooth: target.tooth,
      kind: "改约",
      field: "显微镜时段",
      oldValue: oldSlot ?? "空（排队中）",
      newValue: slot,
      reason: "改约：先归还原占用、重新排队后占用新时段",
      at: now,
    },
    releasedState.seq,
  );
  return {
    state: commit(
      releasedState,
      updateCase(releasedState, target.id, { slot, status: "已排程" }),
      [revision],
    ),
    blocked: null,
  };
}

function decideEscalate(state: BoardState, caseId: string, risk: RiskLevel): DecisionResult {
  const target = state.cases.find((item) => item.id === caseId);
  if (!target) return reject(state, missingCaseBlock(state, caseId, "风险升级"));
  if (target.status === "已结案") return frozenBlock(state, target, "风险升级");

  if (RISK_ORDER[risk] <= RISK_ORDER[target.risk]) {
    return reject(
      state,
      makeBlock(state, {
        caseId: target.id,
        action: "风险升级",
        tooth: target.tooth,
        slot: target.slot ?? "—",
        riskOriginal: target.risk,
        condition: `命中条件：仅支持风险升级（低→中→高），风险原值「${target.risk}」不得改为「${risk}」`,
      }),
    );
  }

  const now = Date.now();
  const revisions: Revision[] = [
    pushRevision(
      state,
      {
        caseId: target.id,
        tooth: target.tooth,
        kind: "风险升级",
        field: "风险级别",
        oldValue: target.risk,
        newValue: risk,
        reason: "风险升级",
        at: now,
      },
      state.seq,
    ),
  ];

  // 规则：风险升级先归还原占用、再重新排队
  const patch: Partial<ToothCase> = { risk, queuedAt: now };
  if (target.slot !== null) {
    patch.slot = null;
    patch.status = "排队";
    revisions.push(
      pushRevision(
        state,
        {
          caseId: target.id,
          tooth: target.tooth,
          kind: "风险升级",
          field: "显微镜时段",
          oldValue: target.slot,
          newValue: "空（已归还，重新排队）",
          reason: "风险升级，归还原占用并重新排队",
          at: now,
        },
        state.seq + 1,
      ),
    );
  }

  return { state: commit(state, updateCase(state, target.id, patch), revisions), blocked: null };
}

const FIELD_LABEL: Record<CorrectableField, string> = {
  instrumentLocation: "残留器械位置",
  followUpDue: "复诊期限",
  extractionResult: "取出结果",
};

function fieldValue(target: ToothCase, field: CorrectableField): string {
  if (field === "extractionResult") return target.extractionResult ?? "";
  return target[field];
}

function decideCorrect(
  state: BoardState,
  caseId: string,
  field: CorrectableField,
  rawValue: string,
  rawReason: string,
): DecisionResult {
  const target = state.cases.find((item) => item.id === caseId);
  if (!target) return reject(state, missingCaseBlock(state, caseId, "更正"));
  if (target.status === "已结案") return frozenBlock(state, target, "更正");

  const newValue = rawValue.trim();
  const reason = rawReason.trim();

  const fail = (condition: string) =>
    reject(
      state,
      makeBlock(state, {
        caseId: target.id,
        action: "更正",
        tooth: target.tooth,
        slot: target.slot ?? "—",
        riskOriginal: target.risk,
        condition,
      }),
    );

  if (!newValue) return fail(`命中条件：${FIELD_LABEL[field]}更正后的新值不能为空`);
  if (!reason) return fail("命中条件：更正必须保留原因");

  const oldValue = fieldValue(target, field) || "空";
  if (oldValue === newValue) {
    return fail(`命中条件：${FIELD_LABEL[field]}新值与旧值一致，无需更正`);
  }

  const now = Date.now();
  const revision = pushRevision(
    state,
    {
      caseId: target.id,
      tooth: target.tooth,
      kind: "更正",
      field: FIELD_LABEL[field],
      oldValue,
      newValue,
      reason,
      at: now,
    },
    state.seq,
  );
  const patch: Partial<ToothCase> =
    field === "extractionResult" ? { extractionResult: newValue } : { [field]: newValue };
  return { state: commit(state, updateCase(state, target.id, patch), [revision]), blocked: null };
}

function decideExtraction(state: BoardState, caseId: string, rawResult: string): DecisionResult {
  const target = state.cases.find((item) => item.id === caseId);
  if (!target) return reject(state, missingCaseBlock(state, caseId, "登记取出结果"));
  if (target.status === "已结案") return frozenBlock(state, target, "登记取出结果");

  const result = rawResult.trim();
  const fail = (condition: string) =>
    reject(
      state,
      makeBlock(state, {
        caseId: target.id,
        action: "登记取出结果",
        tooth: target.tooth,
        slot: target.slot ?? "—",
        riskOriginal: target.risk,
        condition,
      }),
    );

  if (!result) return fail("命中条件：取出结果内容不能为空");
  if (target.extractionResult !== null) {
    return fail("命中条件：取出结果已登记，如需变更请走「更正」并填写原因");
  }

  const now = Date.now();
  const revision = pushRevision(
    state,
    {
      caseId: target.id,
      tooth: target.tooth,
      kind: "取出结果",
      field: "取出结果",
      oldValue: "未登记",
      newValue: result,
      reason: "登记取出结果",
      at: now,
    },
    state.seq,
  );
  return {
    state: commit(state, updateCase(state, target.id, { extractionResult: result }), [revision]),
    blocked: null,
  };
}

function decideClose(state: BoardState, caseId: string): DecisionResult {
  const target = state.cases.find((item) => item.id === caseId);
  if (!target) return reject(state, missingCaseBlock(state, caseId, "结案"));
  if (target.status === "已结案") return frozenBlock(state, target, "结案");

  if (target.extractionResult === null) {
    return reject(
      state,
      makeBlock(state, {
        caseId: target.id,
        action: "结案",
        tooth: target.tooth,
        slot: target.slot ?? "—",
        riskOriginal: target.risk,
        condition: "命中条件：取出结果未登记不得结案",
      }),
    );
  }

  const now = Date.now();
  const revisions: Revision[] = [
    pushRevision(
      state,
      {
        caseId: target.id,
        tooth: target.tooth,
        kind: "结案",
        field: "状态",
        oldValue: target.status,
        newValue: "已结案（冻结）",
        reason: "取出结果已登记，结案并冻结",
        at: now,
      },
      state.seq,
    ),
  ];
  const patch: Partial<ToothCase> = { status: "已结案" };
  if (target.slot !== null) {
    patch.slot = null;
    revisions.push(
      pushRevision(
        state,
        {
          caseId: target.id,
          tooth: target.tooth,
          kind: "结案",
          field: "显微镜时段",
          oldValue: target.slot,
          newValue: "空（结案释放）",
          reason: "结案后冻结，归还原占用时段",
          at: now,
        },
        state.seq + 1,
      ),
    );
  }
  return { state: commit(state, updateCase(state, target.id, patch), revisions), blocked: null };
}

function missingCaseBlock(state: BoardState, caseId: string, action: string): BlockInfo {
  return makeBlock(state, {
    caseId,
    action,
    tooth: "—",
    slot: "—",
    riskOriginal: "—",
    condition: "命中条件：牙位档案不存在或已被移除",
  });
}

export function decide(state: BoardState, action: BoardAction): DecisionResult {
  switch (action.type) {
    case "register":
      return decideRegister(state, action.input);
    case "schedule":
      return decideSchedule(state, action.caseId, action.slot);
    case "reschedule":
      return decideReschedule(state, action.caseId, action.slot);
    case "escalate":
      return decideEscalate(state, action.caseId, action.risk);
    case "correct":
      return decideCorrect(state, action.caseId, action.field, action.newValue, action.reason);
    case "recordExtraction":
      return decideExtraction(state, action.caseId, action.result);
    case "close":
      return decideClose(state, action.caseId);
  }
}
