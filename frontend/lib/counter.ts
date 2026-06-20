export type Mode = "increment" | "decrement";

export function increment(value: number, max: number): number {
  return Math.min(max, value + 1);
}

export function decrement(value: number): number {
  return Math.max(0, value - 1);
}

export function applyAction(value: number, mode: Mode, max: number): number {
  return mode === "increment" ? increment(value, max) : decrement(value);
}
