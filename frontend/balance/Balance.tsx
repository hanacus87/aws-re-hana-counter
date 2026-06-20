import { useState } from "react";
import { useAuth } from "../auth/auth-context";
import { LoginButton } from "../auth/LoginButton";
import { nextMonth, nextYear, prevMonth, prevYear } from "../lib/calendar";
import { DayEditor } from "./DayEditor";
import { MonthView } from "./MonthView";
import { useBalanceRecords } from "./useBalanceRecords";
import { YearView } from "./YearView";

export function Balance() {
  const { user } = useAuth();
  const { records, save, remove, loadFailed, unauthorized } =
    useBalanceRecords(user);
  const [view, setView] = useState<"month" | "year">("month");
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth() + 1);
  const [editingDate, setEditingDate] = useState<string | null>(null);

  if (!user || unauthorized) {
    return (
      <main className="centered">
        <LoginButton />
      </main>
    );
  }

  if (loadFailed) {
    throw new Error("failed to load balances");
  }

  const handleSave = async (date: string, bet: number, recovery: number) => {
    await save(date, bet, recovery);
    setEditingDate(null);
  };

  const handleDelete = async (date: string) => {
    await remove(date);
    setEditingDate(null);
  };

  return (
    <main className="balance">
      <div className="balance-toggle">
        <button
          type="button"
          aria-label="月表示"
          className={view === "month" ? "active" : ""}
          onClick={() => setView("month")}
        >
          Month
        </button>
        <button
          type="button"
          aria-label="年表示"
          className={view === "year" ? "active" : ""}
          onClick={() => setView("year")}
        >
          Year
        </button>
      </div>
      {view === "month" ? (
        <MonthView
          year={year}
          month={month}
          records={records}
          onPrev={() => {
            const previous = prevMonth(year, month);
            setYear(previous.year);
            setMonth(previous.month);
          }}
          onNext={() => {
            const following = nextMonth(year, month);
            setYear(following.year);
            setMonth(following.month);
          }}
          onSelectDay={setEditingDate}
        />
      ) : (
        <YearView
          year={year}
          records={records}
          onPrev={() => setYear(prevYear(year))}
          onNext={() => setYear(nextYear(year))}
          onSelectMonth={(selected) => {
            setMonth(selected);
            setView("month");
          }}
        />
      )}
      {editingDate && (
        <DayEditor
          date={editingDate}
          record={records[editingDate] ?? null}
          onSave={handleSave}
          onDelete={handleDelete}
          onCancel={() => setEditingDate(null)}
        />
      )}
    </main>
  );
}
