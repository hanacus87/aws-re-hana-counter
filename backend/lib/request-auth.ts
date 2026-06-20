import { type Context } from "hono";
import { getCookie } from "hono/cookie";
import { SESSION_COOKIE, verifySession } from "./session";
import { nowSeconds } from "./time";

export async function sessionSub(
  c: Context<{ Bindings: Env }>,
): Promise<string | null> {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) {
    return null;
  }
  try {
    const { sub } = await verifySession(
      token,
      c.env.SESSION_SECRET,
      nowSeconds(),
    );
    return sub;
  } catch {
    return null;
  }
}
