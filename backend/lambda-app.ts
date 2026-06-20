import { Hono, type MiddlewareHandler } from "hono";
import app from "./index";

export function createLambdaApp(options: {
  loadContainer: () => Promise<Env>;
  staticMiddleware?: MiddlewareHandler<{ Bindings: Env }>;
}): Hono<{ Bindings: Env }> {
  const root = new Hono<{ Bindings: Env }>();

  if (options.staticMiddleware) {
    root.use("*", options.staticMiddleware);
  }

  root.use("*", async (c, next) => {
    Object.assign(c.env, await options.loadContainer());
    await next();
  });

  root.onError((_err, c) => {
    c.header("Cache-Control", "no-store");
    return c.json({ error: "internal_error" }, 500);
  });

  root.route("/", app);

  return root;
}
