import type { BoardState } from "./types";
import { seedState } from "./seed";

// 记录层仓库：仅负责持久化读写，不含任何排程判定逻辑
const STORAGE_KEY = "hxwl-04.retreatment-board.v1";

function looksLikeState(value: unknown): value is BoardState {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as BoardState;
  return (
    candidate.version === 1 &&
    Array.isArray(candidate.cases) &&
    Array.isArray(candidate.revisions) &&
    Array.isArray(candidate.blocked)
  );
}

export function loadState(): BoardState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedState;
    const parsed: unknown = JSON.parse(raw);
    if (looksLikeState(parsed)) return parsed;
    return seedState;
  } catch {
    return seedState;
  }
}

export function saveState(state: BoardState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 存储不可用时退化为内存态，判定层与展示层仍可工作
  }
}

export function resetState(): BoardState {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  return seedState;
}
