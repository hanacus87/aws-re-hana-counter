/**
 * 全リセットの仕様
 *
 * リセットアイコン押下で全カウンターを 0 に戻す。
 * 確認ダイアログなしで即時実行する。
 * state は全11カウンターの値マップ（カウンター id から値への対応）を指す。
 */
import { describe, expect, test } from "bun:test";
import { counterIds, initialState, resetAll } from "../../frontend/lib/state";

function sampleState(): Record<string, number> {
  const state: Record<string, number> = {};
  counterIds().forEach((id, i) => {
    state[id] = i;
  });
  return state;
}

describe("resetAll", () => {
  test("全カウンター（11個）の値が 0 になる", () => {
    const result = resetAll(sampleState());
    expect(Object.keys(result)).toHaveLength(11);
    for (const value of Object.values(result)) {
      expect(value).toBe(0);
    }
  });

  test("すでに 0 の値は 0 のまま変わらない", () => {
    expect(resetAll(initialState())).toEqual(initialState());
  });

  test("カウンター id の集合は変わらない（キーの追加・削除をしない）", () => {
    const state = sampleState();
    const result = resetAll(state);
    expect(Object.keys(result).sort()).toEqual(Object.keys(state).sort());
  });

  test("引数の state を変更せず、新しいオブジェクトを返す", () => {
    const state = sampleState();
    const original = { ...state };
    const result = resetAll(state);
    expect(result).not.toBe(state);
    expect(state).toEqual(original);
  });
});
