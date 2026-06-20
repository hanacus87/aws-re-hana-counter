export type Config = {
  publicOrigin: string;
  googleClientId: string;
  googleRedirectUri: string;
  usersTable: string;
  balancesTable: string;
  sessionSecretParam: string;
  googleClientSecretParam: string;
};

const REQUIRED = [
  "PUBLIC_ORIGIN",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_REDIRECT_URI",
  "USERS_TABLE",
  "BALANCES_TABLE",
  "SESSION_SECRET_PARAM",
  "GOOGLE_CLIENT_SECRET_PARAM",
] as const;

export function loadConfig(env: Record<string, string | undefined>): Config {
  for (const key of REQUIRED) {
    if (!env[key]) {
      throw new Error(`missing required environment variable: ${key}`);
    }
  }
  return {
    publicOrigin: env.PUBLIC_ORIGIN as string,
    googleClientId: env.GOOGLE_CLIENT_ID as string,
    googleRedirectUri: env.GOOGLE_REDIRECT_URI as string,
    usersTable: env.USERS_TABLE as string,
    balancesTable: env.BALANCES_TABLE as string,
    sessionSecretParam: env.SESSION_SECRET_PARAM as string,
    googleClientSecretParam: env.GOOGLE_CLIENT_SECRET_PARAM as string,
  };
}
