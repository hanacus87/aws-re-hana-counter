import { Hono } from "hono";
import { sessionSub } from "../lib/request-auth";

export const meRoutes = new Hono<{ Bindings: Env }>();

meRoutes.get("/me", async (c) => {
  c.header("Cache-Control", "no-store");
  const sub = await sessionSub(c);
  if (!sub) {
    return c.body(null, 401);
  }
  try {
    const userName = await c.env.users.findUserName(sub);
    if (!userName) {
      return c.body(null, 401);
    }
    return c.json({ userName });
  } catch {
    return c.body(null, 401);
  }
});
