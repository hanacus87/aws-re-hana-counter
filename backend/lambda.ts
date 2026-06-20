import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { handle } from "hono/aws-lambda";
import { serveStatic } from "hono/serve-static";
import { createContainer } from "./container";
import { createLambdaApp } from "./lambda-app";

const staticDir = process.env.STATIC_DIR ?? "dist/client";

let container: Promise<Env> | undefined;
function loadContainer(): Promise<Env> {
  return (container ??= createContainer(process.env, staticDir));
}

function isBinaryContentType(contentType: string): boolean {
  return (
    /^(?:font|image|audio|video)\//.test(contentType) ||
    contentType === "application/octet-stream" ||
    contentType === "application/wasm"
  );
}

const root = createLambdaApp({
  loadContainer,
  staticMiddleware: serveStatic({
    root: staticDir,
    join,
    getContent: async (path) => {
      try {
        return new Uint8Array(await readFile(path));
      } catch {
        return null;
      }
    },
  }),
});

export const handler = handle(root, {
  isContentTypeBinary: isBinaryContentType,
});
