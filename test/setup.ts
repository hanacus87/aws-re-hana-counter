import { GlobalRegistrator } from "@happy-dom/global-registrator";

globalThis.NativeRequest = globalThis.Request;
globalThis.NativeResponse = globalThis.Response;
globalThis.NativeHeaders = globalThis.Headers;

GlobalRegistrator.register({ url: "http://localhost/" });

const { cleanup } = await import("@testing-library/react");
const { afterEach } = await import("bun:test");

afterEach(() => {
  cleanup();
});
