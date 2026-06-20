/**
 * 認証状態プロバイダの仕様
 *
 * AuthProvider は起動時に /api/me を取得し、ログインユーザー情報を供給する。
 * /api/me がネットワーク例外を投げた場合は未ログイン扱いとする。
 * useAuth は AuthProvider の外で使うと例外を投げる（誤用検知）。
 */
import { afterEach, describe, expect, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import App from "../../frontend/App";
import { useAuth } from "../../frontend/auth/auth-context";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("AuthProvider", () => {
  test("/api/me が例外を投げると「Google でログイン」が表示される", async () => {
    globalThis.fetch = (async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;
    history.replaceState({}, "", "/balance");
    render(<App />);
    expect(await screen.findByText("Google でログイン")).toBeTruthy();
  });
});

describe("useAuth", () => {
  test("AuthProvider の外で使うと例外を投げる", () => {
    function Probe() {
      useAuth();
      return null;
    }
    expect(() => render(<Probe />)).toThrow();
  });
});
