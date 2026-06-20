import { sign, verify } from "hono/jwt";

export const SESSION_COOKIE = "__Host-session";

const ONE_DAY_SECONDS = 24 * 60 * 60;

export type SessionClaims = {
  sub: string;
};

export async function signSession(
  claims: SessionClaims,
  secret: string,
  nowSeconds: number,
): Promise<string> {
  return sign(
    { sub: claims.sub, iat: nowSeconds, exp: nowSeconds + ONE_DAY_SECONDS },
    secret,
  );
}

export async function verifySession(
  token: string,
  secret: string,
  nowSeconds: number,
): Promise<SessionClaims> {
  const payload = await verify(token, secret, "HS256");
  if (typeof payload.exp !== "number") {
    throw new Error("session token has no expiry");
  }
  if (nowSeconds >= payload.exp) {
    throw new Error("session token expired");
  }
  if (typeof payload.sub !== "string") {
    throw new Error("session token has no subject");
  }
  return { sub: payload.sub };
}
