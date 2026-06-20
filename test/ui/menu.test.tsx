/**
 * サイドメニューの仕様
 *
 * ヘッダーのメニューボタン（aria-label「メニュー」）でサイドメニューを開閉する。
 * メニューには画面ナビゲーション（カウンタ・収支管理）と、
 * ログイン状態に応じた内容（未ログイン: ログインボタン /
 * ログイン済み: userName とログアウトボタン）を表示する。
 * 展開方向・配置は CSS で実現し、テストでは検証しない。
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "../../frontend/App";

const realFetch = globalThis.fetch;

function stubAuth(user: { userName: string } | null) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.endsWith("/api/me")) {
      return user
        ? new Response(JSON.stringify(user), { status: 200 })
        : new Response(null, { status: 401 });
    }
    return new Response(null, { status: 204 });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  history.replaceState({}, "", "/");
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

async function openMenu() {
  render(<App />);
  await waitFor(() => screen.getByLabelText("メニュー"));
  fireEvent.click(screen.getByLabelText("メニュー"));
}

describe("サイドメニュー", () => {
  test("メニューボタン押下でサイドメニューが開く", async () => {
    stubAuth(null);
    await openMenu();
    expect(screen.getByRole("link", { name: "カウンタ" })).toBeTruthy();
  });

  test("メニューに「カウンタ」と「収支管理」へのリンクが表示される", async () => {
    stubAuth(null);
    await openMenu();
    expect(
      screen.getByRole("link", { name: "カウンタ" }).getAttribute("href"),
    ).toBe("/");
    expect(
      screen.getByRole("link", { name: "収支管理" }).getAttribute("href"),
    ).toBe("/balance");
  });

  test("メニューボタン再押下で閉じる", async () => {
    stubAuth(null);
    await openMenu();
    fireEvent.click(screen.getByLabelText("メニュー"));
    expect(screen.queryByRole("link", { name: "カウンタ" })).toBeNull();
  });

  test("メニュー外（オーバーレイ）押下で閉じる", async () => {
    stubAuth(null);
    await openMenu();
    fireEvent.click(screen.getByLabelText("メニューを閉じる"));
    expect(screen.queryByRole("link", { name: "カウンタ" })).toBeNull();
  });

  test("未ログイン時は「Google でログイン」ボタンが表示される", async () => {
    stubAuth(null);
    await openMenu();
    expect(screen.getByText("Google でログイン")).toBeTruthy();
  });

  test("ログイン済み時は userName とログアウトボタンが表示される", async () => {
    stubAuth({ userName: "花子" });
    render(<App />);
    fireEvent.click(await screen.findByLabelText("メニュー"));
    expect(await screen.findByText("花子")).toBeTruthy();
    expect(screen.getByRole("button", { name: "ログアウト" })).toBeTruthy();
  });

  test("HTML 特殊文字を含む userName がエスケープされ文字列として表示される", async () => {
    const tricky = "<img src=x onerror=alert(1)>";
    stubAuth({ userName: tricky });
    render(<App />);
    fireEvent.click(await screen.findByLabelText("メニュー"));
    expect(await screen.findByText(tricky)).toBeTruthy();
  });

  test("ログアウトボタン押下でドロワーが閉じ、再度開くとログイン表示に戻る", async () => {
    let loggedIn = true;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url.endsWith("/auth/logout")) {
        loggedIn = false;
        return new Response(null, { status: 204 });
      }
      if (url.endsWith("/api/me")) {
        return loggedIn
          ? new Response(JSON.stringify({ userName: "花子" }), { status: 200 })
          : new Response(null, { status: 401 });
      }
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;

    render(<App />);
    fireEvent.click(await screen.findByLabelText("メニュー"));
    fireEvent.click(await screen.findByRole("button", { name: "ログアウト" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "ログアウト" })).toBeNull(),
    );
    fireEvent.click(screen.getByLabelText("メニュー"));
    expect(await screen.findByText("Google でログイン")).toBeTruthy();
  });
});
