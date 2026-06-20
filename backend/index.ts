import { Hono, type Context } from "hono";
import { authRoutes } from "./routes/auth";
import { balanceRoutes } from "./routes/balance";
import { meRoutes } from "./routes/me";

async function serveApp(
  c: Context<{ Bindings: Env }>,
  status: number,
): Promise<Response> {
  const asset = await c.env.assets.fetch(new Request(new URL("/", c.req.url)));
  const headers = new Headers(asset.headers);
  if (status !== 200) {
    headers.delete("ETag");
    headers.delete("Last-Modified");
    headers.set("Cache-Control", "no-store");
  }
  return new Response(asset.body, { status, headers });
}

const app = new Hono<{ Bindings: Env }>();

app.route("/auth", authRoutes);
app.route("/api", meRoutes);
app.route("/api", balanceRoutes);

app.get("/", (c) => serveApp(c, 200));

app.get("/balance", (c) => serveApp(c, 200));

app.get("/login-error", (c) => serveApp(c, 403));

app.notFound((c) => serveApp(c, 404));

app.onError(async (_err, c) => {
  const pathname = new URL(c.req.url).pathname;
  if (pathname.startsWith("/api/") || pathname.startsWith("/auth/")) {
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    return await serveApp(c, 500);
  } catch {
    return new Response("<!doctype html><title>500</title>", {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
});

export default app;
