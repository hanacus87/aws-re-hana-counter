import { afterAll, beforeAll } from "bun:test";

export function applyNativeRequest(): void {
  const browserRequest = globalThis.Request;
  const browserResponse = globalThis.Response;
  const browserHeaders = globalThis.Headers;
  beforeAll(() => {
    globalThis.Request = globalThis.NativeRequest;
    globalThis.Response = globalThis.NativeResponse;
    globalThis.Headers = globalThis.NativeHeaders;
  });
  afterAll(() => {
    globalThis.Request = browserRequest;
    globalThis.Response = browserResponse;
    globalThis.Headers = browserHeaders;
  });
}
