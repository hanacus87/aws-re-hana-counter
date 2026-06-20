/**
 * 収支の集計・整形ロジックの仕様
 *
 * 収支管理画面の純粋関数を UI から分離してテストする。
 * 各日の記録は投資と回収の2項目を持ち、表示する収支は回収から投資を引いた額。
 * 金額は ￥ と3桁区切りで表し、正は先頭に +、負は先頭に -、0 は符号なし。
 * カレンダーの日セル表示用に、符号も ￥ も付けない絶対値の3桁区切りも別途用意する。
 * 色分けの区分（positive / negative / zero）は別途返す。
 */
import { describe, expect, test } from "bun:test";
import {
  formatDigits,
  formatYen,
  monthlyBreakdown,
  net,
  signClass,
  sumMonth,
  sumYear,
  type BalanceMap,
} from "../../frontend/lib/balance";

describe("net（回収から投資を引いた額を返す）", () => {
  test("投資1000・回収3000 のとき 2000 を返す", () => {
    expect(net(1000, 3000)).toBe(2000);
  });

  test("投資5000・回収0 のとき -5000 を返す", () => {
    expect(net(5000, 0)).toBe(-5000);
  });

  test("投資0・回収0 のとき 0 を返す", () => {
    expect(net(0, 0)).toBe(0);
  });
});

describe("formatYen（金額を表示用の文字列に整形する）", () => {
  test('12345 は "+￥12,345" になる', () => {
    expect(formatYen(12345)).toBe("+￥12,345");
  });

  test('-8000 は "-￥8,000" になる', () => {
    expect(formatYen(-8000)).toBe("-￥8,000");
  });

  test('0 は "￥0" になる（符号なし）', () => {
    expect(formatYen(0)).toBe("￥0");
  });

  test('500 は "+￥500" になる（カンマなし）', () => {
    expect(formatYen(500)).toBe("+￥500");
  });

  test('999999 は "+￥999,999" になる', () => {
    expect(formatYen(999999)).toBe("+￥999,999");
  });
});

describe("formatDigits（金額の絶対値を符号・￥なしの3桁区切りで返す）", () => {
  test('2000 は "2,000" になる', () => {
    expect(formatDigits(2000)).toBe("2,000");
  });

  test('-8000 は "8,000" になる（符号を付けない）', () => {
    expect(formatDigits(-8000)).toBe("8,000");
  });

  test('0 は "0" になる', () => {
    expect(formatDigits(0)).toBe("0");
  });

  test('500 は "500" になる（カンマなし）', () => {
    expect(formatDigits(500)).toBe("500");
  });

  test('999999 は "999,999" になる', () => {
    expect(formatDigits(999999)).toBe("999,999");
  });
});

describe("signClass（金額の符号の区分を返す）", () => {
  test("正の値は positive を返す", () => {
    expect(signClass(2000)).toBe("positive");
  });

  test("負の値は negative を返す", () => {
    expect(signClass(-2000)).toBe("negative");
  });

  test("0 は zero を返す", () => {
    expect(signClass(0)).toBe("zero");
  });
});

const monthRecords: BalanceMap = {
  "2026-06-01": { bet: 1000, recovery: 3000 },
  "2026-06-15": { bet: 5000, recovery: 1000 },
  "2026-05-31": { bet: 0, recovery: 9999 },
  "2026-07-01": { bet: 100, recovery: 0 },
};

describe("sumMonth（指定年月の各日の収支を合計する）", () => {
  test("2026年6月の各日の収支を合計して返す", () => {
    expect(sumMonth(monthRecords, 2026, 6)).toBe(-2000);
  });

  test("2026年6月に記録が無いとき 0 を返す", () => {
    expect(sumMonth({}, 2026, 6)).toBe(0);
  });

  test("2026年5月や2026年7月の記録は2026年6月の合計に含めない", () => {
    expect(sumMonth(monthRecords, 2026, 5)).toBe(9999);
    expect(sumMonth(monthRecords, 2026, 7)).toBe(-100);
  });
});

const yearRecords: BalanceMap = {
  "2026-01-10": { bet: 1000, recovery: 2000 },
  "2026-12-31": { bet: 3000, recovery: 1000 },
  "2025-06-01": { bet: 0, recovery: 5000 },
  "2027-01-01": { bet: 500, recovery: 0 },
};

describe("sumYear（指定年の各日の収支を合計する）", () => {
  test("2026年の各日の収支を合計して返す", () => {
    expect(sumYear(yearRecords, 2026)).toBe(-1000);
  });

  test("2025年や2027年の記録は2026年の合計に含めない", () => {
    expect(sumYear(yearRecords, 2025)).toBe(5000);
    expect(sumYear(yearRecords, 2027)).toBe(-500);
  });
});

describe("monthlyBreakdown（指定年の月別合計を12要素で返す）", () => {
  const records: BalanceMap = {
    "2026-01-05": { bet: 0, recovery: 1000 },
    "2026-01-20": { bet: 500, recovery: 0 },
    "2026-03-10": { bet: 2000, recovery: 5000 },
    "2025-01-01": { bet: 0, recovery: 9999 },
  };

  test("2026年1月から12月までの月別合計を12要素で返す", () => {
    const result = monthlyBreakdown(records, 2026);
    expect(result).toHaveLength(12);
    expect(result[0]).toBe(500);
    expect(result[2]).toBe(3000);
  });

  test("記録が無い月の合計は 0 になる", () => {
    const result = monthlyBreakdown(records, 2026);
    expect(result[1]).toBe(0);
    expect(result[11]).toBe(0);
  });
});
