import { GetParameterCommand, type SSMClient } from "@aws-sdk/client-ssm";

export function createSecretLoader(
  client: SSMClient,
): (name: string) => Promise<string> {
  const cache = new Map<string, string>();
  return async function getSecret(name: string): Promise<string> {
    const cached = cache.get(name);
    if (cached !== undefined) {
      return cached;
    }
    const result = await client.send(
      new GetParameterCommand({ Name: name, WithDecryption: true }),
    );
    const value = result.Parameter?.Value;
    if (value === undefined) {
      throw new Error(`secret not found: ${name}`);
    }
    cache.set(name, value);
    return value;
  };
}
