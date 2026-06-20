/**
 * カウンター増減ロジックの仕様
 *
 * UIから分離した純粋関数としてテストする。
 * 増減幅は常に 1 で固定。
 * 下限は 0 で固定。上限は呼び出し側が引数で渡す（カウンターごとに異なりうる）。
 */
import { describe, expect, test } from "bun:test";
import { applyAction, decrement, increment } from "../../frontend/lib/counter";

describe("increment", () => {
  test("値に 1 を加えた値を返す（例: 上限99で 0 は 1 になる）", () => {
    expect(increment(0, 99)).toBe(1);
  });

  test("増減幅は常に 1（例: 上限99で 5 は 6 に、98 は 99 になる）", () => {
    expect(increment(5, 99)).toBe(6);
    expect(increment(98, 99)).toBe(99);
  });

  test("上限99で値が 99 のときは 99 のまま（上限で頭打ち）", () => {
    expect(increment(99, 99)).toBe(99);
  });

  test("上限9999では 9998 は 9999 になり、9999 は 9999 のまま", () => {
    expect(increment(9998, 9999)).toBe(9999);
    expect(increment(9999, 9999)).toBe(9999);
  });

  test("同じ入力（値と上限）に対して常に同じ値を返す", () => {
    expect(increment(3, 99)).toBe(increment(3, 99));
  });
});

describe("decrement", () => {
  test("値から 1 を引いた値を返す（例: 5 は 4 になる）", () => {
    expect(decrement(5)).toBe(4);
  });

  test("増減幅は常に 1（例: 1 は 0 に、99 は 98 になる）", () => {
    expect(decrement(1)).toBe(0);
    expect(decrement(99)).toBe(98);
  });

  test("値が 0 のときは 0 のまま（負値にしない）", () => {
    expect(decrement(0)).toBe(0);
  });
});

describe("applyAction", () => {
  test("インクリメントモードのとき 1 増える（上限99で 0 は 1、5 は 6）", () => {
    expect(applyAction(0, "increment", 99)).toBe(1);
    expect(applyAction(5, "increment", 99)).toBe(6);
  });

  test("デクリメントモードのとき 1 減る（5 は 4、1 は 0）", () => {
    expect(applyAction(5, "decrement", 99)).toBe(4);
    expect(applyAction(1, "decrement", 99)).toBe(0);
  });

  test("デクリメントモードかつ値が 0 のとき 0 のまま（下限が適用される）", () => {
    expect(applyAction(0, "decrement", 99)).toBe(0);
  });

  test("インクリメントモードかつ値が上限99のとき 99 のまま（上限が適用される）", () => {
    expect(applyAction(99, "increment", 99)).toBe(99);
  });

  test("インクリメントモードかつ上限9999では 9999 で頭打ち", () => {
    expect(applyAction(9999, "increment", 9999)).toBe(9999);
  });

  test("同じ値でもモードによって 1 増えるか 1 減るかが分かれる（上限99）", () => {
    expect(applyAction(5, "increment", 99)).toBe(6);
    expect(applyAction(5, "decrement", 99)).toBe(4);
  });
});
