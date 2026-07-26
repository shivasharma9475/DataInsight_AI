export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const message = result.error.issues
        .map((issue) => issue.message)
        .join(", ");

      return res.status(400).json({
        detail: message,
      });
    }

    req.body = result.data;
    next();
  };
}