/**
 * UI 振る舞いの仕様
 *
 * ロジックは純粋関数側（counter/sanitize/reset/storage）でテストし、
 * このファイルは「UIがそのロジックをどう見せるか」を検証する。
 * 各カウンターの入力欄は「値 (id)」、ボタンは「カウント (id)」、
 * モード切替トグルは「モード切替」、リセットは「リセット」の
 * aria-label で特定する。ページ再読み込みは、いったんアンマウントしてから
 * 再描画することで再現する。
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import App from "../../frontend/App";
import { counterIds } from "../../frontend/lib/state";
import { STORAGE_KEY } from "../../frontend/lib/storage";

const realFetch = globalThis.fetch;

beforeEach(() => {
  localStorage.clear();
  history.replaceState({}, "", "/");
  globalThis.fetch = (async () =>
    new Response(null, { status: 401 })) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

const input = (id: string) =>
  screen.getByLabelText(`値 (${id})`) as HTMLInputElement;
const countButton = (id: string) => screen.getByLabelText(`カウント (${id})`);
const modeToggle = () => screen.getByLabelText("モード切替");

describe("ヘッダー", () => {
  test("花アイコンは押下でホーム（パス /）へ遷移するリンクになっている", () => {
    render(<App />);
    const home = screen.getByRole("link", { name: "ホームへ" });
    expect(home.getAttribute("href")).toBe("/");
  });

  test("花アイコンのリンクはヘッダー内にある", () => {
    render(<App />);
    const home = screen.getByRole("link", { name: "ホームへ" });
    expect(home.closest("header")).not.toBeNull();
  });
});

describe("404 画面（ルーティング）", () => {
  test("未知のパス（例: /foo）ではカウンターではなく「404」が表示される", () => {
    history.pushState({}, "", "/foo");
    render(<App />);
    expect(screen.getByText("404")).toBeTruthy();
    expect(screen.queryByLabelText("カウント (s1-triangle)")).toBeNull();
  });

  test("404 画面にもヘッダーの花アイコン（ホームへのリンク）が表示される", () => {
    history.pushState({}, "", "/foo");
    render(<App />);
    expect(screen.getByRole("link", { name: "ホームへ" })).toBeTruthy();
  });

  test("ルート（/）ではカウンター画面が表示される（404 は出ない）", () => {
    render(<App />);
    expect(screen.getByLabelText("カウント (s1-triangle)")).toBeTruthy();
    expect(screen.queryByText("404")).toBeNull();
  });
});

describe("モード切替バー", () => {
  test("インクリメントモードのとき、ボタン押下で対応カウンターの値が 1 増える", () => {
    render(<App />);
    fireEvent.click(countButton("s1-triangle"));
    expect(input("s1-triangle").value).toBe("1");
    fireEvent.click(countButton("s1-triangle"));
    expect(input("s1-triangle").value).toBe("2");
  });

  test("デクリメントモードのとき、ボタン押下で対応カウンターの値が 1 減る", () => {
    render(<App />);
    fireEvent.change(input("s2-target"), { target: { value: "5" } });
    fireEvent.click(modeToggle());
    fireEvent.click(countButton("s2-target"));
    expect(input("s2-target").value).toBe("4");
  });

  test("モード切替後は全11ボタンの押下結果が +1 から -1 に変わる", () => {
    render(<App />);
    for (const id of counterIds()) {
      fireEvent.click(countButton(id));
      expect(input(id).value).toBe("1");
    }
    fireEvent.click(modeToggle());
    for (const id of counterIds()) {
      fireEvent.click(countButton(id));
      expect(input(id).value).toBe("0");
    }
  });

  test("デクリメントモードのときのみ、リセットアイコンが表示される", () => {
    render(<App />);
    fireEvent.click(modeToggle());
    expect(screen.getByLabelText("リセット")).toBeTruthy();
  });

  test("インクリメントモードではリセットアイコンが表示されない", () => {
    render(<App />);
    expect(screen.queryByLabelText("リセット")).toBeNull();
  });

  test("リロード後は常にインクリメントモードで開始する（モードは永続化しない）", () => {
    const { unmount } = render(<App />);
    fireEvent.click(modeToggle());
    expect(screen.getByLabelText("リセット")).toBeTruthy();
    unmount();
    render(<App />);
    expect(screen.queryByLabelText("リセット")).toBeNull();
  });

  test("リセットアイコン押下で全カウンターが 0 になる", () => {
    render(<App />);
    for (const id of counterIds()) {
      fireEvent.change(input(id), { target: { value: "3" } });
    }
    fireEvent.click(modeToggle());
    fireEvent.click(screen.getByLabelText("リセット"));
    for (const id of counterIds()) {
      expect(input(id).value).toBe("0");
    }
  });

  test("リセットアイコン押下後はインクリメントモードに戻る（リセットアイコンが消え、ボタン押下で値が 1 増える）", () => {
    render(<App />);
    fireEvent.click(modeToggle());
    fireEvent.click(screen.getByLabelText("リセット"));
    expect(screen.queryByLabelText("リセット")).toBeNull();
    fireEvent.click(countButton("s1-triangle"));
    expect(input("s1-triangle").value).toBe("1");
  });
});

describe("カウンター行", () => {
  test("ボタン押下で対応するカウンターの値だけが増える（他の10個は変わらない）", () => {
    render(<App />);
    fireEvent.click(countButton("s2-red"));
    expect(input("s2-red").value).toBe("1");
    for (const id of counterIds().filter((id) => id !== "s2-red")) {
      expect(input(id).value).toBe("0");
    }
  });

  test("値が 0 のカウンターをデクリメントモードで押しても 0 のまま表示される", () => {
    render(<App />);
    fireEvent.click(modeToggle());
    fireEvent.click(countButton("s3-blue"));
    expect(input("s3-blue").value).toBe("0");
  });

  test('数値入力欄を直接編集すると入力値が表示される（例: "12" と入力すると 12 と表示）', () => {
    render(<App />);
    fireEvent.change(input("s1-triangle"), { target: { value: "12" } });
    expect(input("s1-triangle").value).toBe("12");
  });

  test("上限 99 のカウンターでは 99 を超える入力は 99 に丸めて表示される（例: s2-target に 999）", () => {
    render(<App />);
    fireEvent.change(input("s2-target"), { target: { value: "999" } });
    expect(input("s2-target").value).toBe("99");
  });

  test("s1-triangle は上限と同じ 9999 の入力を丸めず 9999 と表示する", () => {
    render(<App />);
    fireEvent.change(input("s1-triangle"), { target: { value: "9999" } });
    expect(input("s1-triangle").value).toBe("9999");
  });

  test("s1-triangle で 9999 を超える入力は 9999 に丸めて表示される（例: 12345）", () => {
    render(<App />);
    fireEvent.change(input("s1-triangle"), { target: { value: "12345" } });
    expect(input("s1-triangle").value).toBe("9999");
  });

  test("入力のたび（onChange）に違反値（負値・小数・非数・空）は 0 にリセットされて表示される", () => {
    render(<App />);
    for (const invalid of ["-3", "1.5", "abc", ""]) {
      fireEvent.change(input("s1-triangle"), { target: { value: "7" } });
      expect(input("s1-triangle").value).toBe("7");
      fireEvent.change(input("s1-triangle"), { target: { value: invalid } });
      expect(input("s1-triangle").value).toBe("0");
    }
  });

  test("ボタン押下・手動入力による値変更のたびに localStorage へ保存される", () => {
    render(<App />);
    fireEvent.click(countButton("s1-triangle"));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)["s1-triangle"]).toBe(
      1,
    );
    fireEvent.change(input("s2-target"), { target: { value: "9" } });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)["s2-target"]).toBe(9);
  });

  test("ページ再読み込み後も各カウンターの値が復元されている", () => {
    const { unmount } = render(<App />);
    fireEvent.click(countButton("s1-triangle"));
    fireEvent.click(countButton("s1-triangle"));
    fireEvent.change(input("s3-yellow"), { target: { value: "8" } });
    unmount();
    render(<App />);
    expect(input("s1-triangle").value).toBe("2");
    expect(input("s3-yellow").value).toBe("8");
  });
});

describe("アクセシビリティ", () => {
  test("各ボタンに aria-label が付与されている", () => {
    render(<App />);
    for (const button of screen.getAllByRole("button")) {
      expect(button.getAttribute("aria-label")).toBeTruthy();
    }
  });

  test('数値入力欄に inputmode="numeric" が付与されている', () => {
    render(<App />);
    for (const id of counterIds()) {
      expect(input(id).getAttribute("inputmode")).toBe("numeric");
    }
  });
});
