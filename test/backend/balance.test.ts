/**
 * 収支データのリポジトリと API の仕様
 *
 * 収支はユーザー単位（Google の subject）で 1日1件保存する。
 * 永続化は BalanceRepository ポートに注入する（テストではインメモリ Fake）。
 * データはユーザーごとに分離し、他ユーザーのレコードを取得・削除しない。
 *
 * API はセッションで認証し、保存・削除はセッションのユーザーにのみ作用する。
 * 変更系（PUT / DELETE）は同一オリジンを肯定的に確認できない要求を 403 で拒否する。
 * 投資・回収は 0 から 999999 の整数で再検証し、違反は 400。応答に内部識別子（sub）・
 * トークンを含めず、Cache-Control: no-store とし、CORS は無効。
 */
import { describe, expect, test } from "bun:test";
import app from "../../backend/index";
import { createMemoryBalanceRepository } from "../../backend/lib/memory-repository";
import { signSession } from "../../backend/lib/session";
import { applyNativeRequest } from "../helpers/native-request";
import { createTestEnv, TEST_ORIGIN } from "../helpers/backend-env";

applyNativeRequest();

const ORIGIN = TEST_ORIGIN;
const SESSION_COOKIE = "__Host-session";

async function sessionCookie(sub: string) {
  const token = await signSession(
    { sub },
    "session-secret",
    Math.floor(Date.now() / 1000),
  );
  return `${SESSION_COOKIE}=${token}`;
}

describe("BalanceRepository（インメモリ Fake）", () => {
  describe("upsert", () => {
    test("新規の日付に投資と回収を登録する", async () => {
      const repo = createMemoryBalanceRepository();
      await repo.upsert("sub-1", {
        date: "2026-06-03",
        bet: 1000,
        recovery: 3000,
      });
      expect(await repo.list("sub-1")).toEqual([
        { date: "2026-06-03", bet: 1000, recovery: 3000 },
      ]);
    });

    test("同一ユーザーの同一日付に再保存すると上書きされる（1日1件）", async () => {
      const repo = createMemoryBalanceRepository();
      await repo.upsert("sub-1", {
        date: "2026-06-03",
        bet: 1000,
        recovery: 3000,
      });
      await repo.upsert("sub-1", {
        date: "2026-06-03",
        bet: 500,
        recovery: 800,
      });
      expect(await repo.list("sub-1")).toEqual([
        { date: "2026-06-03", bet: 500, recovery: 800 },
      ]);
    });

    test("同一日付でもユーザーが異なれば別レコードとして保存される", async () => {
      const repo = createMemoryBalanceRepository();
      await repo.upsert("sub-1", { date: "2026-06-03", bet: 1, recovery: 2 });
      await repo.upsert("sub-2", { date: "2026-06-03", bet: 3, recovery: 4 });
      expect(await repo.list("sub-1")).toEqual([
        { date: "2026-06-03", bet: 1, recovery: 2 },
      ]);
      expect(await repo.list("sub-2")).toEqual([
        { date: "2026-06-03", bet: 3, recovery: 4 },
      ]);
    });
  });

  describe("list", () => {
    test("そのユーザーのレコードを日付の昇順で返す", async () => {
      const repo = createMemoryBalanceRepository();
      await repo.upsert("sub-1", { date: "2026-06-05", bet: 3, recovery: 4 });
      await repo.upsert("sub-1", { date: "2026-06-01", bet: 1, recovery: 2 });
      expect(await repo.list("sub-1")).toEqual([
        { date: "2026-06-01", bet: 1, recovery: 2 },
        { date: "2026-06-05", bet: 3, recovery: 4 },
      ]);
    });

    test("他ユーザーのレコードは含めない", async () => {
      const repo = createMemoryBalanceRepository();
      await repo.upsert("sub-1", { date: "2026-06-01", bet: 1, recovery: 2 });
      await repo.upsert("sub-2", { date: "2026-06-01", bet: 3, recovery: 4 });
      expect(await repo.list("sub-1")).toEqual([
        { date: "2026-06-01", bet: 1, recovery: 2 },
      ]);
    });

    test("記録が無いユーザーには空を返す", async () => {
      const repo = createMemoryBalanceRepository();
      expect(await repo.list("ghost")).toEqual([]);
    });
  });

  describe("remove", () => {
    test("指定したユーザーと日付のレコードを削除する", async () => {
      const repo = createMemoryBalanceRepository();
      await repo.upsert("sub-1", { date: "2026-06-03", bet: 1, recovery: 2 });
      await repo.remove("sub-1", "2026-06-03");
      expect(await repo.list("sub-1")).toEqual([]);
    });

    test("他ユーザーの同一日付のレコードは削除しない", async () => {
      const repo = createMemoryBalanceRepository();
      await repo.upsert("sub-1", { date: "2026-06-03", bet: 1, recovery: 2 });
      await repo.upsert("sub-2", { date: "2026-06-03", bet: 3, recovery: 4 });
      await repo.remove("sub-1", "2026-06-03");
      expect(await repo.list("sub-2")).toEqual([
        { date: "2026-06-03", bet: 3, recovery: 4 },
      ]);
    });
  });
});

