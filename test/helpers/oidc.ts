import { sign } from "hono/jwt";
import {
  GOOGLE_ISSUERS,
  GOOGLE_JWKS_URI,
  GOOGLE_TOKEN_ENDPOINT,
} from "../../backend/lib/oidc";

type SignedJwk = JsonWebKey & { kid: string };

export type OidcKeys = {
  privateJwk: SignedJwk;
  jwks: { keys: SignedJwk[] };
};

export async function createOidcKeys(kid = "test-kid-1"): Promise<OidcKeys> {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  );
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return {
    privateJwk: { ...privateJwk, kid, alg: "RS256" },
    jwks: { keys: [{ ...publicJwk, kid, alg: "RS256", use: "sig" }] },
  };
}

export function idTokenClaims(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const now = Math.floor(Date.now() / 1000);
  return {
    iss: GOOGLE_ISSUERS[0],
    aud: "test-client-id",
    azp: "test-client-id",
    sub: "google-sub-1",
    name: "花子",
    nonce: "test-nonce",
    iat: now,
    exp: now + 3600,
    ...overrides,
  };
}

export async function mintIdToken(
  keys: OidcKeys,
  claims: Record<string, unknown>,
): Promise<string> {
  return sign(claims, keys.privateJwk, "RS256");
}

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
}

export function googleFetchStub(keys: OidcKeys, idToken: string): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url === GOOGLE_TOKEN_ENDPOINT) {
      return jsonResponse({ id_token: idToken });
    }
    if (url === GOOGLE_JWKS_URI) {
      return jsonResponse(keys.jwks);
    }
    throw new Error(`unexpected fetch: ${url}`);
  }) as typeof fetch;
}
