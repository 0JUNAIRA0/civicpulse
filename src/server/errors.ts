export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string = "ERROR",
    public details?: unknown,
  ) {
    super(message);
  }
}

export const unauthorized = (msg = "Please sign in to continue") => new AppError(401, msg, "UNAUTHORIZED");
export const forbidden = (msg = "You do not have permission to do that") => new AppError(403, msg, "FORBIDDEN");
export const notFound = (msg = "Not found") => new AppError(404, msg, "NOT_FOUND");
export const badRequest = (msg: string, details?: unknown) => new AppError(400, msg, "BAD_REQUEST", details);
export const conflict = (msg: string) => new AppError(409, msg, "CONFLICT");
