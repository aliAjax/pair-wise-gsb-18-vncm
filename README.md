# hxwl-04 显微根管再治疗排程台

在原根管看板上扩展：按牙位组织残留器械、风险级别、显微镜时段与复诊期限，
支持排队、占用、升级/改约重排、取出结果登记、结案冻结与修订留痕。

## 业务规则

- 牙位登记：残留器械位置、风险级别、显微镜时段（登记时为空，先入队）、复诊期限
- 同一时段只能安排一台显微镜；冲突时操作受阻，不产生部分变更
- 风险升级或改约：**先归还原占用、再重新排队**（排队次序刷新到当前时刻，落到队尾）
- 取出结果未登记不得结案；结案后档案冻结，任何变更一律受阻
- 所有变更写入修订流水：保留类型、字段、旧值、新值、原因与时间
- 受阻记录持久化：显示牙位、时段、风险原值与命中条件
- 刷新后牙位、排队、时段占用、修订与受阻记录保持一致（localStorage 持久化）

## 分层结构（记录层 / 判定层 / 展示层独立，无新增依赖）

```
src/
├── data/                 # 记录层：状态、持久化、状态总线
│   ├── types.ts          # 牙位 / 修订 / 受阻 / 看板状态类型
│   ├── seed.ts           # 演示数据
│   ├── repository.ts     # localStorage 读写（不含规则）
│   └── store.ts          # useSyncExternalStore 状态总线
├── domain/               # 判定层：纯函数，不依赖 React/存储
│   ├── rules.ts          # 排程/升级/改约/更正/取出/结案规则
│   └── selectors.ts      # 队列、占用、指标、一致性自检等派生数据
└── ui/                   # 展示层：只读选择器结果并派发动作
    ├── MetricsPanel.tsx
    ├── QueuePanel.tsx
    ├── OccupancyPanel.tsx
    ├── RegisterForm.tsx
    ├── CaseCard.tsx
    ├── BlockPanels.tsx
    └── RevisionsPanel.tsx
```

依赖方向：展示层 → 判定层 → 记录层类型；判定层不导入 React，展示层不直接改状态。

## 技术栈

React 19 + Vite + TypeScript + CSS（无新增第三方依赖）

## 本地运行

```bash
npm install
npm run dev
```

开发端口：5104
