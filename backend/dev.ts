import { createLambdaApp } from "./lambda-app";
import {
  createMemoryBalanceRepository,
  createMemoryUserRepository,
} from "./lib/memory-repository";

const users = createMemoryUserRepository();
const balances = createMemoryBalanceRepository();

const devContainer: Env = {
  assets: {
    fetch: async () =>
      new Response('<!doctype html><div id="root"></div>', {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }),
  },
  users,
  balances,
  PUBLIC_ORIGIN: process.env.PUBLIC_ORIGIN ?? "http://localhost:5173",
  SESSION_SECRET: process.env.SESSION_SECRET ?? "dev-session-secret",
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? "",
  GOOGLE_REDIRECT_URI:
    process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:5173/auth/callback",
};

export default createLambdaApp({
  loadContainer: () => Promise.resolve(devContainer),
});
