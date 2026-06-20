/**
 * カウンター構成の仕様
 *
 * 構成はデータ駆動（sections 配列）で定義し、UI はこれを描画するだけ。
 * 増減・下限の動作は全カウンターで共通。値の上限のみカウンターごとに設定でき、
 * 未設定なら既定上限 DEFAULT_MAX を用いる。
 * s1-triangle の上限は 9999、それ以外は既定の 99。
 */
import { describe, expect, test } from "bun:test";
import {
  counterIds,
  DEFAULT_MAX,
  maxFor,
  sections,
  type CounterIcon,
} from "../../frontend/lib/state";

describe("カウンター構成", () => {
  test("セクションは plain・grouped・grouped の順に3つ並ぶ", () => {
    expect(sections.map((s) => s.variant)).toEqual([
      "plain",
      "grouped",
      "grouped",
    ]);
  });

  test("セクション1は ▲（triangle）1個のみ", () => {
    expect(sections[0].counters.map((c) => c.icon)).toEqual(["triangle"]);
  });

  test("セクション2とセクション3は同じアイコン構成（◎ target が先頭、続いて 赤・緑・黄・青）", () => {
    const expected: CounterIcon[] = [
      "target",
      "red",
      "green",
      "yellow",
      "blue",
    ];
    expect(sections[1].counters.map((c) => c.icon)).toEqual(expected);
    expect(sections[2].counters.map((c) => c.icon)).toEqual(expected);
  });

  test("カウンターは合計11個で、id はすべて一意", () => {
    const ids = counterIds();
    expect(ids).toHaveLength(11);
    expect(new Set(ids).size).toBe(11);
  });
});

describe("カウンター値の上限（maxFor）", () => {
  test("既定上限 DEFAULT_MAX は 99", () => {
    expect(DEFAULT_MAX).toBe(99);
  });

  test("s1-triangle の上限は 9999", () => {
    expect(maxFor("s1-triangle")).toBe(9999);
  });

  test("s1-triangle 以外の上限は 99（例: s2-target, s2-red, s3-blue）", () => {
    expect(maxFor("s2-target")).toBe(99);
    expect(maxFor("s2-red")).toBe(99);
    expect(maxFor("s3-blue")).toBe(99);
  });

  test("構成に無い id の上限は既定の 99", () => {
    expect(maxFor("unknown-id")).toBe(99);
  });
});
