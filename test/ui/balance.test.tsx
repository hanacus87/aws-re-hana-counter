/**
 * 収支管理画面の仕様
 *
 * パスは /balance。アプリ内でログインが必要なのはこの画面のみ。
 * 収支は D1 にユーザー単位で保存する（テストでは fetch をスタブする）。
 * 画面は文字見出しを持たず、月カレンダービューを既定表示とし、
 * Month / Year トグルで年ビュー（サマリ）と切り替える。
 * 曜日（日 月 火 水 木 金 土）以外の表示文字は日本語を使わない。
 * 入力（投資 / 回収）はカウンタと同じ即時補正。
 * 合計サマリ（月・年）と年ビューの月別金額は ￥ と3桁区切りで、
 * 正は先頭に +、負は先頭に - を付けて表示する。
 * 月カレンダーの日セルは符号も ￥ も付けない3桁区切りで表示し、
 * 符号は色（正は positive / 負は negative の区分）で表す。
 */
import { afterEach, describe, expect, test } from "bun:test";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../../frontend/App";

type Records = Record<string, { bet: number; recovery: number }>;

const realFetch = globalThis.fetch;

function stub(options: {
  user?: { userName: string } | null;
  records?: Records;
}) {
  const user = options.user ?? null;
  const records: Records = { ...(options.records ?? {}) };
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = init?.method ?? "GET";
    if (url.endsWith("/api/me")) {
      return user
        ? new Response(JSON.stringify(user), { status: 200 })
        : new Response(null, { status: 401 });
    }
    if (url.includes("/api/balance")) {
      if (method === "GET") {
        const list = Object.entries(records).map(([date, r]) => ({
          date,
          ...r,
        }));
        return new Response(JSON.stringify({ records: list }), { status: 200 });
      }
      if (method === "PUT") {
        const { date, bet, recovery } = JSON.parse(init!.body as string);
        records[date] = { bet, recovery };
        return new Response(null, { status: 204 });
      }
      if (method === "DELETE") {
        const date = new URL(url, "http://localhost").searchParams.get("date")!;
        delete records[date];
        return new Response(null, { status: 204 });
      }
    }
    return new Response(null, { status: 204 });
  }) as unknown as typeof fetch;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function currentYM(): { y: number; m: number } {
  const now = new Date();
  return { y: now.getFullYear(), m: now.getMonth() + 1 };
}

function key(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("収支管理画面（アクセス制御）", () => {
  test("未ログインでアクセスすると「Google でログイン」ボタンが表示される", async () => {
    stub({ user: null });
    history.replaceState({}, "", "/balance");
    render(<App />);
    expect(await screen.findByText("Google でログイン")).toBeTruthy();
  });

  test("カウンタ画面はログインなしで利用できる", async () => {
    stub({ user: null });
    history.replaceState({}, "", "/");
    render(<App />);
    expect(await screen.findByLabelText("カウント (s1-triangle)")).toBeTruthy();
  });

  test("ログイン済みでアクセスすると曜日ヘッダー 日 月 火 水 木 金 土 のカレンダーが表示される", async () => {
    stub({ user: { userName: "花子" } });
    history.replaceState({}, "", "/balance");
    render(<App />);
    const weekdays = await screen.findAllByText(/^[日月火水木金土]$/);
    expect(weekdays.map((w) => w.textContent)).toEqual([
      "日",
      "月",
      "火",
      "水",
      "木",
      "金",
      "土",
    ]);
  });

  test("収支の取得が500で失敗するとエラー画面（500）が表示される", async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/api/me")) {
        return new Response(JSON.stringify({ userName: "花子" }), {
          status: 200,
        });
      }
      return new Response(null, { status: 500 });
    }) as unknown as typeof fetch;
    history.replaceState({}, "", "/balance");
    render(<App />);
    expect(await screen.findByText("500")).toBeTruthy();
  });

  test("収支の取得が401のときログイン画面に遷移する", async () => {
    let balanceFetched = false;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/api/me")) {
        return new Response(JSON.stringify({ userName: "花子" }), {
          status: 200,
        });
      }
      if (url.includes("/api/balance")) {
        balanceFetched = true;
        return new Response(null, { status: 401 });
      }
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;
    history.replaceState({}, "", "/balance");
    render(<App />);
    await waitFor(() => {
      expect(balanceFetched).toBe(true);
      expect(screen.getByText("Google でログイン")).toBeTruthy();
    });
  });
});

