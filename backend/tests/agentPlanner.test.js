import { describe, expect, it } from "vitest";
import { deterministicFallbackPlan } from "../src/services/agent/agentPlanner.js";

const PROFILE = {
  numerical_columns: ["sales", "profit"],
  categorical_columns: ["region", "product"],
  datetime_columns: ["date"],
};

describe("deterministicFallbackPlan (A-F workflows, no OpenAI)", () => {
  it("A: 'Why did sales decline?' -> trend -> root_cause", () => {
    const plan = deterministicFallbackPlan("Why did sales decline?", PROFILE);
    expect(plan.patternId).toBe("A");
    expect(plan.plannedSteps.map((s) => s.tool)).toEqual(["trend", "root_cause"]);
    expect(plan.plannedSteps[0].arguments.metric_column).toBe("sales");
    expect(plan.plannedSteps[0].arguments.date_column).toBe("date");
    expect(plan.plannedSteps[1].arguments.metric_column).toBe("sales");
  });

  it("B: 'Which region performs best and why?' -> group_by -> root_cause", () => {
    const plan = deterministicFallbackPlan("Which region performs best and why, considering sales?", PROFILE);
    expect(plan.patternId).toBe("B");
    expect(plan.plannedSteps.map((s) => s.tool)).toEqual(["group_by", "root_cause"]);
    expect(plan.plannedSteps[0].arguments.dimension_column).toBe("region");
    expect(plan.plannedSteps[0].arguments.metric_column).toBe("sales");
  });

  it("B without a datetime column only runs group_by (no root_cause possible)", () => {
    const noDateProfile = { ...PROFILE, datetime_columns: [] };
    const plan = deterministicFallbackPlan("Which region performs best and why, considering sales?", noDateProfile);
    expect(plan.plannedSteps.map((s) => s.tool)).toEqual(["group_by"]);
  });

  it("C: 'Analyze this dataset and give important insights' -> profile -> trend -> group_by -> recommendation", () => {
    const plan = deterministicFallbackPlan("Analyze this dataset and give me important insights", PROFILE);
    expect(plan.patternId).toBe("C");
    expect(plan.plannedSteps.map((s) => s.tool)).toEqual([
      "dataset_profile",
      "trend",
      "group_by",
      "recommendation",
    ]);
    expect(plan.plannedSteps.length).toBeLessThanOrEqual(5);
  });

  it("D: 'What if West sales increase by 15%?' -> what_if (delegates NL to the What-if engine)", () => {
    const plan = deterministicFallbackPlan("What if West sales increase by 15%?", PROFILE);
    expect(plan.patternId).toBe("D");
    expect(plan.plannedSteps).toEqual([
      { tool: "what_if", arguments: { question: "What if West sales increase by 15%?" } },
    ]);
  });

  it("E: 'Forecast sales for the next 30 days' -> forecast", () => {
    const plan = deterministicFallbackPlan("Forecast sales for the next 30 days", PROFILE);
    expect(plan.patternId).toBe("E");
    expect(plan.plannedSteps.map((s) => s.tool)).toEqual(["forecast"]);
    expect(plan.plannedSteps[0].arguments.metric_column).toBe("sales");
    expect(plan.plannedSteps[0].arguments.date_column).toBe("date");
    expect(plan.plannedSteps[0].arguments.periods).toBe(30);
  });

  it("E: horizon phrase drives the periods argument", () => {
    const plan = deterministicFallbackPlan("Forecast sales for the next 6 months", PROFILE);
    expect(plan.plannedSteps[0].arguments.periods).toBe(6);
  });

  it("F: 'Train a classification model to predict churn' -> classification", () => {
    const profile = { ...PROFILE, categorical_columns: ["region", "product", "churn"] };
    const plan = deterministicFallbackPlan("Train a classification model to predict churn", profile);
    expect(plan.patternId).toBe("F");
    expect(plan.plannedSteps.map((s) => s.tool)).toEqual(["classification"]);
    expect(plan.plannedSteps[0].arguments.target_column).toBe("churn");
    expect(plan.plannedSteps[0].arguments.feature_columns).not.toContain("churn");
  });

  it("F: 'Build a regression model' -> regression", () => {
    const plan = deterministicFallbackPlan("Build a regression model to predict profit", PROFILE);
    expect(plan.plannedSteps.map((s) => s.tool)).toEqual(["regression"]);
    expect(plan.plannedSteps[0].arguments.target_column).toBe("profit");
  });

  it("F: 'Cluster customers into groups' -> clustering with no target_column", () => {
    const plan = deterministicFallbackPlan("Cluster the data into groups", PROFILE);
    expect(plan.plannedSteps.map((s) => s.tool)).toEqual(["clustering"]);
    expect(plan.plannedSteps[0].arguments.target_column).toBeUndefined();
    expect(plan.plannedSteps[0].arguments.feature_columns.length).toBeGreaterThan(0);
  });

  it("falls back to the legacy single-tool planner for simple questions not matching A-F", () => {
    const plan = deterministicFallbackPlan("What is the total sales?", PROFILE);
    expect(plan.patternId).toBe("legacy_single_tool");
    expect(plan.plannedSteps).toEqual([{ tool: "aggregate", arguments: { metric_column: "sales", aggregation: "sum" } }]);
  });

  it("returns null for a totally unsupported question", () => {
    const plan = deterministicFallbackPlan("asdkjaslkdj random gibberish", PROFILE);
    expect(plan).toBeNull();
  });
});
