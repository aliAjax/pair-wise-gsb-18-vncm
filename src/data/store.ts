import { useSyncExternalStore } from "react";
import type { BoardState } from "./types";
import { loadState, resetState, saveState } from "./repository";
import { decide, type BoardAction, type DecisionResult } from "../domain/rules";

// 记录层状态总线：牙位、排队、占用、修订记录、受阻记录在同一快照内提交，
// 保证刷新后各视图一致。
let currentState: BoardState = loadState();
const listeners = new Set<() => void>();

function emit(): void {
  saveState(currentState);
  listeners.forEach((listener) => listener());
}

export function dispatch(action: BoardAction): DecisionResult {
  const result = decide(currentState, action);
  currentState = result.state;
  emit();
  return result;
}

export function resetBoard(): void {
  currentState = resetState();
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): BoardState {
  return currentState;
}

export function useBoardState(): BoardState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
