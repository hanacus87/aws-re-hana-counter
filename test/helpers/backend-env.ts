import {
  createMemoryBalanceRepository,
  createMemoryUserRepository,
} from "../../backend/lib/memory-repository";

export const TEST_ORIGIN = "http://localhost";
export const TEST_CLIENT_ID = "test-client-id";
const TEST_SESSION_SECRET = "session-secret";

export function createTestEnv() {
  const users = createMemoryUserRepository();
  const balances = createMemoryBalanceRepository();
  return {
    users,
    balances,
    env: {
      assets: { fetch: async () => new Response("<html>app</html>") },
      users,
      balances,
      PUBLIC_ORIGIN: TEST_ORIGIN,
      SESSION_SECRET: TEST_SESSION_SECRET,
      GOOGLE_CLIENT_ID: TEST_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: "client-secret",
      GOOGLE_REDIRECT_URI: `${TEST_ORIGIN}/auth/callback`,
    },
  };
}
