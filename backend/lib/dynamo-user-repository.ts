import {
  GetCommand,
  PutCommand,
  type DynamoDBDocumentClient,
} from "@aws-sdk/lib-dynamodb";
import type { UserRecord, UserRepository } from "./users";

export function createDynamoUserRepository(
  client: DynamoDBDocumentClient,
  tableName: string,
): UserRepository {
  return {
    async upsert(user: UserRecord): Promise<void> {
      await client.send(
        new PutCommand({
          TableName: tableName,
          Item: { sub: user.sub, userName: user.userName },
        }),
      );
    },
    async findUserName(sub: string): Promise<string | null> {
      const result = await client.send(
        new GetCommand({
          TableName: tableName,
          Key: { sub },
          ProjectionExpression: "userName",
        }),
      );
      const userName = result.Item?.userName;
      return typeof userName === "string" ? userName : null;
    },
  };
}