describe("GET /api/balance", () => {
  test("有効なセッションでそのユーザーのレコードを返す", async () => {
    const { balances, env } = createTestEnv();
    await balances.upsert("sub-1", {
      date: "2026-06-03",
      bet: 1000,
      recovery: 3000,
    });
    const res = await app.request(
      `${ORIGIN}/api/balance`,
      { headers: { Cookie: await sessionCookie("sub-1") } },
      env,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      records: [{ date: "2026-06-03", bet: 1000, recovery: 3000 }],
    });
  });

  test("応答に内部識別子 sub やトークンを含めない", async () => {
    const { balances, env } = createTestEnv();
    await balances.upsert("sub-1", { date: "2026-06-03", bet: 1, recovery: 2 });
    const res = await app.request(
      `${ORIGIN}/api/balance`,
      { headers: { Cookie: await sessionCookie("sub-1") } },
      env,
    );
    const body = await res.text();
    expect(body).not.toContain("sub-1");
    expect(body).not.toContain(SESSION_COOKIE);
  });

  test("応答に Cache-Control: no-store を含む", async () => {
    const { env } = createTestEnv();
    const res = await app.request(
      `${ORIGIN}/api/balance`,
      { headers: { Cookie: await sessionCookie("sub-1") } },
      env,
    );
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  test("応答に Access-Control-Allow-Origin を含めない", async () => {
    const { env } = createTestEnv();
    const res = await app.request(
      `${ORIGIN}/api/balance`,
      { headers: { Cookie: await sessionCookie("sub-1") } },
      env,
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  test("セッションが無い・無効のとき 401 を返す", async () => {
    const { env } = createTestEnv();
    const noCookie = await app.request(`${ORIGIN}/api/balance`, {}, env);
    expect(noCookie.status).toBe(401);
    const invalid = await app.request(
      `${ORIGIN}/api/balance`,
      { headers: { Cookie: `${SESSION_COOKIE}=not-a-token` } },
      env,
    );
    expect(invalid.status).toBe(401);
  });
});

describe("PUT /api/balance", () => {
  function put(
    env: ReturnType<typeof createTestEnv>["env"],
    body: unknown,
    headers: Record<string, string> = {},
  ) {
    return app.request(
      `${ORIGIN}/api/balance`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Origin: ORIGIN,
          ...headers,
        },
        body: JSON.stringify(body),
      },
      env,
    );
  }

  test("有効なセッションと同一オリジンで指定日の投資と回収を保存する", async () => {
    const { balances, env } = createTestEnv();
    const res = await put(
      env,
      { date: "2026-06-03", bet: 1000, recovery: 3000 },
      { Cookie: await sessionCookie("sub-1") },
    );
    expect(res.status).toBe(204);
    expect(await balances.list("sub-1")).toEqual([
      { date: "2026-06-03", bet: 1000, recovery: 3000 },
    ]);
  });

  test("投資または回収が 0 から 999999 の整数でないとき 400 を返し保存しない", async () => {
    const { balances, env } = createTestEnv();
    const cookie = await sessionCookie("sub-1");
    for (const body of [
      { date: "2026-06-03", bet: -1, recovery: 0 },
      { date: "2026-06-03", bet: 0, recovery: 1000000 },
      { date: "2026-06-03", bet: 1.5, recovery: 0 },
      { date: "2026-06-03", bet: "x", recovery: 0 },
    ]) {
      const res = await put(env, body, { Cookie: cookie });
      expect(res.status).toBe(400);
    }
    expect(await balances.list("sub-1")).toEqual([]);
  });

  test("日付が YYYY-MM-DD 形式でないとき 400 を返す", async () => {
    const { env } = createTestEnv();
    const res = await put(
      env,
      { date: "2026/6/3", bet: 0, recovery: 0 },
      { Cookie: await sessionCookie("sub-1") },
    );
    expect(res.status).toBe(400);
  });

  test("本文で別ユーザーを指定してもセッションのユーザーのレコードとして保存する", async () => {
    const { balances, env } = createTestEnv();
    await put(
      env,
      { date: "2026-06-03", bet: 1, recovery: 2, sub: "victim" },
      { Cookie: await sessionCookie("sub-1") },
    );
    expect(await balances.list("sub-1")).toHaveLength(1);
    expect(await balances.list("victim")).toEqual([]);
  });

  test("セッションが無いとき 401 を返す", async () => {
    const { env } = createTestEnv();
    const res = await put(env, { date: "2026-06-03", bet: 0, recovery: 0 });
    expect(res.status).toBe(401);
  });

  test("Origin も Sec-Fetch-Site も無い要求は 403 を返す（フェイルクローズ）", async () => {
    const { env } = createTestEnv();
    const res = await app.request(
      `${ORIGIN}/api/balance`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Cookie: await sessionCookie("sub-1"),
        },
        body: JSON.stringify({ date: "2026-06-03", bet: 0, recovery: 0 }),
      },
      env,
    );
    expect(res.status).toBe(403);
  });

  test("別オリジンからの要求は 403 を返す", async () => {
    const { env } = createTestEnv();
    const res = await put(
      env,
      { date: "2026-06-03", bet: 0, recovery: 0 },
      {
        Origin: "https://evil.example.com",
        Cookie: await sessionCookie("sub-1"),
      },
    );
    expect(res.status).toBe(403);
  });

  test("本文が不正な JSON のとき 400 を返す", async () => {
    const { env } = createTestEnv();
    const res = await app.request(
      `${ORIGIN}/api/balance`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Origin: ORIGIN,
          Cookie: await sessionCookie("sub-1"),
        },
        body: "not-json",
      },
      env,
    );
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/balance", () => {
  function del(
    env: ReturnType<typeof createTestEnv>["env"],
    date: string | undefined,
    headers: Record<string, string> = {},
  ) {
    const query = date === undefined ? "" : `?date=${encodeURIComponent(date)}`;
    return app.request(
      `${ORIGIN}/api/balance${query}`,
      {
        method: "DELETE",
        headers: { Origin: ORIGIN, ...headers },
      },
      env,
    );
  }

  test("有効なセッションと同一オリジンで指定日（クエリ）のレコードを削除する", async () => {
    const { balances, env } = createTestEnv();
    await balances.upsert("sub-1", { date: "2026-06-03", bet: 1, recovery: 2 });
    const res = await del(env, "2026-06-03", {
      Cookie: await sessionCookie("sub-1"),
    });
    expect(res.status).toBe(204);
    expect(await balances.list("sub-1")).toEqual([]);
  });

  test("削除対象はセッションのユーザー自身のレコードに限る", async () => {
    const { balances, env } = createTestEnv();
    await balances.upsert("sub-1", { date: "2026-06-03", bet: 1, recovery: 2 });
    await balances.upsert("sub-2", { date: "2026-06-03", bet: 3, recovery: 4 });
    await del(env, "2026-06-03", { Cookie: await sessionCookie("sub-1") });
    expect(await balances.list("sub-2")).toEqual([
      { date: "2026-06-03", bet: 3, recovery: 4 },
    ]);
  });

  test("セッションが無いとき 401 を返す", async () => {
    const { env } = createTestEnv();
    const res = await del(env, "2026-06-03");
    expect(res.status).toBe(401);
  });

  test("別オリジンからの要求は 403 を返す", async () => {
    const { env } = createTestEnv();
    const res = await del(env, "2026-06-03", {
      Origin: "https://evil.example.com",
      Cookie: await sessionCookie("sub-1"),
    });
    expect(res.status).toBe(403);
  });

  test("date クエリが YYYY-MM-DD 形式でないとき 400 を返す", async () => {
    const { env } = createTestEnv();
    const res = await del(env, "2026/6/3", {
      Cookie: await sessionCookie("sub-1"),
    });
    expect(res.status).toBe(400);
  });

  test("date クエリが無いとき 400 を返す", async () => {
    const { env } = createTestEnv();
    const res = await del(env, undefined, {
      Cookie: await sessionCookie("sub-1"),
    });
    expect(res.status).toBe(400);
  });
});
