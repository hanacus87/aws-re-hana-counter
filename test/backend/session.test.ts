/**
 * セッショントークンの仕様
 *
 * ログイン成功後、利用者の識別子を含む署名付きトークン（有効期限1日）を発行し、
 * HttpOnly Cookie に格納する。テスト容易性のため、発行・検証の関数は
 * 署名鍵と現在時刻を引数で受け取る。
 */
import { describe, expect, test } from "bun:test";
import { sign } from "hono/jwt";
import { signSession, verifySession } from "../../backend/lib/session";

const SECRET = "test-secret-key";
const nowSec = () => Math.floor(Date.now() / 1000);

describe("セッショントークンの発行と検証", () => {
  test("発行したトークンは同じ鍵で検証に成功し、利用者の識別子を取り出せる", async () => {
    const now = nowSec();
    const token = await signSession({ sub: "user-123" }, SECRET, now);
    const claims = await verifySession(token, SECRET, now);
    expect(claims.sub).toBe("user-123");
  });

  test("異なる鍵で発行されたトークンは検証に失敗する", async () => {
    const now = nowSec();
    const token = await signSession({ sub: "user-123" }, "other-key", now);
    expect(verifySession(token, SECRET, now)).rejects.toThrow();
  });

  test("改ざんされたトークンは検証に失敗する", async () => {
    const now = nowSec();
    const token = await signSession({ sub: "user-123" }, SECRET, now);
    const tampered = token.slice(0, -2) + (token.endsWith("a") ? "bb" : "aa");
    expect(verifySession(tampered, SECRET, now)).rejects.toThrow();
  });

  test("有効期限切れのトークンは検証に失敗する", async () => {
    const issued = nowSec() - 2 * 24 * 60 * 60;
    const token = await signSession({ sub: "user-123" }, SECRET, issued);
    expect(verifySession(token, SECRET, nowSec())).rejects.toThrow();
  });

  test("注入した現在時刻が有効期限を過ぎていれば検証に失敗する", async () => {
    const issued = nowSec();
    const token = await signSession({ sub: "user-123" }, SECRET, issued);
    const future = issued + 2 * 24 * 60 * 60;
    expect(verifySession(token, SECRET, future)).rejects.toThrow();
  });

  test("利用者の識別子を持たないトークンは検証に失敗する", async () => {
    const now = nowSec();
    const token = await sign({ iat: now, exp: now + 24 * 60 * 60 }, SECRET);
    expect(verifySession(token, SECRET, now)).rejects.toThrow();
  });

  test("有効期限の長さは1日である", async () => {
    const now = nowSec();
    const token = await signSession({ sub: "user-123" }, SECRET, now);
    const [, payload] = token.split(".");
    const claims = JSON.parse(atob(payload));
    expect(claims.exp - claims.iat).toBe(24 * 60 * 60);
  });

  test("有効期限クレームを持たないトークンは検証に失敗する", async () => {
    const now = nowSec();
    const token = await sign({ sub: "user-123", iat: now }, SECRET);
    expect(verifySession(token, SECRET, now)).rejects.toThrow();
  });

  test("トークンに含めるのは識別子と発行日時・有効期限のみ（表示名や個人情報を含めない）", async () => {
    const now = nowSec();
    const token = await signSession({ sub: "user-123" }, SECRET, now);
    const [, payload] = token.split(".");
    const claims = JSON.parse(atob(payload));
    expect(Object.keys(claims).sort()).toEqual(["exp", "iat", "sub"]);
  });
});
