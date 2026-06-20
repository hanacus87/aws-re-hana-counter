import type { BalanceRepository } from "../backend/lib/balance";
import type { UserRepository } from "../backend/lib/users";

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
  var NativeRequest: typeof Request;
  var NativeResponse: typeof Response;
  var NativeHeaders: typeof Headers;
}