describe("カレンダー（月）ビュー", () => {
  test("初期表示で現在の年月が YYYY-MM 形式（例: 2026-06）で表示される", async () => {
    const { y, m } = currentYM();
    stub({ user: { userName: "花子" } });
    history.replaceState({}, "", "/balance");
    render(<App />);
    expect(await screen.findByText(`${y}-${pad(m)}`)).toBeTruthy();
  });

  test("記録のある日のセルに収支が符号・￥なしの3桁区切りで表示され、記録の無い日は金額が表示されない", async () => {
    const { y, m } = currentYM();
    stub({
      user: { userName: "花子" },
      records: { [key(y, m, 10)]: { bet: 1000, recovery: 3000 } },
    });
    history.replaceState({}, "", "/balance");
    render(<App />);
    await waitFor(() => {
      const cell = screen.getByLabelText(key(y, m, 10));
      const amount = cell.querySelector(".day-amount");
      expect(amount?.textContent).toBe("2,000");
    });
    const cell = screen.getByLabelText(key(y, m, 10));
    expect(cell.textContent).not.toContain("￥");
    expect(cell.textContent).not.toContain("+");
    const emptyCell = screen.getByLabelText(key(y, m, 11));
    expect(emptyCell.querySelector(".day-amount")).toBeNull();
    expect(emptyCell.textContent).toBe("11");
  });

  test("当月の月別総収支が各日収支の合計 -￥2,000 として表示される", async () => {
    const { y, m } = currentYM();
    stub({
      user: { userName: "花子" },
      records: {
        [key(y, m, 10)]: { bet: 1000, recovery: 3000 },
        [key(y, m, 20)]: { bet: 5000, recovery: 1000 },
      },
    });
    history.replaceState({}, "", "/balance");
    render(<App />);
    expect(await screen.findByText("-￥2,000")).toBeTruthy();
  });

  test("次の月・前の月でその月へ移動する", async () => {
    const { y, m } = currentYM();
    stub({ user: { userName: "花子" } });
    history.replaceState({}, "", "/balance");
    render(<App />);
    fireEvent.click(await screen.findByLabelText("次の月"));
    const nextM = m === 12 ? 1 : m + 1;
    const nextY = m === 12 ? y + 1 : y;
    expect(screen.getByText(`${nextY}-${pad(nextM)}`)).toBeTruthy();
    fireEvent.click(screen.getByLabelText("前の月"));
    expect(screen.getByText(`${y}-${pad(m)}`)).toBeTruthy();
  });
});

describe("ビュー切替（Month / Year）", () => {
  test("年表示トグルで年ビューに切り替わり、月表示トグルで月ビューに戻る", async () => {
    stub({ user: { userName: "花子" } });
    history.replaceState({}, "", "/balance");
    render(<App />);
    fireEvent.click(await screen.findByLabelText("年表示"));
    expect(screen.getByLabelText("次の年")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("月表示"));
    expect(screen.getByLabelText("次の月")).toBeTruthy();
  });

  test("年ビューで月の行をタップするとその月の月ビューに切り替わる", async () => {
    const { y } = currentYM();
    stub({ user: { userName: "花子" } });
    history.replaceState({}, "", "/balance");
    render(<App />);
    fireEvent.click(await screen.findByLabelText("年表示"));
    fireEvent.click(screen.getByLabelText(`${y}-03`));
    expect(screen.getByText(`${y}-03`)).toBeTruthy();
  });
});

describe("年ビュー", () => {
  test("当年の年別総収支と、1月から12月までの12行の月別合計が表示される", async () => {
    const { y } = currentYM();
    stub({
      user: { userName: "花子" },
      records: {
        [`${y}-01-10`]: { bet: 0, recovery: 1000 },
        [`${y}-03-10`]: { bet: 5000, recovery: 2000 },
      },
    });
    history.replaceState({}, "", "/balance");
    render(<App />);
    fireEvent.click(await screen.findByLabelText("年表示"));
    expect(screen.getByText("-￥2,000")).toBeTruthy();
    const rows = [];
    for (let month = 1; month <= 12; month++) {
      rows.push(screen.getByLabelText(`${y}-${pad(month)}`));
    }
    expect(rows).toHaveLength(12);
  });

  test("次の年・前の年でその年へ移動する", async () => {
    const { y } = currentYM();
    stub({ user: { userName: "花子" } });
    history.replaceState({}, "", "/balance");
    render(<App />);
    fireEvent.click(await screen.findByLabelText("年表示"));
    fireEvent.click(screen.getByLabelText("次の年"));
    expect(screen.getByText(String(y + 1))).toBeTruthy();
    fireEvent.click(screen.getByLabelText("前の年"));
    expect(screen.getByText(String(y))).toBeTruthy();
  });
});

