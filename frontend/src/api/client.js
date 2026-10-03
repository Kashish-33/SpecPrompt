const API_ORIGIN = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const API_BASE = `${API_ORIGIN}/api/v1`;

export class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function request(path, options = {}) {
  const { method = "GET", body, headers, timeoutMs = 60000 } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    if (response.status === 204) {
      return null;
    }

    const text = await response.text();
    let data = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }

    if (!response.ok) {
      const detail =
        (data && (data.detail || data.message)) ||
        `Request failed with status ${response.status}`;
      throw new ApiError(String(detail), response.status, data);
    }

    return data;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error.name === "AbortError") {
      throw new ApiError("The request timed out. Is the backend still running?", 408);
    }
    throw new ApiError(
      "Cannot reach the SpecPrompt API. Start the backend on http://localhost:8000.",
      0,
    );
  } finally {
    clearTimeout(timer);
  }
}

export async function getHealth() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(`${API_ORIGIN}/health`, { signal: controller.signal });
    if (!response.ok) {
      return false;
    }
    const data = await response.json();
    return data?.status === "ok";
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function getMetrics() {
  return request("/metrics/overview");
}

export function getSuites() {
  return request("/suites/");
}

export function getSuite(id) {
  return request(`/suites/${id}`);
}

export function createSuite(data) {
  return request("/suites/", { method: "POST", body: data });
}

export function updateSuite(id, data) {
  return request(`/suites/${id}`, { method: "PUT", body: data });
}

export function deleteSuite(id) {
  return request(`/suites/${id}`, { method: "DELETE" });
}

export function addTestCase(suiteId, data) {
  return request(`/suites/${suiteId}/cases`, { method: "POST", body: data });
}

export function deleteTestCase(suiteId, caseId) {
  return request(`/suites/${suiteId}/cases/${caseId}`, { method: "DELETE" });
}

export function executeRun(suiteId, options = {}) {
  return request(
    "/runs/execute",
    {
      method: "POST",
      body: {
        suite_id: suiteId,
        ...options,
      },
      timeoutMs: 120000,
    },
  );
}

export function getRunDetails(runId) {
  return request(`/runs/${runId}`);
}

export function getSuiteRuns(suiteId) {
  return request(`/runs/suite/${suiteId}`);
}
