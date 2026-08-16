import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../src/services/mlClient.js", () => ({
  default: {
    get: vi.fn().mockResolvedValue({
      data: { numerical_columns: ["sales"], categorical_columns: ["region"], datetime_columns: ["date"] },
    }),
    post: vi.fn(),
  },
}));

vi.mock("../src/controllers/datasetController.js", () => ({
  getOwnedDataset: vi.fn().mockResolvedValue({ _id: "mongo-id-1", mlDatasetId: "ds-1" }),
}));

vi.mock("../src/services/agent/agentOrchestrator.js", () => ({
  runAgent: vi.fn(),
}));

vi.mock("../src/models/ChatMessage.js", () => ({
  default: { create: vi.fn().mockResolvedValue({}), find: vi.fn() },
}));

const { ask } = await import("../src/controllers/chatController.js");
const { runAgent } = await import("../src/services/agent/agentOrchestrator.js");
const ChatMessage = (await import("../src/models/ChatMessage.js")).default;

function mockRes() {
  const res = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("chatController.ask (agent-backed)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ChatMessage.create.mockResolvedValue({});
  });

  it("returns a backward-compatible response shape (answer/data/ai_enhanced/copilot) plus new fields", async () => {
    runAgent.mockResolvedValue({
      final_answer: "Total sales: 1,000",
      ai_used: false,
      plan_history: [{ step: 1, tool: "aggregate", arguments: { metric_column: "sales" }, planner: "deterministic" }],
      evidence: [{ step: 1, tool: "aggregate", arguments: { metric_column: "sales" }, result_summary: { value: 1000 } }],
      assumptions: [],
      warnings: [],
    });

    const req = { userId: "user-1", body: { dataset_id: "ds-1", message: "total sales?" } };
    const res = mockRes();
    const next = vi.fn();

    await ask(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        answer: "Total sales: 1,000",
        data: { value: 1000 },
        ai_enhanced: false,
        copilot: { planner: "deterministic", tool: "aggregate", arguments: { metric_column: "sales" } },
        steps: expect.any(Array),
        evidence: expect.any(Array),
        assumptions: [],
        warnings: [],
      })
    );
  });

  it("persists steps/evidence/warnings to chat history additively", async () => {
    runAgent.mockResolvedValue({
      final_answer: "Sales trend then root cause",
      ai_used: true,
      plan_history: [
        { step: 1, tool: "trend", arguments: {}, planner: "deterministic" },
        { step: 2, tool: "root_cause", arguments: {}, planner: "deterministic" },
      ],
      evidence: [
        { step: 1, tool: "trend", arguments: {}, result_summary: {} },
        { step: 2, tool: "root_cause", arguments: {}, result_summary: {} },
      ],
      assumptions: [],
      warnings: ["Stopped after reaching the maximum of 5 tool calls."],
    });

    const req = { userId: "user-1", body: { dataset_id: "ds-1", message: "why did sales decline?" } };
    await ask(req, mockRes(), vi.fn());

    expect(ChatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        dataset: "mongo-id-1",
        message: "why did sales decline?",
        answer: "Sales trend then root cause",
        steps: expect.arrayContaining([expect.objectContaining({ tool: "trend" })]),
        evidence: expect.any(Array),
        warnings: ["Stopped after reaching the maximum of 5 tool calls."],
      })
    );
  });

  it("returns 422 UNSUPPORTED_QUERY without treating it as a server error", async () => {
    const err = new Error("nope");
    err.code = "UNSUPPORTED_QUERY";
    runAgent.mockRejectedValue(err);

    const req = { userId: "user-1", body: { dataset_id: "ds-1", message: "asdkjaslkdj" } };
    const res = mockRes();
    const next = vi.fn();

    await ask(req, res, next);

    expect(res.status).toHaveBeenCalledWith(422);
    expect(next).not.toHaveBeenCalled();
  });

  it("checks dataset ownership before running the agent", async () => {
    const { getOwnedDataset } = await import("../src/controllers/datasetController.js");
    getOwnedDataset.mockRejectedValueOnce(Object.assign(new Error("Dataset not found"), { status: 404 }));

    runAgent.mockResolvedValue({ final_answer: "x", ai_used: false, plan_history: [], evidence: [], assumptions: [], warnings: [] });

    const req = { userId: "user-1", body: { dataset_id: "not-mine", message: "total sales?" } };
    const next = vi.fn();

    await ask(req, mockRes(), next);

    expect(runAgent).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it("requires dataset_id and message", async () => {
    const res1 = mockRes();
    await ask({ userId: "u", body: { message: "hi" } }, res1, vi.fn());
    expect(res1.status).toHaveBeenCalledWith(400);

    const res2 = mockRes();
    await ask({ userId: "u", body: { dataset_id: "ds-1" } }, res2, vi.fn());
    expect(res2.status).toHaveBeenCalledWith(400);
  });
});
