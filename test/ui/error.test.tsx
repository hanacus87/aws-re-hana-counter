/**
 * 500 画面の仕様
 *
 * フロントエンドで予期せぬ描画エラーが発生した場合、
 * ErrorBoundary が 404 画面と同形の 500 画面（ヘッダー + 500 表示）を出す。
 * Worker 側の 500 応答は test/worker/routing.test.ts で扱う。
 */
import { describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "../../frontend/App";

function Boom(): never {
  throw new Error("render failure");
}

describe("500 画面", () => {
  test("画面の描画中に予期せぬエラーが発生した場合、「500」が表示される", () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(screen.getByText("500")).toBeTruthy();
  });

  test("500 画面にもヘッダー（ホームへのリンク）が表示される", () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(
      screen.getByRole("link", { name: "ホームへ" }).getAttribute("href"),
    ).toBe("/");
  });
});
