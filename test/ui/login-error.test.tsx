/**
 * ログインエラー画面の仕様
 *
 * 認証コールバックが失敗すると /login-error へ誘導される。
 * この画面は 404 / 500 画面と同じ形（ヘッダー + 中央に大きな番号）で「403」を表示する。
 * 失敗理由は画面に出さず一律で扱う。
 */
import { afterEach, describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import App from "../../frontend/App";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("ログインエラー画面", () => {
  test("/login-error では「403」が表示される", async () => {
    globalThis.fetch = (async () =>
      new Response(null, { status: 401 })) as unknown as typeof fetch;
    history.replaceState({}, "", "/login-error");
    render(<App />);
    expect(await screen.findByText("403")).toBeTruthy();
  });

  test("ログインエラー画面にもヘッダー（ホームへのリンク）が表示される", async () => {
    globalThis.fetch = (async () =>
      new Response(null, { status: 401 })) as unknown as typeof fetch;
    history.replaceState({}, "", "/login-error");
    render(<App />);
    expect(
      (await screen.findByRole("link", { name: "ホームへ" })).getAttribute(
        "href",
      ),
    ).toBe("/");
  });
});
