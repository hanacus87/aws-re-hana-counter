import type { BalanceRepository } from "./lib/balance";
import type { UserRepository } from "./lib/users";

declare global {
  interface Env {
    assets: { fetch(request: Request): Promise<Response> };
    users: UserRepository;
    balances: BalanceRepository;
    PUBLIC_ORIGIN: string;
    SESSION_SECRET: string;
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    GOOGLE_REDIRECT_URI: string;
  }
}
