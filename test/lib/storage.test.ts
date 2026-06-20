/**
 * 永続化の仕様
 *
 * 値変更のたびに localStorage へ保存し、再読み込み・タブ再オープン時に復元する。
 * 保存するのは全カウンターの値マップ（カウンター id から値への対応）のみ。
 * セクション構成・アイコンはコード定義（データ駆動の配列）であり保存しない。
 * 保存先は単一の固定キーで、JSON でシリアライズする。
 *
 * テスト容易性のため、saveState / loadState は保存先の Storage を引数で受け取る。
 * テストではインメモリの Storage 実装（モック）を注入し、
 * グローバルの localStorage には依存しない。
 */
import { describe, expect, test } from "bun:test";
import { counterIds, initialState } from "../../frontend/lib/state";
import { loadState, saveState, STORAGE_KEY } from "../../frontend/lib/storage";

function memoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => [...store.keys()][index] ?? null,
    removeItem: (key) => void store.delete(key),
    setItem: (key, value) => void store.set(key, value),
  };
}

function sampleState(): Record<string, number> {
  const state: Record<string, number> = {};
  counterIds().forEach((id, i) => {
    state[id] = i * 2;
  });
  return state;
}

describe("saveState", () => {
  test("カウンター値のマップ（カウンター id と値の組）が JSON で保存される（構成・アイコンは含めない）", () => {
    const storage = memoryStorage();
    const state = sampleState();
    saveState(state, storage);
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!)).toEqual(state);
  });

  test("単一の固定キーへ上書き保存される（保存のたびにキーが増えない）", () => {
    const storage = memoryStorage();
    saveState(sampleState(), storage);
    saveState(initialState(), storage);
    saveState(sampleState(), storage);
    expect(storage.length).toBe(1);
  });

  test("保存した内容は loadState で同じ値マップに復元できる（ラウンドトリップ）", () => {
    const storage = memoryStorage();
    const state = sampleState();
    saveState(state, storage);
    expect(loadState(storage)).toEqual(state);
  });
});

describe("loadState", () => {
  test("保存済みの値マップがあれば、それを復元して返す", () => {
    const storage = memoryStorage();
    const state = { ...initialState(), "s1-triangle": 7 };
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    expect(loadState(storage)).toEqual(state);
  });

  test("s1-triangle は上限9999以内の値（例: 5000）を復元する", () => {
    const storage = memoryStorage();
    const state = { ...initialState(), "s1-triangle": 5000 };
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    expect(loadState(storage)).toEqual(state);
  });

  test("storage が空（初回起動）のときは初期状態を返す（全11カウンターすべて 0）", () => {
    const state = loadState(memoryStorage());
    expect(Object.keys(state)).toHaveLength(11);
    for (const value of Object.values(state)) {
      expect(value).toBe(0);
    }
  });

  test("値マップに無いカウンター id は 0 で補完する（構成にカウンターを追加した場合）", () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, JSON.stringify({ "s1-triangle": 5 }));
    const state = loadState(storage);
    expect(state["s1-triangle"]).toBe(5);
    expect(Object.keys(state).sort()).toEqual(counterIds().sort());
    expect(state["s2-target"]).toBe(0);
  });

  test("構成に存在しない id が値マップにあっても無視する（構成からカウンターを削除した場合）", () => {
    const storage = memoryStorage();
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...initialState(), "removed-counter": 9 }),
    );
    const state = loadState(storage);
    expect(state).not.toContainKey("removed-counter");
    expect(Object.keys(state).sort()).toEqual(counterIds().sort());
  });
});

describe("loadState — 壊れたデータのフォールバック", () => {
  test("不正な JSON 文字列が保存されていた場合、初期状態にフォールバックする", () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, "{broken json!");
    expect(loadState(storage)).toEqual(initialState());
  });

  test("JSON としては正しいが値マップでない場合（配列・文字列など）、初期状態にフォールバックする", () => {
    for (const corrupted of ["[1,2,3]", '"text"', "42", "null"]) {
      const storage = memoryStorage();
      storage.setItem(STORAGE_KEY, corrupted);
      expect(loadState(storage)).toEqual(initialState());
    }
  });

  test("カウンターごとの上限を超える値を含む場合、初期状態にフォールバックする（s2-target に 100、s1-triangle に 10000）", () => {
    for (const invalid of [
      { id: "s2-target", value: 100 },
      { id: "s1-triangle", value: 10000 },
    ]) {
      const storage = memoryStorage();
      storage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...initialState(), [invalid.id]: invalid.value }),
      );
      expect(loadState(storage)).toEqual(initialState());
    }
  });

  test("負値を含む場合、初期状態にフォールバックする（0 未満の整数は無効）", () => {
    const storage = memoryStorage();
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...initialState(), "s1-triangle": -1 }),
    );
    expect(loadState(storage)).toEqual(initialState());
  });

  test("小数・非数（文字列など）の値を含む場合、初期状態にフォールバックする", () => {
    for (const invalid of [1.5, "3", NaN, true]) {
      const storage = memoryStorage();
      storage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...initialState(), "s1-triangle": invalid }),
      );
      expect(loadState(storage)).toEqual(initialState());
    }
  });

  test("壊れたデータを読み込んでも例外を投げない", () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, "{broken json!");
    expect(() => loadState(storage)).not.toThrow();
  });
});
