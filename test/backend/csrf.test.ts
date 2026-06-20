/**
 * 同一オリジン（CSRF）判定の仕様
 *
 * CloudFront → Lambda Function URL 構成では、Lambda が受け取るリクエスト URL の
 * ホストは Function URL のものに書き換わる。そのため判定にはリクエスト URL の
 * ホストを使わず、設定値 PUBLIC_ORIGIN と Origin を比較する。Sec-Fetch-Site が
 * same-origin の場合も受理する。いずれも肯定的に確認できない変更系（非 GET/HEAD）
 * 要求は 403 で拒否する（フェイルクローズ）。
 */
import { describe, expect, test } from "bun:test";
import app from "../../backend/index";
import { isSameOrigin } from "../../backend/lib/security";
import { signSession } from "../../backend/lib/session";
import { applyNativeRequest } from "../helpers/native-request";
import { createTestEnv, TEST_ORIGIN } from "../helpers/backend-env";

applyNativeRequest();

const SESSION_COOKIE = "__Host-session";
const PUBLIC_ORIGIN = TEST_ORIGIN;
const FUNCTION_URL_ORIGIN = "https://abc123.lambda-url.ap-northeast-1.on.aws";

async function sessionCookie(sub: string) {
  const token = await signSession(
    { sub },
    "session-secret",
    Math.floor(Date.now() / 1000),
  );
  return `${SESSION_COOKIE}=${token}`;
}

describe("isSameOrigin（設定オリジン比較）", () => {
  test("Sec-Fetch-Site が same-origin なら Origin を問わず true", () => {
    expect(isSameOrigin(PUBLIC_ORIGIN, "same-origin", undefined)).toBe(true);
  });

  test("Origin が PUBLIC_ORIGIN と一致すれば true", () => {
    expect(isSameOrigin(PUBLIC_ORIGIN, undefined, PUBLIC_ORIGIN)).toBe(true);
  });

  test("Origin が PUBLIC_ORIGIN と異なれば false", () => {
    expect(
      isSameOrigin(PUBLIC_ORIGIN, undefined, "https://evil.example.com"),
    ).toBe(false);
  });

  test("Origin も Sec-Fetch-Site も無ければ false（フェイルクローズ）", () => {
    expect(isSameOrigin(PUBLIC_ORIGIN, undefined, undefined)).toBe(false);
  });
});

describe("CloudFront 経由の変更系要求（リクエスト URL ホストは Function URL）", () => {
  test("リクエスト URL のホストが Function URL でも Origin が PUBLIC_ORIGIN と一致すれば 204 で受理する", async () => {
    const { balances, env } = createTestEnv();
    const res = await app.request(
      `${FUNCTION_URL_ORIGIN}/api/balance`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Origin: PUBLIC_ORIGIN,
          Cookie: await sessionCookie("sub-1"),
        },
        body: JSON.stringify({ date: "2026-06-03", bet: 1000, recovery: 3000 }),
      },
      env,
    );
    expect(res.status).toBe(204);
    expect(await balances.list("sub-1")).toHaveLength(1);
  });

  test("リクエスト URL のホストが Function URL で Origin が別オリジンなら 403 で拒否する", async () => {
    const { env } = createTestEnv();
    const res = await app.request(
      `${FUNCTION_URL_ORIGIN}/api/balance`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://evil.example.com",
          Cookie: await sessionCookie("sub-1"),
        },
        body: JSON.stringify({ date: "2026-06-03", bet: 0, recovery: 0 }),
      },
      env,
    );
    expect(res.status).toBe(403);
  });
});
