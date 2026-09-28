import type { ApiErrorResponse } from "share";

export type ApiErrorStatus = 400 | 401 | 403 | 404 | 409 | 429 | 502 | 503;

export class ApiError extends Error {
  readonly code: ApiErrorResponse["code"];
  readonly status: ApiErrorStatus;
  readonly retryable: boolean;

  constructor(
    status: ApiErrorStatus,
    body: Pick<ApiErrorResponse, "code" | "message"> & Partial<Pick<ApiErrorResponse, "retryable">>,
  ) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.code;
    this.retryable = body.retryable ?? (status === 429 || status >= 500);
  }

  toResponse(): ApiErrorResponse {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
    };
  }
}
