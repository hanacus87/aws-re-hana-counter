import { type MiddlewareHandler } from "hono";
import { isSameOrigin } from "./security";

export const requireSameOrigin: MiddlewareHandler<{ Bindings: Env }> = async (
  c,
  next,
) => {
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    if (
      !isSameOrigin(
        c.env.PUBLIC_ORIGIN,
        c.req.header("Sec-Fetch-Site"),
        c.req.header("Origin"),
      )
    ) {
      return c.body(null, 403);
    }
  }
  await next();
};
