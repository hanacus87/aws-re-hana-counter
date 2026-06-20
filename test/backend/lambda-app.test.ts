/**
 * ランタイムのルート app（container 注入と障害時の挙動）の仕様
 *
 * Lambda では container（DynamoDB repo・設定・SSM シークレット）をルートの
 * ミドルウェアで構築して c.env に注入し、testable な app へ委譲する。
 * container 構築（SSM 取得・index.html 読込）が失敗した場合は、mount 先 app の
 * onError ではなくルートで捕捉して 500 を返す。内部情報（例外メッセージ・
 * スタック・シークレット値）を漏らさず、CloudFront が一時的な 5xx を
 * キャッシュしないよう Cache-Control: no-store を付ける。
 */
import { describe, expect, test } from "bun:test";
import { createLambdaApp } from "../../backend/lambda-app";
import { applyNativeRequest } from "../helpers/native-request";
import { createTestEnv } from "../helpers/backend-env";

applyNativeRequest();

describe("createLambdaApp", () => {
  test("container 構築が失敗しても 500・no-store で内部情報を漏らさない", async () => {
    const root = createLambdaApp({
      loadContainer: () =>
        Promise.reject(new Error("ssm failure: super-secret-value")),
    });
    const res = await root.request("/api/me", {}, {});
    expect(res.status).toBe(500);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = await res.text();
    expect(body).not.toContain("super-secret-value");
    expect(body.toLowerCase()).not.toContain("ssm");
    expect(body.toLowerCase()).not.toContain("stack");
  });

  test("container 注入が成功すれば mount 先 app に委譲する（未認証の /api/me は 401）", async () => {
    const { env } = createTestEnv();
    const root = createLambdaApp({
      loadContainer: () => Promise.resolve(env as Env),
    });
    const res = await root.request("/api/me", {}, {});
    expect(res.status).toBe(401);
  });
});
