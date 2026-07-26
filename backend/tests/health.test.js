import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app.js";

describe("Health API", () => {
  it("returns API health status", async () => {
    const response = await request(app)
      .get("/api/health");

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      status: "ok",
    });
  });
});

it("adds security headers", async () => {
  const response = await request(app)
    .get("/api/health");

  expect(
    response.headers["x-content-type-options"]
  ).toBe("nosniff");
});