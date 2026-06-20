import {
  DeleteCommand,
  PutCommand,
  QueryCommand,
  type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import type { BalanceRecord, BalanceRepository } from "./balance";

export function createDynamoBalanceRepository(
  client: DynamoDBDocumentClient,
  tableName: string,
): BalanceRepository {
  return {
    async list(sub: string): Promise<BalanceRecord[]> {
      const records: BalanceRecord[] = [];
      let exclusiveStartKey: Record<string, unknown> | undefined;
      do {
        const result = await client.send(
          new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: "#sub = :sub",
            ExpressionAttributeNames: { "#sub": "sub", "#date": "date" },
            ExpressionAttributeValues: { ":sub": sub },
            ProjectionExpression: "#date, bet, recovery",
            ExclusiveStartKey: exclusiveStartKey,
          }),
        );
        for (const item of result.Items ?? []) {
          records.push({
            date: item.date as string,
            bet: item.bet as number,
            recovery: item.recovery as number,
          });
        }
        exclusiveStartKey = result.LastEvaluatedKey;
      } while (exclusiveStartKey);
      return records;
    },
    async upsert(sub: string, record: BalanceRecord): Promise<void> {
      await client.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            sub,
            date: record.date,
            bet: record.bet,
            recovery: record.recovery,
          },
        }),
      );
    },
    async remove(sub: string, date: string): Promise<void> {
      await client.send(
        new DeleteCommand({ TableName: tableName, Key: { sub, date } }),
      );
    },
  };
}
