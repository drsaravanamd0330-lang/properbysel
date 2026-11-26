export class HttpError extends Error {
  constructor(public statusCode: number, public code: string, message: string, public details?: unknown) { super(message); }
}
export const notFound = (what = "Resource") => new HttpError(404, "NOT_FOUND", `${what} not found`);
export const forbidden = (msg = "You do not have permission to do this") => new HttpError(403, "FORBIDDEN", msg);
export const conflict = (msg: string) => new HttpError(409, "CONFLICT", msg);
export const unauthorized = (msg = "Please sign in") => new HttpError(401, "UNAUTHORIZED", msg);
