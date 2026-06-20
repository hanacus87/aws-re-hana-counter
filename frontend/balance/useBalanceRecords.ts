import { useEffect, useState } from "react";
import { type User } from "../auth/auth-context";
import { type BalanceMap } from "../lib/balance";
import {
  fetchBalances,
  removeBalance,
  saveBalance,
  UNAUTHORIZED,
} from "./balance-api";

export function useBalanceRecords(user: User | null) {
  const [records, setRecords] = useState<BalanceMap>({});
  const [loadFailed, setLoadFailed] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    if (user) {
      void fetchBalances()
        .then(setRecords)
        .catch((error) => {
          if (error instanceof Error && error.message === UNAUTHORIZED) {
            setUnauthorized(true);
          } else {
            setLoadFailed(true);
          }
        });
    }
  }, [user]);

  const save = async (date: string, bet: number, recovery: number) => {
    await saveBalance(date, bet, recovery);
    setRecords((prev) => ({ ...prev, [date]: { bet, recovery } }));
  };

  const remove = async (date: string) => {
    await removeBalance(date);
    setRecords((prev) => {
      const next = { ...prev };
      delete next[date];
      return next;
    });
  };

  return { records, save, remove, loadFailed, unauthorized };
}
