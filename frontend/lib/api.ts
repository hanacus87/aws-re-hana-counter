import { contentSha256 } from "./content-hash";

export async function mutate(
  path: string,
  method: string,
  body?: string,
): Promise<Response> {
  const headers: Record<string, string> = {
    "x-amz-content-sha256": await contentSha256(body ?? ""),
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  return fetch(path, { method, headers, body });
}
