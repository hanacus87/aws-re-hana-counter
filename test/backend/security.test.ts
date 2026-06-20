/**
 * Content-Security-Policy の構築仕様
 *
 * 本番では default-src 'self' の strict な CSP を返し、インラインスクリプトを
 * 許可しない。dev（Vite が HMR のためインラインスクリプトを注入する）では
 * script-src に 'unsafe-inline' を含めて緩める。
 * いずれの場合もフレーム埋め込みは frame-ancestors 'none' で禁止する。
 */
import { describe, expect, test } from "bun:test";
import { buildContentSecurityPolicy } from "../../backend/lib/security";

describe("buildContentSecurityPolicy", () => {
  test("本番ではインラインスクリプトを許可しない（unsafe-inline を含めない）", () => {
    const csp = buildContentSecurityPolicy(false);
    expect(csp).not.toContain("unsafe-inline");
  });

  test("本番では default-src を self に限定する", () => {
    const csp = buildContentSecurityPolicy(false);
    expect(csp).toContain("default-src 'self'");
  });

  test("本番ではフォーム送信先・プラグイン・フレームを制限する", () => {
    const csp = buildContentSecurityPolicy(false);
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("frame-src 'none'");
  });

  test("dev ではインラインスクリプトを許可する（script-src に unsafe-inline）", () => {
    const csp = buildContentSecurityPolicy(true);
    expect(csp).toContain("script-src");
    expect(csp).toContain("'unsafe-inline'");
  });

  test("dev / 本番のいずれもフレーム埋め込みを禁止する", () => {
    expect(buildContentSecurityPolicy(false)).toContain(
      "frame-ancestors 'none'",
    );
    expect(buildContentSecurityPolicy(true)).toContain(
      "frame-ancestors 'none'",
    );
  });
});
