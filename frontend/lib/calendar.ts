function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function monthGrid(year: number, month: number): (number | null)[][] {
  const leading = new Date(year, month - 1, 1).getDay();
  const total = daysInMonth(year, month);
  const cells: (number | null)[] = [];
  for (let i = 0; i < leading; i++) {
    cells.push(null);
  }
  for (let day = 1; day <= total; day++) {
    cells.push(day);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

export function nextMonth(
  year: number,
  month: number,
): { year: number; month: number } {
  return month === 12
    ? { year: year + 1, month: 1 }
    : { year, month: month + 1 };
}

export function prevMonth(
  year: number,
  month: number,
): { year: number; month: number } {
  return month === 1
    ? { year: year - 1, month: 12 }
    : { year, month: month - 1 };
}

export function nextYear(year: number): number {
  return year + 1;
}

export function prevYear(year: number): number {
  return year - 1;
}

export function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
