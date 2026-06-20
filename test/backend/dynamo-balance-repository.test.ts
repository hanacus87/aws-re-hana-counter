/**
 * DynamoDB の BalanceRepository 実装の仕様
 *
 * balances テーブルは PK=sub・SK=date。1日1件を Put で上書きする。
 * 取得は Query（SK=date 昇順）で行い、ProjectionExpression で date・bet・recovery
 * のみに絞る。DynamoDB の予約語 sub・date は式の属性名（#sub・#date）で参照する。
 * 1MB を超える結果は LastEvaluatedKey を辿って全件返す。
 * `@aws-sdk/lib-dynamodb` の DocumentClient を注入し、aws-sdk-client-mock で固定する。
 */
import { beforeEach, describe, expect, test } from "bun:test";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { createDynamoBalanceRepository } from "../../backend/lib/dynamo-balance-repository";

const TABLE = "balances-table";
const ddbMock = mockClient(DynamoDBDocumentClient);
const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: "ap-northeast-1" }),
);

beforeEach(() => {
  ddbMock.reset();
});

describe("createDynamoBalanceRepository", () => {
  test("upsert は sub・date・bet・recovery を PutItem で保存する", async () => {
    ddbMock.on(PutCommand).resolves({});
    const repo = createDynamoBalanceRepository(client, TABLE);
    await repo.upsert("sub-1", {
      date: "2026-06-03",
      bet: 1000,
      recovery: 3000,
    });
    const calls = ddbMock.commandCalls(PutCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input).toEqual({
      TableName: TABLE,
      Item: { sub: "sub-1", date: "2026-06-03", bet: 1000, recovery: 3000 },
    });
  });

  test("list は Query 結果を date・bet・recovery の形に整えて返す", async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        { date: "2026-06-01", bet: 1, recovery: 2 },
        { date: "2026-06-05", bet: 3, recovery: 4 },
      ],
    });
    const repo = createDynamoBalanceRepository(client, TABLE);
    expect(await repo.list("sub-1")).toEqual([
      { date: "2026-06-01", bet: 1, recovery: 2 },
      { date: "2026-06-05", bet: 3, recovery: 4 },
    ]);
  });

  test("list は予約語 sub・date を式の属性名で参照し ProjectionExpression で属性を絞る", async () => {
    ddbMock.on(QueryCommand).resolves({ Items: [] });
    const repo = createDynamoBalanceRepository(client, TABLE);
    await repo.list("sub-1");
    const calls = ddbMock.commandCalls(QueryCommand);
    expect(calls).toHaveLength(1);
    const input = calls[0].args[0].input;
    expect(input.TableName).toBe(TABLE);
    expect(input.KeyConditionExpression).toBe("#sub = :sub");
    expect(input.ExpressionAttributeNames).toEqual({
      "#sub": "sub",
      "#date": "date",
    });
    expect(input.ExpressionAttributeValues).toEqual({ ":sub": "sub-1" });
    expect(input.ProjectionExpression).toBe("#date, bet, recovery");
  });

  test("list は LastEvaluatedKey を辿って複数ページを全件返す", async () => {
    ddbMock
      .on(QueryCommand)
      .resolvesOnce({
        Items: [{ date: "2026-06-01", bet: 1, recovery: 2 }],
        LastEvaluatedKey: { sub: "sub-1", date: "2026-06-01" },
      })
      .resolves({
        Items: [{ date: "2026-06-02", bet: 3, recovery: 4 }],
      });
    const repo = createDynamoBalanceRepository(client, TABLE);
    const records = await repo.list("sub-1");
    expect(records).toEqual([
      { date: "2026-06-01", bet: 1, recovery: 2 },
      { date: "2026-06-02", bet: 3, recovery: 4 },
    ]);
    expect(ddbMock.commandCalls(QueryCommand)).toHaveLength(2);
  });

  test("remove は sub と date の Key で DeleteItem する", async () => {
    ddbMock.on(DeleteCommand).resolves({});
    const repo = createDynamoBalanceRepository(client, TABLE);
    await repo.remove("sub-1", "2026-06-03");
    const calls = ddbMock.commandCalls(DeleteCommand);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0].input).toEqual({
      TableName: TABLE,
      Key: { sub: "sub-1", date: "2026-06-03" },
    });
  });
});
