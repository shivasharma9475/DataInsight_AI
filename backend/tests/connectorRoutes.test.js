import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app.js";

describe("Connector routes security", () => {
  it("rejects /api/connectors/test without authentication", async () => {
    const response = await request(app)
      .post("/api/connectors/test")
      .send({ type: "rest", config: { url: "https://example.com" } });

    expect(response.status).toBe(401);
  });

  it("rejects /api/connectors/import without authentication", async () => {
    const response = await request(app)
      .post("/api/connectors/import")
      .send({ type: "rest", config: { url: "https://example.com" }, resource: "response" });

    expect(response.status).toBe(401);
  });
});
