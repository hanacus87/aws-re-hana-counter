/**
 * 設定ローダー（環境変数）の仕様
 *
 * 非機密の設定は Lambda 環境変数（CDK が供給）から読む。必須キーが欠ける／空なら
 * 起動時にエラーとする（フェイルファスト）。機密値そのものは含めず、SSM の
 * パラメータ名のみを持つ（実値は [[secrets]] のローダーが SSM から取得）。
 */
import { describe, expect, test } from "bun:test";
import { loadConfig } from "../../backend/lib/config";

const fullEnv = {
  PUBLIC_ORIGIN: "https://abc123.cloudfront.net",
  GOOGLE_CLIENT_ID: "client-id",
  GOOGLE_REDIRECT_URI: "https://abc123.cloudfront.net/auth/callback",
  USERS_TABLE: "users-table",
  BALANCES_TABLE: "balances-table",
  SESSION_SECRET_PARAM: "/app/session-secret",
  GOOGLE_CLIENT_SECRET_PARAM: "/app/google-client-secret",
};

describe("loadConfig", () => {
  test("必須の環境変数が揃えば設定オブジェクトを返す", () => {
    expect(loadConfig(fullEnv)).toEqual({
      publicOrigin: "https://abc123.cloudfront.net",
      googleClientId: "client-id",
      googleRedirectUri: "https://abc123.cloudfront.net/auth/callback",
      usersTable: "users-table",
      balancesTable: "balances-table",
      sessionSecretParam: "/app/session-secret",
      googleClientSecretParam: "/app/google-client-secret",
    });
  });

  test("必須の環境変数が欠けるとそのキー名を含むエラーを投げる", () => {
    expect(() => loadConfig({ ...fullEnv, PUBLIC_ORIGIN: undefined })).toThrow(
      "PUBLIC_ORIGIN",
    );
  });

  test("空文字の環境変数も欠落として扱いエラーを投げる", () => {
    expect(() => loadConfig({ ...fullEnv, USERS_TABLE: "" })).toThrow(
      "USERS_TABLE",
    );
  });
});
