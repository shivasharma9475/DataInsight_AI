import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock the tool registry so orchestrator guard logic (max steps, repeated
// call detection, timeout, failure handling) can be tested deterministically
// without any real ML-service network calls.
vi.mock("../src/services/agent/toolRegistry.js", () => {
  const realTools = new Set(["always_ok", "always_fails", "slow_tool", "step_counter"]);
  return {
    hasTool: vi.fn((name) => realTools.has(name)),
    validateArgs: vi.fn((name, args) => args ?? {}),
    executeTool: vi.fn(),
    summarizeResult: vi.fn((name, result) => result),
    timeoutFor: vi.fn((name) => (name === "slow_tool" ? 20 : 5000)),
  };
});

vi.mock("../src/services/agent/agentPlanner.js", () => ({
  planNextStep: vi.fn(),
}));

vi.mock("../src/services/copilotPlanner.js", () => ({
  getOpenAIClient: vi.fn(() => null),
}));

vi.mock("../src/config/env.js", () => ({
  config: { agentDeadlineMs: 5000 },
}));

const { runAgent, MAX_TOOL_CALLS } = await import("../src/services/agent/agentOrchestrator.js");
const toolRegistry = await import("../src/services/agent/toolRegistry.js");
const agentPlanner = await import("../src/services/agent/agentPlanner.js");

describe("agentOrchestrator guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    toolRegistry.hasTool.mockImplementation((name) =>
      new Set(["always_ok", "always_fails", "slow_tool", "step_counter"]).has(name)
    );
    toolRegistry.validateArgs.mockImplementation((name, args) => args ?? {});
    toolRegistry.summarizeResult.mockImplementation((name, result) => result);
    toolRegistry.timeoutFor.mockImplementation((name) => (name === "slow_tool" ? 20 : 5000));
  });

  it("enforces a maximum of 5 tool calls per request", async () => {
    let calls = 0;
    agentPlanner.planNextStep.mockImplementation(async () => {
      calls += 1;
      return { action: "tool_call", tool: "step_counter", arguments: { n: calls }, planner: "test" };
    });
    toolRegistry.executeTool.mockResolvedValue({ ok: true });

    const state = await runAgent({ dataset_id: "ds-1", message: "loop forever", profile: {} });

    expect(state.tool_call_count).toBe(MAX_TOOL_CALLS);
    expect(state.evidence.length).toBe(MAX_TOOL_CALLS);
    expect(state.warnings.some((w) => w.includes("maximum of 5 tool calls"))).toBe(true);
  });

  it("stops on a repeated identical tool call instead of looping", async () => {
    agentPlanner.planNextStep.mockResolvedValue({
      action: "tool_call",
      tool: "always_ok",
      arguments: { metric_column: "sales" },
      planner: "test",
    });
    toolRegistry.executeTool.mockResolvedValue({ value: 42 });

    const state = await runAgent({ dataset_id: "ds-1", message: "repeat", profile: {} });

    expect(state.tool_call_count).toBe(1);
    expect(state.warnings.some((w) => w.includes("repeated"))).toBe(true);
  });

  it("stops safely on a per-tool timeout and preserves prior evidence", async () => {
    let step = 0;
    agentPlanner.planNextStep.mockImplementation(async () => {
      step += 1;
      if (step === 1) {
        return { action: "tool_call", tool: "always_ok", arguments: { a: 1 }, planner: "test" };
      }
      return { action: "tool_call", tool: "slow_tool", arguments: { a: 2 }, planner: "test" };
    });
    toolRegistry.executeTool.mockImplementation(async (name) => {
      if (name === "slow_tool") {
        await new Promise((resolve) => setTimeout(resolve, 200)); // exceeds its 20ms timeout
        return { should: "never resolve in time" };
      }
      return { fast: true };
    });

    const state = await runAgent({ dataset_id: "ds-1", message: "timeout please", profile: {} });

    // Step 1 succeeded and its evidence must be preserved.
    expect(state.tool_call_count).toBe(1);
    expect(state.evidence).toEqual([
      { step: 1, tool: "always_ok", arguments: { a: 1 }, result_summary: { fast: true } },
    ]);
    expect(state.warnings.some((w) => w.includes("timed out"))).toBe(true);
  });

  it("stops safely when a tool fails, preserving prior evidence", async () => {
    let step = 0;
    agentPlanner.planNextStep.mockImplementation(async () => {
      step += 1;
      if (step === 1) {
        return { action: "tool_call", tool: "always_ok", arguments: { a: 1 }, planner: "test" };
      }
      return { action: "tool_call", tool: "always_fails", arguments: { a: 2 }, planner: "test" };
    });
    toolRegistry.executeTool.mockImplementation(async (name) => {
      if (name === "always_fails") throw new Error("downstream ML service error");
      return { fast: true };
    });

    const state = await runAgent({ dataset_id: "ds-1", message: "fail please", profile: {} });

    expect(state.tool_call_count).toBe(1);
    expect(state.evidence.length).toBe(1);
    expect(state.warnings.some((w) => w.includes("failed"))).toBe(true);
  });

  it("fails closed on an unknown tool proposed by the planner", async () => {
    agentPlanner.planNextStep.mockResolvedValue({
      action: "tool_call",
      tool: "delete_all_data",
      arguments: {},
      planner: "test",
    });

    const state = await runAgent({ dataset_id: "ds-1", message: "do something sneaky", profile: {} });

    expect(state.tool_call_count).toBe(0);
    expect(toolRegistry.executeTool).not.toHaveBeenCalled();
    expect(state.warnings.some((w) => w.includes("unknown tool"))).toBe(true);
  });

  it("fails closed on invalid arguments instead of silently dropping/fixing them", async () => {
    agentPlanner.planNextStep.mockResolvedValue({
      action: "tool_call",
      tool: "always_ok",
      arguments: { metric_column: "sales" },
      planner: "test",
    });
    toolRegistry.validateArgs.mockImplementation(() => {
      const err = new Error('Invalid arguments for tool "always_ok": unexpected key "sql"');
      err.code = "INVALID_ARGUMENTS";
      throw err;
    });

    const state = await runAgent({ dataset_id: "ds-1", message: "inject sql", profile: {} });

    expect(state.tool_call_count).toBe(0);
    expect(toolRegistry.executeTool).not.toHaveBeenCalled();
    expect(state.warnings.some((w) => w.includes("Rejected step"))).toBe(true);
  });

  it("stops cleanly on final_answer with no tool calls needed", async () => {
    agentPlanner.planNextStep.mockResolvedValue({ action: "final_answer", planner: "test" });

    const state = await runAgent({ dataset_id: "ds-1", message: "hi", profile: {} });

    expect(state.tool_call_count).toBe(0);
    expect(state.final_answer).toBeTruthy();
  });

  it("throws UNSUPPORTED_QUERY when the planner cannot map the question at all", async () => {
    agentPlanner.planNextStep.mockResolvedValue({ action: "unsupported", planner: "test" });

    await expect(
      runAgent({ dataset_id: "ds-1", message: "asdkjaslkdj", profile: {} })
    ).rejects.toMatchObject({ code: "UNSUPPORTED_QUERY" });
  });

  it("respects the configurable AGENT_DEADLINE_MS rather than a fixed 45s limit", async () => {
    const envModule = await import("../src/config/env.js");
    envModule.config.agentDeadlineMs = 10; // force an immediate deadline for this test

    agentPlanner.planNextStep.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
      return { action: "tool_call", tool: "always_ok", arguments: {}, planner: "test" };
    });

    const state = await runAgent({ dataset_id: "ds-1", message: "slow planning", profile: {} });

    expect(state.warnings.some((w) => w.includes("time budget"))).toBe(true);
    // The deadline is checked at the top of each loop iteration, so a
    // step already in flight when the deadline passes may still complete
    // -- but the loop must stop well short of MAX_TOOL_CALLS, proving the
    // short configured deadline (not a fixed 45s figure) was honored.
    expect(state.tool_call_count).toBeLessThan(MAX_TOOL_CALLS);

    envModule.config.agentDeadlineMs = 5000; // restore for other tests
  });
});
