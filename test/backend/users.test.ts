/**
 * ユーザーリポジトリと表示名サニタイズの仕様
 *
 * 保持するのは識別子（Google の subject）と表示名（userName）のみ。
 * 専用のサインアップフローは設けず、ログイン成功時の登録・更新（upsert）が
 * 新規登録を兼ねる。永続化は UserRepository ポートに注入する
 * （テストではインメモリ Fake を使う）。表示名のサニタイズ（制御文字除去・
 * 長さ制限）は永続化の前段で行う純粋関数とする。
 */
import { describe, expect, test } from "bun:test";
import { sanitizeUserName } from "../../backend/lib/users";
import { createMemoryUserRepository } from "../../backend/lib/memory-repository";

const NUL = String.fromCharCode(0x00);
const DEL = String.fromCharCode(0x7f);

describe("sanitizeUserName", () => {
  test("制御文字（NUL）・改行・タブ・DEL を含む表示名からそれらを除去して返す（結果は 山田太郎）", () => {
    expect(sanitizeUserName(`山田${NUL}太郎\n\t${DEL}`)).toBe("山田太郎");
  });

  test("記号（シングルクオート・セミコロン・ハイフン2つ）は除去せず保持する", () => {
    const value = "Robert'); DROP TABLE users; --";
    expect(sanitizeUserName(value)).toBe(value);
  });

  test("256 文字を超える表示名は先頭 256 文字に切り詰める", () => {
    expect(sanitizeUserName("あ".repeat(300))).toBe("あ".repeat(256));
  });
});

describe("UserRepository（インメモリ Fake）", () => {
  test("upsert した sub の userName を findUserName で取得できる", async () => {
    const repo = createMemoryUserRepository();
    await repo.upsert({ sub: "sub-1", userName: "花子" });
    expect(await repo.findUserName("sub-1")).toBe("花子");
  });

  test("同一 sub に再 upsert すると userName が更新される", async () => {
    const repo = createMemoryUserRepository();
    await repo.upsert({ sub: "sub-1", userName: "花子" });
    await repo.upsert({ sub: "sub-1", userName: "花子（改名）" });
    expect(await repo.findUserName("sub-1")).toBe("花子（改名）");
  });

  test("異なる sub のレコードは混在せずそれぞれの userName を返す", async () => {
    const repo = createMemoryUserRepository();
    await repo.upsert({ sub: "sub-1", userName: "花子" });
    await repo.upsert({ sub: "sub-2", userName: "太郎" });
    expect(await repo.findUserName("sub-1")).toBe("花子");
    expect(await repo.findUserName("sub-2")).toBe("太郎");
  });

  test("未登録の sub の検索は null を返す", async () => {
    const repo = createMemoryUserRepository();
    expect(await repo.findUserName("missing")).toBeNull();
  });
});
