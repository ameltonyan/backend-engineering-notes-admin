import { readCredentials } from "../features/auth/authStorage";

type ApiErrorPayload = { message?: string; detail?: string };

export class ApiRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

const apiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:8080"
).replace(/\/$/, "");

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  credentials = readCredentials(),
  timeoutMs?: number,
): Promise<T> {
  let response: Response;
  const controller = timeoutMs ? new AbortController() : undefined;
  const timeoutId = timeoutMs
    ? window.setTimeout(() => controller?.abort(), timeoutMs)
    : undefined;

  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...options,
      ...(controller ? { signal: controller.signal } : {}),
      headers: {
        "Content-Type": "application/json",
        ...(credentials ? { Authorization: `Basic ${credentials}` } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiRequestError(
        "The AI request took too long to respond. Try again or choose a lower reasoning effort.",
        408,
      );
    }
    throw new ApiRequestError(
      "The API is unavailable. Check that the backend is running and try again.",
      0,
    );
  } finally {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new ApiRequestError("Invalid admin username or password.", 401);
    }
    if (response.status === 403) {
      throw new ApiRequestError("You do not have permission to perform this action.", 403);
    }
    const body = await response.text();
    let message = body;
    try {
      const parsed = JSON.parse(body) as ApiErrorPayload;
      message = parsed.message || parsed.detail || body;
    } catch {
      // Keep the plain response when the API does not return JSON.
    }
    if (response.status === 409 && !message) {
      message = "This content has changed. Reload and try again.";
    }
    throw new ApiRequestError(message || `Request failed (${response.status})`, response.status);
  }

  return (response.status === 204 ? null : response.json()) as Promise<T>;
}
