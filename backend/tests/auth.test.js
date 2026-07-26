import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../src/app.js";

describe("Auth validation", () => {
  it("rejects signup with invalid email", async () => {
    const response = await request(app)
      .post("/api/auth/signup")
      .send({
        name: "Test User",
        email: "wrong-email",
        password: "Password123",
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("detail");
  });

  it("rejects signup with short password", async () => {
    const response = await request(app)
      .post("/api/auth/signup")
      .send({
        name: "Test User",
        email: "test@example.com",
        password: "123",
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("detail");
  });

  it("rejects signup when password is missing", async () => {
    const response = await request(app)
      .post("/api/auth/signup")
      .send({
        name: "Test User",
        email: "test@example.com",
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("detail");
  });

  it("rejects login with invalid email", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "invalid-email",
        password: "Password123",
      });

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty("detail");
  });
});

describe("Authentication protection", () => {
  it("rejects protected route without JWT", async () => {
    const response = await request(app)
      .get("/api/datasets/history");

    expect(response.status).toBe(401);
  });
});