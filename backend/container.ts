import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { SSMClient } from "@aws-sdk/client-ssm";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { loadConfig } from "./lib/config";
import { createDynamoBalanceRepository } from "./lib/dynamo-balance-repository";
import { createDynamoUserRepository } from "./lib/dynamo-user-repository";
import { createSecretLoader } from "./lib/secrets";

export async function createContainer(
  env: Record<string, string | undefined>,
  staticDir: string,
): Promise<Env> {
  const config = loadConfig(env);
  const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  const getSecret = createSecretLoader(new SSMClient({}));
  const [sessionSecret, googleClientSecret] = await Promise.all([
    getSecret(config.sessionSecretParam),
    getSecret(config.googleClientSecretParam),
  ]);
  const indexHtml = new Uint8Array(
    await readFile(join(staticDir, "index.html")),
  );
  return {
    assets: {
      fetch: async () =>
        new Response(indexHtml, {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }),
    },
    users: createDynamoUserRepository(documentClient, config.usersTable),
    balances: createDynamoBalanceRepository(
      documentClient,
      config.balancesTable,
    ),
    PUBLIC_ORIGIN: config.publicOrigin,
    SESSION_SECRET: sessionSecret,
    GOOGLE_CLIENT_ID: config.googleClientId,
    GOOGLE_CLIENT_SECRET: googleClientSecret,
    GOOGLE_REDIRECT_URI: config.googleRedirectUri,
  };
}
