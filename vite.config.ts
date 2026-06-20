import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import devServer from "@hono/vite-dev-server";

// /api/* と /auth/* のみ Hono(dev) が処理し、HTML・HMR・アセットは Vite が配信する
export default defineConfig({
  plugins: [
    react(),
    devServer({
      entry: "backend/dev.ts",
      exclude: [/^\/(?!api\/|auth\/).*/],
    }),
  ],
  build: { outDir: "dist/client" },
});
