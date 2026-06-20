/**
 * Google OIDC 認証ルートの仕様
 *
 * Authorization Code Flow + PKCE を Worker が処理する。
 * ID トークンは OIDC Core の検証手順（署名・発行者・宛先・有効期限・nonce）を
 * すべて実施し、検証の省略・簡略化をしない。
 * セッションは署名付きトークンを HttpOnly Cookie に格納する。
 * テストではモックの環境（リポジトリ・シークレット・Google 応答）を注入する。
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import app from "../../backend/index";
import { signSession } from "../../backend/lib/session";
import { applyNativeRequest } from "../helpers/native-request";
import {
  createTestEnv,
  TEST_CLIENT_ID,
  TEST_ORIGIN,
} from "../helpers/backend-env";
import {
  createOidcKeys,
  googleFetchStub,
  idTokenClaims,
  mintIdToken,
  type OidcKeys,
} from "../helpers/oidc";

applyNativeRequest();

const CLIENT_ID = TEST_CLIENT_ID;
const ORIGIN = TEST_ORIGIN;
const SESSION_COOKIE = "__Host-session";
const STATE_COOKIE = "__Host-oauth_state";
const NONCE_COOKIE = "__Host-oauth_nonce";
const VERIFIER_COOKIE = "__Host-oauth_verifier";

const originalFetch = globalThis.fetch;
let keys: OidcKeys;

beforeEach(async () => {
  keys = await createOidcKeys();
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

const testEnv = createTestEnv;

function tempCookieHeader(state = "S", nonce = "test-nonce", verifier = "V") {
  return `${STATE_COOKIE}=${state}; ${NONCE_COOKIE}=${nonce}; ${VERIFIER_COOKIE}=${verifier}`;
}

function expectLoginErrorRedirect(res: Response) {
  expect(res.status).toBe(302);
  expect(res.headers.get("Location")).toBe("/login-error");
}

async function runCallback(
  idToken: string,
  options: {
    env: ReturnType<typeof testEnv>["env"];
    cookieState?: string;
    queryState?: string;
    nonce?: string;
  },
) {
  globalThis.fetch = googleFetchStub(keys, idToken);
  const cookieState = options.cookieState ?? "S";
  const queryState = options.queryState ?? "S";
  return app.request(
    `${ORIGIN}/auth/callback?code=auth-code&state=${queryState}`,
    { headers: { Cookie: tempCookieHeader(cookieState, options.nonce) } },
    options.env,
  );
}

describe("ログイン開始", () => {
  test("Google の認可エンドポイントへリダイレクトする", async () => {
    const { env } = testEnv();
    const res = await app.request(`${ORIGIN}/auth/login`, {}, env);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toContain(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
  });

  test("認可 URL に client_id・redirect_uri・scope（openid profile）・state・nonce・PKCE の code_challenge が含まれる", async () => {
    const { env } = testEnv();
    const res = await app.request(`${ORIGIN}/auth/login`, {}, env);
    const url = new URL(res.headers.get("Location")!);
    expect(url.searchParams.get("client_id")).toBe(CLIENT_ID);
    expect(url.searchParams.get("redirect_uri")).toBe(
      `${ORIGIN}/auth/callback`,
    );
    expect(url.searchParams.get("scope")).toBe("openid profile");
    expect(url.searchParams.get("state")).toBeTruthy();
    expect(url.searchParams.get("nonce")).toBeTruthy();
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });

  test("認可 URL に prompt=login が含まれる", async () => {
    const { env } = testEnv();
    const res = await app.request(`${ORIGIN}/auth/login`, {}, env);
    const url = new URL(res.headers.get("Location")!);
    expect(url.searchParams.get("prompt")).toBe("login");
  });

  test("state・nonce・code_verifier を有効期限付きの HttpOnly Cookie に保存する", async () => {
    const { env } = testEnv();
    const res = await app.request(`${ORIGIN}/auth/login`, {}, env);
    const cookies = res.headers.getSetCookie();
    for (const name of [STATE_COOKIE, NONCE_COOKIE, VERIFIER_COOKIE]) {
      const cookie = cookies.find((c) => c.startsWith(`${name}=`));
      expect(cookie).toBeTruthy();
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("Max-Age=600");
    }
  });
});

describe("コールバック — ID トークン検証（OIDC 準拠）", () => {
  test("署名が Google の公開鍵で検証できない場合はログインエラー画面へ誘導する", async () => {
    const { env } = testEnv();
    const otherKeys = await createOidcKeys();
    const idToken = await mintIdToken(otherKeys, idTokenClaims());
    const res = await runCallback(idToken, { env });
    expectLoginErrorRedirect(res);
  });

  test("署名アルゴリズムが RS256 でない場合はログインエラー画面へ誘導する", async () => {
    const { sign } = await import("hono/jwt");
    const idToken = await sign(idTokenClaims(), "symmetric-secret", "HS256");
    const { env } = testEnv();
    const res = await runCallback(idToken, { env });
    expectLoginErrorRedirect(res);
  });

  test("発行者が Google でない場合はログインエラー画面へ誘導する", async () => {
    const idToken = await mintIdToken(
      keys,
      idTokenClaims({ iss: "https://evil.example.com" }),
    );
    const { env } = testEnv();
    const res = await runCallback(idToken, { env });
    expectLoginErrorRedirect(res);
  });

  test("発行者が accounts.google.com に類似するが完全一致しない場合はログインエラー画面へ誘導する", async () => {
    const idToken = await mintIdToken(
      keys,
      idTokenClaims({ iss: "https://accounts.google.com.evil.example.com" }),
    );
    const { env } = testEnv();
    const res = await runCallback(idToken, { env });
    expectLoginErrorRedirect(res);
  });

  test("宛先が自クライアントの client_id でない場合はログインエラー画面へ誘導する", async () => {
    const idToken = await mintIdToken(
      keys,
      idTokenClaims({ aud: "other-client" }),
    );
    const { env } = testEnv();
    const res = await runCallback(idToken, { env });
    expectLoginErrorRedirect(res);
  });

  test("azp が存在し自クライアントの client_id と一致しない場合はログインエラー画面へ誘導する", async () => {
    const idToken = await mintIdToken(
      keys,
      idTokenClaims({ azp: "other-client" }),
    );
    const { env } = testEnv();
    const res = await runCallback(idToken, { env });
    expectLoginErrorRedirect(res);
  });

  test("有効期限切れの場合はログインエラー画面へ誘導する", async () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    const idToken = await mintIdToken(
      keys,
      idTokenClaims({ iat: past - 60, exp: past }),
    );
    const { env } = testEnv();
    const res = await runCallback(idToken, { env });
    expectLoginErrorRedirect(res);
  });

  test("nonce が認可リクエスト時の値と一致しない場合はログインエラー画面へ誘導する", async () => {
    const idToken = await mintIdToken(
      keys,
      idTokenClaims({ nonce: "attacker-nonce" }),
    );
    const { env } = testEnv();
    const res = await runCallback(idToken, { env, nonce: "test-nonce" });
    expectLoginErrorRedirect(res);
  });

  test("state が認可リクエスト時の値と一致しない場合はログインエラー画面へ誘導する", async () => {
    const idToken = await mintIdToken(keys, idTokenClaims());
    const { env } = testEnv();
    const res = await runCallback(idToken, {
      env,
      cookieState: "S",
      queryState: "DIFFERENT",
    });
    expectLoginErrorRedirect(res);
  });

  test("ID トークンに exp が無い場合はログインエラー画面へ誘導する", async () => {
    const idToken = await mintIdToken(keys, idTokenClaims({ exp: undefined }));
    const { env } = testEnv();
    const res = await runCallback(idToken, { env });
    expectLoginErrorRedirect(res);
  });

  test("ID トークンに sub が無い場合はログインエラー画面へ誘導する", async () => {
    const idToken = await mintIdToken(keys, idTokenClaims({ sub: undefined }));
    const { env } = testEnv();
    const res = await runCallback(idToken, { env });
    expectLoginErrorRedirect(res);
  });

  test("一時 Cookie が無い状態でコールバックを受けるとログインエラー画面へ誘導する", async () => {
    const { env } = testEnv();
    globalThis.fetch = googleFetchStub(
      keys,
      await mintIdToken(keys, idTokenClaims()),
    );
    const res = await app.request(
      `${ORIGIN}/auth/callback?code=auth-code&state=S`,
      {},
      env,
    );
    expectLoginErrorRedirect(res);
  });

  test("トークン交換が失敗した場合はログインエラー画面へ誘導する", async () => {
    const { env } = testEnv();
    globalThis.fetch = (async () =>
      new Response(null, { status: 400 })) as unknown as typeof fetch;
    const res = await app.request(
      `${ORIGIN}/auth/callback?code=auth-code&state=S`,
      { headers: { Cookie: tempCookieHeader() } },
      env,
    );
    expectLoginErrorRedirect(res);
  });

  test("トークン応答に id_token が無い場合はログインエラー画面へ誘導する", async () => {
    const { env } = testEnv();
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({}), {
        headers: { "Content-Type": "application/json" },
      })) as unknown as typeof fetch;
    const res = await app.request(
      `${ORIGIN}/auth/callback?code=auth-code&state=S`,
      { headers: { Cookie: tempCookieHeader() } },
      env,
    );
    expectLoginErrorRedirect(res);
  });

  test("検証に失敗した場合はセッションを発行しない", async () => {
    const idToken = await mintIdToken(keys, idTokenClaims({ aud: "other" }));
    const { env } = testEnv();
    const res = await runCallback(idToken, { env });
    const cookies = res.headers.getSetCookie();
    expect(cookies.some((c) => c.startsWith(`${SESSION_COOKIE}=`))).toBe(false);
  });

  test("検証に失敗した場合も一時 Cookie を削除する", async () => {
    const idToken = await mintIdToken(keys, idTokenClaims({ aud: "other" }));
    const { env } = testEnv();
    const res = await runCallback(idToken, { env });
    const cookies = res.headers.getSetCookie();
    for (const name of [STATE_COOKIE, NONCE_COOKIE, VERIFIER_COOKIE]) {
      const cookie = cookies.find((c) => c.startsWith(`${name}=`));
      expect(cookie).toContain("Max-Age=0");
    }
  });
});

describe("コールバック — 成功時", () => {
  test("セッション Cookie を発行してホームへリダイレクトする", async () => {
    const idToken = await mintIdToken(keys, idTokenClaims());
    const { env } = testEnv();
    const res = await runCallback(idToken, { env });
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/");
    const session = res.headers
      .getSetCookie()
      .find((c) => c.startsWith(`${SESSION_COOKIE}=`));
    expect(session).toBeTruthy();
  });

  test("セッション Cookie は HttpOnly・Secure・SameSite=Lax である", async () => {
    const idToken = await mintIdToken(keys, idTokenClaims());
    const { env } = testEnv();
    const res = await runCallback(idToken, { env });
    const session = res.headers
      .getSetCookie()
      .find((c) => c.startsWith(`${SESSION_COOKIE}=`))!;
    expect(session).toContain("HttpOnly");
    expect(session).toContain("Secure");
    expect(session).toContain("SameSite=Lax");
  });

  test("セッション Cookie 名は __Host- プレフィックス付きで Domain 指定なし・Path=/ である", async () => {
    const idToken = await mintIdToken(keys, idTokenClaims());
    const { env } = testEnv();
    const res = await runCallback(idToken, { env });
    const session = res.headers
      .getSetCookie()
      .find((c) => c.startsWith("__Host-"))!;
    expect(session.startsWith(`${SESSION_COOKIE}=`)).toBe(true);
    expect(session).toContain("Path=/");
    expect(session.toLowerCase()).not.toContain("domain=");
  });

  test("初回ログインのユーザーをリポジトリに登録する（自動登録）", async () => {
    const idToken = await mintIdToken(keys, idTokenClaims());
    const { users, env } = testEnv();
    await runCallback(idToken, { env });
    expect(await users.findUserName("google-sub-1")).toBe("花子");
  });

  test("一時 Cookie（state・nonce・code_verifier）を削除する", async () => {
    const idToken = await mintIdToken(keys, idTokenClaims());
    const { env } = testEnv();
    const res = await runCallback(idToken, { env });
    const cookies = res.headers.getSetCookie();
    for (const name of [STATE_COOKIE, NONCE_COOKIE, VERIFIER_COOKIE]) {
      const cookie = cookies.find((c) => c.startsWith(`${name}=`));
      expect(cookie).toContain("Max-Age=0");
    }
  });
});

describe("ユーザー情報 API", () => {
  async function sessionCookie(sub: string) {
    const token = await signSession(
      { sub },
      "session-secret",
      Math.floor(Date.now() / 1000),
    );
    return `${SESSION_COOKIE}=${token}`;
  }

  test("有効なセッションでは userName のみを返す", async () => {
    const { users, env } = testEnv();
    await users.upsert({ sub: "sub-1", userName: "花子" });
    const res = await app.request(
      `${ORIGIN}/api/me`,
      { headers: { Cookie: await sessionCookie("sub-1") } },
      env,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userName: "花子" });
  });

  test("応答に内部識別子・トークンを含めない", async () => {
    const { users, env } = testEnv();
    await users.upsert({ sub: "sub-1", userName: "花子" });
    const res = await app.request(
      `${ORIGIN}/api/me`,
      { headers: { Cookie: await sessionCookie("sub-1") } },
      env,
    );
    const body = await res.text();
    expect(body).not.toContain("sub-1");
    expect(body).not.toContain(SESSION_COOKIE);
  });

  test("応答に Cache-Control: no-store が含まれる", async () => {
    const { users, env } = testEnv();
    await users.upsert({ sub: "sub-1", userName: "花子" });
    const res = await app.request(
      `${ORIGIN}/api/me`,
      { headers: { Cookie: await sessionCookie("sub-1") } },
      env,
    );
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  test("応答に Access-Control-Allow-Origin を含めない（CORS 無効）", async () => {
    const { users, env } = testEnv();
    await users.upsert({ sub: "sub-1", userName: "花子" });
    const res = await app.request(
      `${ORIGIN}/api/me`,
      { headers: { Cookie: await sessionCookie("sub-1") } },
      env,
    );
    expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  test("セッションが無い・無効・期限切れの場合は 401 を返す", async () => {
    const { env } = testEnv();
    const noCookie = await app.request(`${ORIGIN}/api/me`, {}, env);
    expect(noCookie.status).toBe(401);
    const invalid = await app.request(
      `${ORIGIN}/api/me`,
      { headers: { Cookie: `${SESSION_COOKIE}=not-a-token` } },
      env,
    );
    expect(invalid.status).toBe(401);
  });

  test("セッションは有効だがユーザーがリポジトリに存在しない場合（データベース初期化後など）は 401 を返す", async () => {
    const { env } = testEnv();
    const res = await app.request(
      `${ORIGIN}/api/me`,
      { headers: { Cookie: await sessionCookie("ghost") } },
      env,
    );
    expect(res.status).toBe(401);
  });
});

// ログアウトはステートレスな自前セッション Cookie の無効化のみを行う。
// サーバー側にセッションストアは持たず、Google のセッションには関与しない。
// クロスサイトからの強制ログアウトを防ぐため、同一オリジンを肯定的に
// 確認できない要求は 403 で拒否する（フェイルクローズ）。
describe("ログアウト", () => {
  test("同一オリジン（Origin 一致）からの要求はセッション Cookie を無効化する", async () => {
    const { env } = testEnv();
    const res = await app.request(
      `${ORIGIN}/auth/logout`,
      { method: "POST", headers: { Origin: ORIGIN } },
      env,
    );
    expect(res.status).toBe(204);
    const cookie = res.headers
      .getSetCookie()
      .find((c) => c.startsWith(`${SESSION_COOKIE}=`));
    expect(cookie).toContain("Max-Age=0");
  });

  test("Sec-Fetch-Site が same-origin のみの要求も受け付ける", async () => {
    const { env } = testEnv();
    const res = await app.request(
      `${ORIGIN}/auth/logout`,
      { method: "POST", headers: { "Sec-Fetch-Site": "same-origin" } },
      env,
    );
    expect(res.status).toBe(204);
  });

  test("Origin も Sec-Fetch-Site も無い要求は 403 を返す（フェイルクローズ）", async () => {
    const { env } = testEnv();
    const res = await app.request(
      `${ORIGIN}/auth/logout`,
      { method: "POST" },
      env,
    );
    expect(res.status).toBe(403);
  });

  test("別オリジンからの要求は 403 を返す", async () => {
    const { env } = testEnv();
    const res = await app.request(
      `${ORIGIN}/auth/logout`,
      { method: "POST", headers: { Origin: "https://evil.example.com" } },
      env,
    );
    expect(res.status).toBe(403);
  });

  test("Sec-Fetch-Site が same-origin でない要求は 403 を返す", async () => {
    const { env } = testEnv();
    const res = await app.request(
      `${ORIGIN}/auth/logout`,
      { method: "POST", headers: { "Sec-Fetch-Site": "cross-site" } },
      env,
    );
    expect(res.status).toBe(403);
  });
});
