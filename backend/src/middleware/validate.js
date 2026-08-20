export function validate(schema) {
  return (req, res, next) => {
    console.log("VALIDATION BODY:", req.body);

    const result = schema.safeParse(req.body);

    if (!result.success) {
      console.log("VALIDATION ERROR:", result.error.issues);

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

