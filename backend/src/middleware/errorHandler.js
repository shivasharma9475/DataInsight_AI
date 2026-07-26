export function errorHandler(err, req, res, next) {
  // Log the real error on the server for debugging
  console.error(err);

  // Determine HTTP status code
  const status = err.response?.status || err.status || 500;

  // Get message from known errors
  const originalMessage =
    err.response?.data?.detail ||
    err.message ||
    "Something went wrong";

  // Never expose internal error details for server errors
  const detail =
    status >= 500
      ? "Internal server error"
      : originalMessage;

  return res.status(status).json({ detail });
}