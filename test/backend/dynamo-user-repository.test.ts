/**
 * DynamoDB の UserRepository 実装の仕様
 *
 * users テーブルは PK=sub。表示名（userName）のみ保存する。
 * `@aws-sdk/lib-dynamodb` の DocumentClient を注入し、aws-sdk-client-mock で
 * 送信コマンドを固定する。取得は ProjectionExpression で userName のみに絞り、
 * 内部属性を返さない。
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { createDynamoUserRepository } from "../../backend/lib/dynamo-user-repository";

const TABLE = "users-table";
const ddbMock = mockClient(DynamoDBDocumentClient);
const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: "ap-northeast-1" }),
);

beforeEach(() => {
  ddbMock.reset();
});

describe("createDynamoUserRepository", () => {
  test("upsert は sub と userName を PutItem で保存する", async () => {
    ddbMock.on(PutCommand).resolves({});
    const repo = createDynamoUserRepository(client, TABLE);
    await repo.upsert({ sub: "sub-1", userName: "花子" });
    const calls = ddbMock.commandCalls(PutCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input).toEqual({
      TableName: TABLE,
      Item: { sub: "sub-1", userName: "花子" },
    });
  });

  test("findUserName は登録済み sub の userName を返す", async () => {
    ddbMock.on(GetCommand).resolves({ Item: { userName: "花子" } });
    const repo = createDynamoUserRepository(client, TABLE);
    expect(await repo.findUserName("sub-1")).toBe("花子");
  });

  test("findUserName は未登録 sub（Item 無し）に null を返す", async () => {
    ddbMock.on(GetCommand).resolves({});
    const repo = createDynamoUserRepository(client, TABLE);
    expect(await repo.findUserName("missing")).toBeNull();
  });

  test("findUserName は ProjectionExpression を userName に絞って取得する", async () => {
    ddbMock.on(GetCommand).resolves({ Item: { userName: "花子" } });
    const repo = createDynamoUserRepository(client, TABLE);
    await repo.findUserName("sub-1");
    const calls = ddbMock.commandCalls(GetCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input).toEqual({
      TableName: TABLE,
      Key: { sub: "sub-1" },
      ProjectionExpression: "userName",
    });
  });
});
