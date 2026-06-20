export type BalanceRecord = {
  date: string;
  bet: number;
  recovery: number;
};

export interface BalanceRepository {
  list(sub: string): Promise<BalanceRecord[]>;
  upsert(sub: string, record: BalanceRecord): Promise<void>;
  remove(sub: string, date: string): Promise<void>;
}
