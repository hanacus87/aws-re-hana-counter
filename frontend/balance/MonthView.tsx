import {
  formatDigits,
  formatYen,
  net,
  signClass,
  sumMonth,
  type BalanceMap,
} from "../lib/balance";
import { dateKey, monthGrid } from "../lib/calendar";
import { PeriodBar } from "./PeriodBar";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

export function MonthView({
  year,
  month,
  records,
  onPrev,
  onNext,
  onSelectDay,
}: {
  year: number;
  month: number;
  records: BalanceMap;
  onPrev: () => void;
  onNext: () => void;
  onSelectDay: (date: string) => void;
}) {
  const total = sumMonth(records, year, month);
  return (
    <div className="month-view">
      <PeriodBar
        label={`${year}-${String(month).padStart(2, "0")}`}
        prevLabel="前の月"
        nextLabel="次の月"
        onPrev={onPrev}
        onNext={onNext}
      />
      <div className={`period-total ${signClass(total)}`}>
        {formatYen(total)}
      </div>
      <div className="weekday-row">
        {WEEKDAYS.map((weekday) => (
          <span key={weekday} className="weekday">
            {weekday}
          </span>
        ))}
      </div>
      <div className="month-grid">
        {monthGrid(year, month)
          .flat()
          .map((day, index) => {
            if (day === null) {
              return <span key={`empty-${index}`} className="day-cell empty" />;
            }
            const date = dateKey(year, month, day);
            const record = records[date];
            const amount = record ? net(record.bet, record.recovery) : null;
            return (
              <button
                type="button"
                key={date}
                className="day-cell"
                aria-label={date}
                onClick={() => onSelectDay(date)}
              >
                <span className="day-number">{day}</span>
                {amount !== null && (
                  <span className={`day-amount ${signClass(amount)}`}>
                    {formatDigits(amount)}
                  </span>
                )}
              </button>
            );
          })}
      </div>
    </div>
  );
}
