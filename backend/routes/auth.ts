import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { requireSameOrigin } from "../lib/csrf";
import {
  buildAuthorizationUrl,
  createPkce,
  exchangeCodeForIdToken,
  randomToken,
} from "../lib/oauth";
import { verifyIdToken } from "../lib/oidc";
import { SESSION_COOKIE, signSession } from "../lib/session";
import { nowSeconds } from "../lib/time";
import { sanitizeUserName } from "../lib/users";

const STATE_COOKIE = "__Host-oauth_state";
const NONCE_COOKIE = "__Host-oauth_nonce";
const VERIFIER_COOKIE = "__Host-oauth_verifier";
const TEMP_COOKIE_MAX_AGE = 600;

const tempCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "Lax",
  path: "/",
  maxAge: TEMP_COOKIE_MAX_AGE,
} as const;

const sessionCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "Lax",
  path: "/",
} as const;

export const authRoutes = new Hono<{ Bindings: Env }>();

authRoutes.use("/logout", requireSameOrigin);

authRoutes.get("/login", async (c) => {
  const { verifier, challenge } = await createPkce();
  const state = randomToken();
  const nonce = randomToken();
  setCookie(c, STATE_COOKIE, state, tempCookieOptions);
  setCookie(c, NONCE_COOKIE, nonce, tempCookieOptions);
  setCookie(c, VERIFIER_COOKIE, verifier, tempCookieOptions);
  return c.redirect(
    buildAuthorizationUrl({
      clientId: c.env.GOOGLE_CLIENT_ID,
      redirectUri: c.env.GOOGLE_REDIRECT_URI,
      state,
      nonce,
      codeChallenge: challenge,
    }),
    302,
  );
});

authRoutes.get("/callback", async (c) => {
  const state = getCookie(c, STATE_COOKIE);
  const nonce = getCookie(c, NONCE_COOKIE);
  const verifier = getCookie(c, VERIFIER_COOKIE);
  const clearTempCookies = () => {
    deleteCookie(c, STATE_COOKIE, { path: "/", secure: true });
    deleteCookie(c, NONCE_COOKIE, { path: "/", secure: true });
    deleteCookie(c, VERIFIER_COOKIE, { path: "/", secure: true });
  };

  try {
    const code = c.req.query("code");
    if (!state || !nonce || !verifier || !code) {
      throw new Error("missing authorization context");
    }
    if (c.req.query("state") !== state) {
      throw new Error("state mismatch");
    }
    const idToken = await exchangeCodeForIdToken({
      code,
      codeVerifier: verifier,
      clientId: c.env.GOOGLE_CLIENT_ID,
      clientSecret: c.env.GOOGLE_CLIENT_SECRET,
      redirectUri: c.env.GOOGLE_REDIRECT_URI,
    });
    const claims = await verifyIdToken(idToken, {
      clientId: c.env.GOOGLE_CLIENT_ID,
      expectedNonce: nonce,
      nowSeconds: nowSeconds(),
    });
    await c.env.users.upsert({
      sub: claims.sub,
      userName: sanitizeUserName(claims.name),
    });
    const session = await signSession(
      { sub: claims.sub },
      c.env.SESSION_SECRET,
      nowSeconds(),
    );
    setCookie(c, SESSION_COOKIE, session, sessionCookieOptions);
    clearTempCookies();
    return c.redirect("/", 302);
  } catch {
    clearTempCookies();
    return c.redirect("/login-error", 302);
  }
});

authRoutes.post("/logout", (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: "/", secure: true });
  return c.body(null, 204);
});
