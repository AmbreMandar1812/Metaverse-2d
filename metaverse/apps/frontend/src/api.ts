import type { Element, Space, SpaceDetails } from "./types";

const API_BASE = import.meta.env.VITE_API_URL || "/api/v1";

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: { token?: string; method?: string; body?: unknown } = {},
): Promise<T> {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const payload: { message?: string } = await response.json();
      if (payload.message) message = payload.message;
    } catch {
      // Some server errors do not include a JSON response body.
    }
    throw new ApiError(message, response.status);
  }
  return response.json() as Promise<T>;
}

export function signIn(body: { username: string; password: string }) {
  return request<{ token: string }>("/signin", { method: "POST", body });
}

export function signUp(body: { username: string; password: string; type: "user" }) {
  return request<{ userId: string }>("/signup", { method: "POST", body });
}

export async function getSpaces(token: string) {
  const result = await request<{ spaces: Space[] }>("/space/all", { token });
  return result.spaces;
}

export async function getElements() {
  const result = await request<{ elements: Element[] }>("/elements");
  return result.elements;
}

export function createSpace(token: string, body: { name: string; dimensions: string }) {
  return request<{ spaceId: string }>("/space", { method: "POST", token, body });
}

export function deleteSpace(token: string, spaceId: string) {
  return request<{ message: string }>(`/space/${encodeURIComponent(spaceId)}`, {
    method: "DELETE",
    token,
  });
}

export function getSpace(token: string, spaceId: string) {
  return request<SpaceDetails>(`/space/${encodeURIComponent(spaceId)}`, { token });
}

export function addSpaceElement(
  token: string,
  body: { spaceId: string; elementId: string; x: number; y: number },
) {
  return request<{ message: string }>("/space/element", { method: "POST", token, body });
}
