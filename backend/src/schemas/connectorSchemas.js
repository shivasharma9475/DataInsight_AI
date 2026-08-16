import { z } from "zod";

// Per-connector-type config shape. Kept intentionally permissive on
// exact fields (FastAPI/the connector classes do the authoritative
// validation) -- this layer's job is basic shape/type safety plus a
// hard ceiling on payload size before it's forwarded to the ML service.
const connectorType = z.enum([
  "rest",
  "mysql",
  "postgres",
  "google_sheets",
]);

const configSchema = z
  .record(z.any())
  .refine(
    (config) => JSON.stringify(config ?? {}).length <= 20_000,
    "config is too large"
  );

export const connectorTestSchema = z.object({
  type: connectorType,

  config: configSchema.default({}),
});

export const connectorImportSchema = z.object({
  type: connectorType,

  config: configSchema.default({}),

  resource: z
    .string()
    .min(1, "resource is required")
    .max(200, "resource name is too long"),

  limit: z
    .number()
    .int()
    .min(1)
    .max(200_000)
    .optional(),
});
