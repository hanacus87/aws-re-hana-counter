import type { BalanceRecord, BalanceRepository } from "./balance";
import type { UserRecord, UserRepository } from "./users";

export function createMemoryUserRepository(): UserRepository {
  const userNames = new Map<string, string>();
  return {
    async upsert(user: UserRecord): Promise<void> {
      userNames.set(user.sub, user.userName);
    },
    async findUserName(sub: string): Promise<string | null> {
      return userNames.get(sub) ?? null;
    },
  };
}

export function createMemoryBalanceRepository(): BalanceRepository {
  const recordsBySub = new Map<string, Map<string, BalanceRecord>>();
  return {
    async list(sub: string): Promise<BalanceRecord[]> {
      const records = recordsBySub.get(sub);
      if (!records) {
        return [];
      }
      return [...records.values()]
        .map((record) => ({ ...record }))
        .sort((a, b) => a.date.localeCompare(b.date));
    },
    async upsert(sub: string, record: BalanceRecord): Promise<void> {
      const records = recordsBySub.get(sub) ?? new Map<string, BalanceRecord>();
      records.set(record.date, { ...record });
      recordsBySub.set(sub, records);
    },
    async remove(sub: string, date: string): Promise<void> {
      recordsBySub.get(sub)?.delete(date);
    },
  };
}
