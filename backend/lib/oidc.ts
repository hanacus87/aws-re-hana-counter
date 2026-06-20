import { verifyWithJwks } from "hono/jwt";

export const GOOGLE_AUTH_ENDPOINT =
  "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
export const GOOGLE_JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";
export const GOOGLE_ISSUERS = [
  "https://accounts.google.com",
  "accounts.google.com",
];

export type VerifiedIdToken = {
  sub: string;
  name: string;
};

export async function verifyIdToken(
  idToken: string,
  options: { clientId: string; expectedNonce: string; nowSeconds: number },
): Promise<VerifiedIdToken> {
  const payload = await verifyWithJwks(idToken, {
    allowedAlgorithms: ["RS256"],
    jwks_uri: GOOGLE_JWKS_URI,
  });

  if (
    typeof payload.iss !== "string" ||
    !GOOGLE_ISSUERS.includes(payload.iss)
  ) {
    throw new Error("invalid issuer");
  }
  if (payload.aud !== options.clientId) {
    throw new Error("invalid audience");
  }
  if (payload.azp !== undefined && payload.azp !== options.clientId) {
    throw new Error("invalid authorized party");
  }
  if (typeof payload.exp !== "number" || options.nowSeconds >= payload.exp) {
    throw new Error("token expired");
  }
  if (payload.nonce !== options.expectedNonce) {
    throw new Error("nonce mismatch");
  }
  if (typeof payload.sub !== "string" || typeof payload.name !== "string") {
    throw new Error("missing required claims");
  }
  return { sub: payload.sub, name: payload.name };
}
