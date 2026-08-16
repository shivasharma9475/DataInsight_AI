import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock dataset ownership (no MongoDB needed for this unit test) and the
// ML-service client, so we can assert exactly what payload the controller
// forwards to FastAPI for each mode.
vi.mock("../src/services/mlClient.js", () => ({
  default: {
    post: vi.fn().mockResolvedValue({
      data: { success: true, result: { engine: "deterministic_v1" } },
    }),
  },
}));

vi.mock("../src/controllers/datasetController.js", () => ({
  getOwnedDataset: vi.fn().mockResolvedValue({ mlDatasetId: "ds-1" }),
}));

const { whatIf } = await import("../src/controllers/whatIfController.js");
const mlClient = (await import("../src/services/mlClient.js")).default;

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("whatIfController", () => {
  beforeEach(() => {
    mlClient.post.mockClear();
  });

  it("forwards natural-language mode with a trimmed question, no manual fields", async () => {
    const req = {
      userId: "user-1",
      body: {
        dataset_id: "ds-1",
        question: "  What if South sales increase by 15%?  ",
      },
    };
    const res = mockRes();
    const next = vi.fn();

    await whatIf(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mlClient.post).toHaveBeenCalledWith("/what-if", {
      dataset_id: "ds-1",
      question: "What if South sales increase by 15%?",
    });
  });

  it("preserves manual mode payload shape when no question is given", async () => {
    const req = {
      userId: "user-1",
      body: {
        dataset_id: "ds-1",
        metric_column: "sales",
        dimension_column: "region",
        segment_value: "South",
        change_percentage: 15,
      },
    };
    const res = mockRes();
    const next = vi.fn();

    await whatIf(req, res, next);

    expect(mlClient.post).toHaveBeenCalledWith("/what-if", {
      dataset_id: "ds-1",
      metric_column: "sales",
      dimension_column: "region",
      segment_value: "South",
      change_percentage: 15,
    });
  });

  it("treats a blank question as absent and falls back to manual validation", async () => {
    const req = {
      userId: "user-1",
      body: {
        dataset_id: "ds-1",
        question: "   ",
      },
    };
    const res = mockRes();
    const next = vi.fn();

    await whatIf(req, res, next);

    expect(mlClient.post).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("metric_column"),
      })
    );
  });

  it("rejects manual mode missing change_percentage", async () => {
    const req = {
      userId: "user-1",
      body: {
        dataset_id: "ds-1",
        metric_column: "sales",
      },
    };
    const res = mockRes();
    const next = vi.fn();

    await whatIf(req, res, next);

    expect(mlClient.post).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("rejects a non-numeric change_percentage", async () => {
    const req = {
      userId: "user-1",
      body: {
        dataset_id: "ds-1",
        metric_column: "sales",
        change_percentage: "ten",
      },
    };
    const res = mockRes();
    const next = vi.fn();

    await whatIf(req, res, next);

    expect(mlClient.post).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("requires dataset_id", async () => {
    const req = { userId: "user-1", body: { metric_column: "sales" } };
    const res = mockRes();
    const next = vi.fn();

    await whatIf(req, res, next);

    expect(mlClient.post).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
