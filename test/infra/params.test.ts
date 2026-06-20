/**
 * SSM パラメータ名の制約
 *
 * SSM Parameter Store は "aws" / "ssm" で始まるパラメータ名を予約しており作成できない
 * （AccessDeniedException: reserved parameter name）。既定のシークレットパラメータ名が
 * この予約に抵触しない（先頭が /aws・/ssm でない）スラッシュ付きパスであることを固定する。
 */
import { describe, expect, test } from "bun:test";
import {
  GOOGLE_CLIENT_SECRET_PARAM,
  SESSION_SECRET_PARAM,
} from "../../infra/params";

describe("SSM シークレットパラメータ名", () => {
  test("先頭スラッシュ付きの 2 階層パス形式", () => {
    for (const name of [SESSION_SECRET_PARAM, GOOGLE_CLIENT_SECRET_PARAM]) {
      expect(name).toMatch(/^\/[\w-]+\/[\w-]+$/);
    }
  });
});
