import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../src/services/mlClient.js", () => ({
  default: {
    post: vi.fn(),
  },
}));

vi.mock("../src/models/Dataset.js", () => ({
  default: {
    create: vi.fn(),
  },
}));

const { testConnector, importConnector } = await import(
  "../src/controllers/connectorController.js"
);
const mlClient = (await import("../src/services/mlClient.js")).default;
const Dataset = (await import("../src/models/Dataset.js")).default;

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("connectorController", () => {
  beforeEach(() => {
    mlClient.post.mockClear();
    Dataset.create.mockClear();
  });

  describe("testConnector", () => {
    it("forwards type/config to the ML service and returns its response as-is", async () => {
      mlClient.post.mockResolvedValue({
        data: { success: true, result: { success: true, resources: ["orders"] } },
      });

      const req = {
        userId: "user-1",
        body: {
          type: "mysql",
          config: { host: "db.internal", user: "root", password: "secret", database: "shop" },
        },
      };
      const res = mockRes();
      const next = vi.fn();

      await testConnector(req, res, next);

      expect(mlClient.post).toHaveBeenCalledWith("/connectors/test", {
        type: "mysql",
        config: req.body.config,
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        result: { success: true, resources: ["orders"] },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("redacts the axios error's request config before passing it to next()", async () => {
      const axiosError = new Error("Request failed with status code 400");
      axiosError.response = { status: 400, data: { detail: "Could not connect." } };
      axiosError.config = {
        data: JSON.stringify({
          type: "mysql",
          config: { password: "super-secret" },
        }),
      };
      axiosError.request = {};

      mlClient.post.mockRejectedValue(axiosError);

      const req = {
        userId: "user-1",
        body: { type: "mysql", config: { host: "db", user: "u", password: "super-secret", database: "d" } },
      };
      const res = mockRes();
      const next = vi.fn();

      await testConnector(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      const passedErr = next.mock.calls[0][0];
      expect(passedErr.config.data).not.toContain("super-secret");
      expect(JSON.stringify(passedErr)).not.toContain("super-secret");
    });
  });

  describe("importConnector", () => {
    it("creates a Dataset doc owned by req.userId with only safe source metadata", async () => {
      mlClient.post.mockResolvedValue({
        data: {
          success: true,
          result: {
            dataset_id: "ds-123",
            profile: { row_count: 10, column_count: 3 },
          },
        },
      });

      Dataset.create.mockResolvedValue({
        mlDatasetId: "ds-123",
        filename: "shop.orders",
        sourceType: "mysql",
      });

      const req = {
        userId: "user-42",
        body: {
          type: "mysql",
          config: {
            host: "db.internal",
            user: "root",
            password: "super-secret-password",
            database: "shop",
          },
          resource: "orders",
        },
      };
      const res = mockRes();
      const next = vi.fn();

      await importConnector(req, res, next);

      expect(Dataset.create).toHaveBeenCalledTimes(1);
      const createArgs = Dataset.create.mock.calls[0][0];

      expect(createArgs.owner).toBe("user-42");
      expect(createArgs.mlDatasetId).toBe("ds-123");
      expect(createArgs.sourceType).toBe("mysql");

      // Only safe fields persisted -- never the password.
      expect(createArgs.sourceMetadata).toEqual({
        host: "db.internal",
        database: "shop",
        table: "orders",
      });
      expect(JSON.stringify(createArgs)).not.toContain("super-secret-password");

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          dataset_id: "ds-123",
          source_type: "mysql",
        })
      );
    });

    it("never includes credentials in the response body", async () => {
      mlClient.post.mockResolvedValue({
        data: {
          success: true,
          result: { dataset_id: "ds-456", profile: { row_count: 5, column_count: 2 } },
        },
      });
      Dataset.create.mockResolvedValue({
        mlDatasetId: "ds-456",
        filename: "rest_response",
        sourceType: "rest",
      });

      const req = {
        userId: "user-1",
        body: {
          type: "rest",
          config: { url: "https://api.example.com/data", headers: { Authorization: "Bearer secret-token" } },
          resource: "response",
        },
      };
      const res = mockRes();
      const next = vi.fn();

      await importConnector(req, res, next);

      const responseBody = res.json.mock.calls[0][0];
      expect(JSON.stringify(responseBody)).not.toContain("secret-token");
    });

    it("derives a sensible filename for REST/Google Sheets imports", async () => {
      mlClient.post.mockResolvedValue({
        data: {
          success: true,
          result: { dataset_id: "ds-789", profile: { row_count: 1, column_count: 1 } },
        },
      });
      Dataset.create.mockResolvedValue({});

      const req = {
        userId: "user-1",
        body: {
          type: "google_sheets",
          config: { url: "https://docs.google.com/spreadsheets/d/abc/edit" },
          resource: "gid:0",
        },
      };
      const res = mockRes();
      const next = vi.fn();

      await importConnector(req, res, next);

      const createArgs = Dataset.create.mock.calls[0][0];
      expect(createArgs.filename).toContain("google_sheet");
    });
  });
});
