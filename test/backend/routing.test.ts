/**
 * バックエンド (Hono) のルーティングと 404 / 500 の仕様
 *
 * Lambda(Hono) が静的アセットも SPA フォールバックも握る。SPA の既知ルート
 * （収支管理）にはアプリ本体を 200 で返し、未知のパスにはステータスを 404 に
 * 差し替えて返す。未処理例外には 500 を返す（API パスには内部情報を含まない
 * 最小 JSON）。404 / 500 画面の描画はフロントエンド（React）が担う。
 * セキュリティヘッダーは CloudFront Response Headers Policy が付与するため、
 * バックエンドでは付与しない。テストではアプリ本体（index.html）を返す
 * モックのアセット取得を注入して呼び出す。
 */
import { describe, expect, test } from "bun:test";
import app from "../../backend/index";

function mockEnv(response: Response) {
  const calls: Request[] = [];
  return {
    calls,
    env: {
      assets: {
        fetch: (req: Request) => {
          calls.push(req);
          return Promise.resolve(response);
        },
      },
    },
  };
}

function indexHtmlResponse() {
  return new Response("<html>app</html>", {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function cacheableIndexResponse() {
  return new Response("<html>app</html>", {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      ETag: '"abc123"',
      "Last-Modified": "Mon, 01 Jan 2026 00:00:00 GMT",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

function throwingEnv() {
  return {
    assets: {
      fetch: () => Promise.reject(new Error("secret internal stack trace")),
    },
  };
}

describe("404 応答", () => {
  test("未知のパスでは assets へアプリ本体（/）を要求する", async () => {
    const { calls, env } = mockEnv(indexHtmlResponse());
    await app.request("/foo", {}, env);
    expect(calls).toHaveLength(1);
    expect(new URL(calls[0].url).pathname).toBe("/");
  });

  test("アプリ本体の HTML を 404 ステータスで返す（本文・Content-Type は維持）", async () => {
    const { env } = mockEnv(indexHtmlResponse());
    const res = await app.request("/foo/bar?x=1", {}, env);
    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(await res.text()).toBe("<html>app</html>");
  });
});

describe("SPA ルートの配信", () => {
  test("ルート（/）にはアプリ本体を 200 で返す", async () => {
    const { env } = mockEnv(indexHtmlResponse());
    const res = await app.request("/", {}, env);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("<html>app</html>");
  });

  test("収支管理のパスにはアプリ本体を 200 で返す", async () => {
    const { calls, env } = mockEnv(indexHtmlResponse());
    const res = await app.request("/balance", {}, env);
    expect(res.status).toBe(200);
    expect(new URL(calls[0].url).pathname).toBe("/");
    expect(await res.text()).toBe("<html>app</html>");
  });

  test("未知のパスは引き続き 404 を返す（既存仕様の維持）", async () => {
    const { env } = mockEnv(indexHtmlResponse());
    const res = await app.request("/unknown-path", {}, env);
    expect(res.status).toBe(404);
  });

  test("ログインエラーのパスにはアプリ本体を 403 で返す", async () => {
    const { calls, env } = mockEnv(indexHtmlResponse());
    const res = await app.request("/login-error", {}, env);
    expect(res.status).toBe(403);
    expect(new URL(calls[0].url).pathname).toBe("/");
    expect(await res.text()).toBe("<html>app</html>");
  });
});

describe("サーバーエラー応答", () => {
  test("ハンドラで未処理例外が発生した場合は 500 を返す", async () => {
    const res = await app.request("/boom", {}, throwingEnv());
    expect(res.status).toBe(500);
  });

  test("API パスへの 500 応答に内部情報（例外メッセージ・スタックトレース）を含めない", async () => {
    const res = await app.request("/api/boom", {}, throwingEnv());
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(body).not.toContain("secret internal stack trace");
    expect(body.toLowerCase()).not.toContain("stack");
  });
});

describe("エラーページのキャッシュ抑止", () => {
  test("404 応答はアプリ本体の ETag を引き継がない", async () => {
    const { env } = mockEnv(cacheableIndexResponse());
    const res = await app.request("/unknown-path", {}, env);
    expect(res.headers.get("ETag")).toBeNull();
    expect(res.headers.get("Last-Modified")).toBeNull();
  });

  test("404 応答は Cache-Control: no-store になる", async () => {
    const { env } = mockEnv(cacheableIndexResponse());
    const res = await app.request("/unknown-path", {}, env);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  test("ログインエラー（403）応答も ETag を持たず no-store になる", async () => {
    const { env } = mockEnv(cacheableIndexResponse());
    const res = await app.request("/login-error", {}, env);
    expect(res.headers.get("ETag")).toBeNull();
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("セキュリティヘッダーは付与しない（CloudFront Response Headers Policy の責務）", () => {
  test("HTML 応答に Content-Security-Policy を付与しない", async () => {
    const { env } = mockEnv(indexHtmlResponse());
    const res = await app.request("/balance", {}, env);
    expect(res.headers.get("Content-Security-Policy")).toBeNull();
  });

  test("HTML 応答に X-Frame-Options・X-Content-Type-Options を付与しない", async () => {
    const { env } = mockEnv(indexHtmlResponse());
    const res = await app.request("/balance", {}, env);
    expect(res.headers.get("X-Frame-Options")).toBeNull();
    expect(res.headers.get("X-Content-Type-Options")).toBeNull();
  });

  test("未知パス応答に COOP・CORP・Permissions-Policy を付与しない", async () => {
    const { env } = mockEnv(indexHtmlResponse());
    const res = await app.request("/unknown-path", {}, env);
    expect(res.headers.get("Cross-Origin-Opener-Policy")).toBeNull();
    expect(res.headers.get("Cross-Origin-Resource-Policy")).toBeNull();
    expect(res.headers.get("Permissions-Policy")).toBeNull();
  });
});
