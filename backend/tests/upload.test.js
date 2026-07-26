import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app.js";

describe("Dataset upload security", () => {
  it("rejects upload without authentication", async () => {
    const response = await request(app)
      .post("/api/datasets/upload")
      .attach(
        "file",
        Buffer.from("name,sales\nA,100"),
        "sales.csv"
      );

    expect(response.status).toBe(401);
  });
});