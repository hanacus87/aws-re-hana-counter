import { counterIds, initialState, maxFor, type CounterValues } from "./state";

export const STORAGE_KEY = "hana-counter-values";

export function saveState(state: CounterValues, storage: Storage): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadState(storage: Storage): CounterValues {
  const saved = parseSaved(storage.getItem(STORAGE_KEY));
  if (saved === null) {
    return initialState();
  }
  return Object.fromEntries(counterIds().map((id) => [id, saved[id] ?? 0]));
}

function parseSaved(raw: string | null): CounterValues | null {
  if (raw === null) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }
  const isValid = Object.entries(parsed).every(
    ([id, value]) =>
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 0 &&
      value <= maxFor(id),
  );
  return isValid ? (parsed as CounterValues) : null;
}
