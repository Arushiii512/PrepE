import axios from "axios";

/**
 * Central Axios client for the PrepE FastAPI backend.
 *
 * Configuration comes from the frontend `.env` file (Vite exposes only variables
 * prefixed with VITE_). No secrets live here: the Gemini key stays on the server.
 */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
export const API_V1 = import.meta.env.VITE_API_V1_STR || "/api/v1";

export const api = axios.create({
  baseURL: `${API_BASE_URL}${API_V1}`,
  timeout: 60_000,
  headers: { Accept: "application/json" },
});

/** Error with a user-presentable message plus a machine-readable kind. */
export class ApiError extends Error {
  constructor(message, { kind = "unknown", status = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.kind = kind; // "network" | "timeout" | "http" | "cancelled" | "unknown"
    this.status = status;
  }
}

// FastAPI returns `detail` as a string (HTTPException) or a list (422 validation).
function extractDetail(data) {
  const detail = data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d) => {
        const field = Array.isArray(d?.loc) ? d.loc.filter((p) => p !== "body").join(".") : "";
        return field ? `${field}: ${d?.msg}` : d?.msg;
      })
      .filter(Boolean)
      .join("; ");
  }
  return null;
}

export function toApiError(err) {
  if (err instanceof ApiError) return err;
  if (axios.isCancel(err)) return new ApiError("Request cancelled.", { kind: "cancelled" });

  if (err?.response) {
    const { status, data } = err.response;
    const detail = extractDetail(data);
    return new ApiError(detail || `The server responded with an error (${status}).`, { kind: "http", status });
  }
  if (err?.code === "ECONNABORTED" || err?.code === "ETIMEDOUT") {
    return new ApiError("The request took too long. The server may still be working. Try again in a moment.", {
      kind: "timeout",
    });
  }
  if (err?.request) {
    return new ApiError(
      `Can't reach the PrepE backend at ${API_BASE_URL}. Start it with "uvicorn app.main:app --reload" and try again.`,
      { kind: "network" }
    );
  }
  return new ApiError(err?.message || "Something went wrong.", { kind: "unknown" });
}

api.interceptors.response.use(
  (res) => res,
  (err) => Promise.reject(toApiError(err))
);

export const getErrorMessage = (err) => toApiError(err).message;

/** Backend liveness (GET /health lives outside the /api/v1 prefix). */
export async function checkHealth(signal) {
  try {
    const res = await axios.get(`${API_BASE_URL}/health`, { timeout: 4000, signal });
    return res.status === 200 && res.data?.status === "healthy";
  } catch {
    return false;
  }
}
