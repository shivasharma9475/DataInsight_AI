import { z } from "zod";

export const rootCauseSchema = z.object({
  dataset_id: z
    .string()
    .min(1, "dataset_id is required"),

  date_column: z
    .string()
    .min(1, "date_column is required"),

  metric_column: z
    .string()
    .min(1, "metric_column is required"),

  dimension_columns: z
    .array(z.string().min(1))
    .max(10, "Maximum 10 dimensions are allowed")
    .default([]),

  period: z
    .enum(["D", "W", "M", "Q", "Y"])
    .default("M"),

  comparison_mode: z
    .enum(["full", "comparable"])
    .default("full"),
});

export const copilotQuerySchema = z.object({
  dataset_id: z
    .string()
    .min(1, "dataset_id is required"),

  tool: z.enum([
    "dataset_summary",
    "aggregate",
    "group_by",
    "trend",
    "root_cause",
  ]),

  arguments: z
    .record(z.any())
    .default({}),
});