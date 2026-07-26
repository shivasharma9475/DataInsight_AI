export function errorHandler(err, req, res, next) {
  console.error(err);
  const status = err.response?.status || err.status || 500;
  const detail =
    err.response?.data?.detail ||
    err.message ||
    "Internal server error";
  res.status(status).json({ detail });
}
