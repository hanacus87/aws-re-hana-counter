/**
 * 変更系リクエスト（mutate）の仕様
 *
 * CloudFront OAC は Lambda Function URL のボディを署名しないため、変更系は必ず
 * x-amz-content-sha256（ボディの SHA-256、ボディ無しは空文字の SHA-256）を付けて送る。
 * ボディがある場合のみ Content-Type: application/json を付ける。
 */
import { afterEach, describe, expect, test } from "bun:test";
import { mutate } from "../../frontend/lib/api";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

function captureFetch() {
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(null, { status: 204 });
  }) as unknown as typeof fetch;
  return calls;
}

describe("mutate", () => {
  test("ボディ付きはメソッド・本文・ボディの content-sha256・JSON の Content-Type を送る", async () => {
    const calls = captureFetch();
    await mutate(
      "/api/balance",
      "PUT",
      '{"date":"2026-06-03","bet":1,"recovery":2}',
    );
    const { url, init } = calls[0];
    const headers = init.headers as Record<string, string>;
    expect(url).toBe("/api/balance");
    expect(init.method).toBe("PUT");
    expect(init.body).toBe('{"date":"2026-06-03","bet":1,"recovery":2}');
    expect(headers["x-amz-content-sha256"]).toBe(
      "8a1f2dfa6aed70d195bd44f84a4bc79251507e14cd821c9c7116f2ae04c281af",
    );
    expect(headers["Content-Type"]).toBe("application/json");
  });

  test("ボディ無しは空ハッシュを送り Content-Type と本文は付けない", async () => {
    const calls = captureFetch();
    await mutate("/auth/logout", "POST");
    const { init } = calls[0];
    const headers = init.headers as Record<string, string>;
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
    expect(headers["x-amz-content-sha256"]).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(headers["Content-Type"]).toBeUndefined();
  });
});