describe("日次入力・編集", () => {
  test("日セルをタップするとその日の投資・回収の入力モーダルが開く", async () => {
    const { y, m } = currentYM();
    stub({ user: { userName: "花子" } });
    history.replaceState({}, "", "/balance");
    render(<App />);
    fireEvent.click(await screen.findByLabelText(key(y, m, 10)));
    expect(screen.getByLabelText("投資")).toBeTruthy();
    expect(screen.getByLabelText("回収")).toBeTruthy();
  });

  test("投資に不正文字を入力すると 0 になる（即時補正）", async () => {
    const { y, m } = currentYM();
    stub({ user: { userName: "花子" } });
    history.replaceState({}, "", "/balance");
    render(<App />);
    fireEvent.click(await screen.findByLabelText(key(y, m, 10)));
    const bet = screen.getByLabelText("投資") as HTMLInputElement;
    fireEvent.change(bet, { target: { value: "abc" } });
    expect(bet.value).toBe("0");
  });

  test("投資に 1000000 を入力すると 999999 になる（上限補正）", async () => {
    const { y, m } = currentYM();
    stub({ user: { userName: "花子" } });
    history.replaceState({}, "", "/balance");
    render(<App />);
    fireEvent.click(await screen.findByLabelText(key(y, m, 10)));
    const bet = screen.getByLabelText("投資") as HTMLInputElement;
    fireEvent.change(bet, { target: { value: "1000000" } });
    expect(bet.value).toBe("999999");
  });

  test("投資3000・回収1000 を保存するとその日のセルに 2,000 が負（negative）の区分で表示される", async () => {
    const { y, m } = currentYM();
    stub({ user: { userName: "花子" } });
    history.replaceState({}, "", "/balance");
    render(<App />);
    fireEvent.click(await screen.findByLabelText(key(y, m, 10)));
    fireEvent.change(screen.getByLabelText("投資"), {
      target: { value: "3000" },
    });
    fireEvent.change(screen.getByLabelText("回収"), {
      target: { value: "1000" },
    });
    fireEvent.click(screen.getByLabelText("保存"));
    await waitFor(() => {
      const amount = screen
        .getByLabelText(key(y, m, 10))
        .querySelector(".day-amount");
      expect(amount?.textContent).toBe("2,000");
      expect(amount?.className).toContain("negative");
    });
  });

  test("投資1000・回収3000 を保存するとその日のセルに 2,000 が正（positive）の区分で表示される", async () => {
    const { y, m } = currentYM();
    stub({ user: { userName: "花子" } });
    history.replaceState({}, "", "/balance");
    render(<App />);
    fireEvent.click(await screen.findByLabelText(key(y, m, 10)));
    fireEvent.change(screen.getByLabelText("投資"), {
      target: { value: "1000" },
    });
    fireEvent.change(screen.getByLabelText("回収"), {
      target: { value: "3000" },
    });
    fireEvent.click(screen.getByLabelText("保存"));
    await waitFor(() => {
      const amount = screen
        .getByLabelText(key(y, m, 10))
        .querySelector(".day-amount");
      expect(amount?.textContent).toBe("2,000");
      expect(amount?.className).toContain("positive");
    });
  });

  test("削除を押すとその日の記録が削除されセルから金額が消える", async () => {
    const { y, m } = currentYM();
    stub({
      user: { userName: "花子" },
      records: { [key(y, m, 10)]: { bet: 1000, recovery: 3000 } },
    });
    history.replaceState({}, "", "/balance");
    render(<App />);
    await waitFor(() =>
      expect(
        screen.getByLabelText(key(y, m, 10)).querySelector(".day-amount")
          ?.textContent,
      ).toBe("2,000"),
    );
    fireEvent.click(screen.getByLabelText(key(y, m, 10)));
    fireEvent.click(screen.getByLabelText("削除"));
    await waitFor(() =>
      expect(
        screen.getByLabelText(key(y, m, 10)).querySelector(".day-amount"),
      ).toBeNull(),
    );
    // App 全体をマウントする重い統合テストで、happy-dom 上では既定 5s を
    // 超えることがあるため余裕を持たせる（本体・アサーションは常に成立）。
  }, 20000);

  test("キャンセルを押すとモーダルが閉じる", async () => {
    const { y, m } = currentYM();
    stub({ user: { userName: "花子" } });
    history.replaceState({}, "", "/balance");
    render(<App />);
    fireEvent.click(await screen.findByLabelText(key(y, m, 10)));
    expect(screen.getByLabelText("投資")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("キャンセル"));
    expect(screen.queryByLabelText("投資")).toBeNull();
  });
});
