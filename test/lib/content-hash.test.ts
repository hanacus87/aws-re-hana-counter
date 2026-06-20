/**
 * リクエストボディのコンテンツハッシュ（SHA-256）の仕様
 *
 * CloudFront OAC は Lambda Function URL への署名時にリクエストボディを署名しないため、
 * ボディ付き要求（PUT 等）はクライアントがボディの SHA-256（16 進小文字）を
 * x-amz-content-sha256 ヘッダーで送る必要がある。空ボディは空文字の SHA-256。
 */
import { describe, expect, test } from "bun:test";
import { contentSha256 } from "../../frontend/lib/content-hash";

describe("contentSha256", () => {
  test("JSON ボディの SHA-256 を 16 進小文字で返す", async () => {
    expect(
      await contentSha256('{"date":"2026-06-03","bet":1,"recovery":2}'),
    ).toBe("8a1f2dfa6aed70d195bd44f84a4bc79251507e14cd821c9c7116f2ae04c281af");
  });

  test("空ボディは空文字の SHA-256 を返す", async () => {
    expect(await contentSha256("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});
