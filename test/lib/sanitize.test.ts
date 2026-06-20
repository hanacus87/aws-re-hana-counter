/**
 * 数値入力欄のバリデーション仕様
 *
 * 数値入力欄はキーボードで直接編集できる。
 * 入力値は 0 以上の整数のみ許可し、違反（負値・小数・非数・空など）は
 * 0 に強制リセット、上限（引数で渡す最大値）を超える値は上限に丸める。
 * sanitizeInput は入力欄の生文字列と最大値を受け取り、表示・保存すべきカウンター値を返す。
 * 入力の都度（onChange）適用する。
 */
import { describe, expect, test } from "bun:test";
import { sanitizeInput } from "../../frontend/lib/sanitize";

describe("sanitizeInput", () => {
  describe("0 以上で上限以内の整数文字列はその数値を返す", () => {
    test('上限99で "5" は 5、"42" は 42 を返す', () => {
      expect(sanitizeInput("5", 99)).toBe(5);
      expect(sanitizeInput("42", 99)).toBe(42);
    });

    test('"0" は 0 を返す（下限値）', () => {
      expect(sanitizeInput("0", 99)).toBe(0);
    });

    test('上限99で "99" は 99 を返す（上限値）', () => {
      expect(sanitizeInput("99", 99)).toBe(99);
    });

    test('先頭ゼロは10進数として解釈する（"007" は 7、"010" は 10）', () => {
      expect(sanitizeInput("007", 99)).toBe(7);
      expect(sanitizeInput("010", 99)).toBe(10);
    });

    test('上限9999で "9999" は 9999、"5000" は 5000 を返す', () => {
      expect(sanitizeInput("9999", 9999)).toBe(9999);
      expect(sanitizeInput("5000", 9999)).toBe(5000);
    });
  });

  describe("上限を超える整数文字列は上限に丸める", () => {
    test('上限99で "100" は 99 を返す', () => {
      expect(sanitizeInput("100", 99)).toBe(99);
    });

    test('上限99で "99999" は 99 を返す', () => {
      expect(sanitizeInput("99999", 99)).toBe(99);
    });

    test('上限9999で "12345" は 9999 を返す', () => {
      expect(sanitizeInput("12345", 9999)).toBe(9999);
    });
  });

  describe("違反入力は 0 を返す（強制リセット）", () => {
    test('負値は 0 を返す（例: "-3", "-1"）', () => {
      expect(sanitizeInput("-3", 99)).toBe(0);
      expect(sanitizeInput("-1", 99)).toBe(0);
    });

    test('小数は 0 を返す（例: "1.5", "0.1"）', () => {
      expect(sanitizeInput("1.5", 99)).toBe(0);
      expect(sanitizeInput("0.1", 99)).toBe(0);
    });

    test('非数は 0 を返す（例: "abc"）', () => {
      expect(sanitizeInput("abc", 99)).toBe(0);
    });

    test("空文字は 0 を返す", () => {
      expect(sanitizeInput("", 99)).toBe(0);
    });

    test('空白のみの文字列は 0 を返す（例: "  "）', () => {
      expect(sanitizeInput("  ", 99)).toBe(0);
    });

    test('数字と文字の混在は 0 を返す（例: "12a", "a12"）', () => {
      expect(sanitizeInput("12a", 99)).toBe(0);
      expect(sanitizeInput("a12", 99)).toBe(0);
    });

    test('指数表記・特殊数値は 0 を返す（例: "1e3", "Infinity", "NaN"）', () => {
      expect(sanitizeInput("1e3", 99)).toBe(0);
      expect(sanitizeInput("Infinity", 99)).toBe(0);
      expect(sanitizeInput("NaN", 99)).toBe(0);
    });
  });
});

describe("sanitizeInput（収支管理の上限 999999 で再利用）", () => {
  test('"999999" は 999999 を返す', () => {
    expect(sanitizeInput("999999", 999999)).toBe(999999);
  });

  test('"1000000" は 999999 に丸める', () => {
    expect(sanitizeInput("1000000", 999999)).toBe(999999);
  });

  test("不正文字を含む入力は 0 を返す", () => {
    expect(sanitizeInput("12a", 999999)).toBe(0);
  });
});
