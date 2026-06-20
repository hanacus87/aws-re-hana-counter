/**
 * シークレット取得（SSM Parameter Store SecureString）の仕様
 *
 * SESSION_SECRET / GOOGLE_CLIENT_SECRET は SSM の SecureString で管理し、
 * Lambda 初期化時に取得してプロセス内にキャッシュする。復号（WithDecryption）を
 * 必須とし、同一パラメータの再取得は SSM を再呼び出ししない。値が無ければエラー。
 * SSMClient を注入し、aws-sdk-client-mock で送信コマンドを固定する。
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { mockClient } from "aws-sdk-client-mock";
import { createSecretLoader } from "../../backend/lib/secrets";

const ssmMock = mockClient(SSMClient);
const client = new SSMClient({ region: "ap-northeast-1" });

beforeEach(() => {
  ssmMock.reset();
});

describe("createSecretLoader", () => {
  test("SSM の SecureString を復号（WithDecryption）して取得する", async () => {
    ssmMock
      .on(GetParameterCommand)
      .resolves({ Parameter: { Value: "s3cr3t" } });
    const getSecret = createSecretLoader(client);
    expect(await getSecret("/app/session-secret")).toBe("s3cr3t");
    const calls = ssmMock.commandCalls(GetParameterCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input).toEqual({
      Name: "/app/session-secret",
      WithDecryption: true,
    });
  });

  test("同一パラメータの2回目以降はキャッシュから返し SSM を再呼び出ししない", async () => {
    ssmMock
      .on(GetParameterCommand)
      .resolves({ Parameter: { Value: "s3cr3t" } });
    const getSecret = createSecretLoader(client);
    expect(await getSecret("/app/session-secret")).toBe("s3cr3t");
    expect(await getSecret("/app/session-secret")).toBe("s3cr3t");
    expect(ssmMock.commandCalls(GetParameterCommand)).toHaveLength(1);
  });

  test("異なるパラメータはそれぞれ取得しキャッシュする", async () => {
    ssmMock.on(GetParameterCommand).resolves({ Parameter: { Value: "v" } });
    const getSecret = createSecretLoader(client);
    await getSecret("/app/a");
    await getSecret("/app/b");
    await getSecret("/app/a");
    expect(ssmMock.commandCalls(GetParameterCommand)).toHaveLength(2);
  });

  test("Parameter の値が無ければエラーを投げる", async () => {
    ssmMock.on(GetParameterCommand).resolves({});
    const getSecret = createSecretLoader(client);
    expect(getSecret("/app/missing")).rejects.toThrow();
  });
});
