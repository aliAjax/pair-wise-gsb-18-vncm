// 展示层工具：仅做展示格式化，不含规则

const pad = (n: number): string => String(n).padStart(2, "0");

export function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function plusDays(base: string, days: number): string {
  const d = new Date(`${base}T00:00:00`);
  d.setDate(d.getDate() + days);
  return formatDate(d.getTime());
}

export function display(value: string | null): string {
  return value === null || value === "" ? "—" : value;
}
