export type ApiError = {
  error_code?: string;
  message?: string;
  field_errors?: { field: string; reason: string }[];
};

export async function postJson<T>(
  url: string,
  payload: unknown,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as ApiError;
    const error = new Error(data.message || "Request failed") as Error & ApiError;
    (error as Error & { status?: number }).status = response.status;
    error.error_code = data.error_code;
    error.message = data.message || error.message;
    error.field_errors = data.field_errors || [];
    throw error;
  }

  return (await response.json()) as T;
}