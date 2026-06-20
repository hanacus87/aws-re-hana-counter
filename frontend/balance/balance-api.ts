import { mutate } from "../lib/api";
import { type BalanceMap } from "../lib/balance";

export const UNAUTHORIZED = "unauthorized";

export async function fetchBalances(): Promise<BalanceMap> {
  const res = await fetch("/api/balance");
  if (res.status === 401) {
    throw new Error(UNAUTHORIZED);
  }
  if (!res.ok) {
    throw new Error("failed to load balances");
  }
  const data = (await res.json()) as {
    records: { date: string; bet: number; recovery: number }[];
  };
  const map: BalanceMap = {};
  for (const { date, bet, recovery } of data.records) {
    map[date] = { bet, recovery };
  }
  return map;
}

export async function saveBalance(
  date: string,
  bet: number,
  recovery: number,
): Promise<void> {
  await mutate("/api/balance", "PUT", JSON.stringify({ date, bet, recovery }));
}

export async function removeBalance(date: string): Promise<void> {
  await mutate(`/api/balance?date=${encodeURIComponent(date)}`, "DELETE");
}
