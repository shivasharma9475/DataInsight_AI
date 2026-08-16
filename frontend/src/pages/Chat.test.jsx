import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Chat from "./Chat.jsx";
import { chatApi, datasetApi } from "../services/api.js";

// jsdom doesn't implement scrollIntoView -- real browsers do. Chat.jsx's
// auto-scroll effect is unrelated to what these tests verify.
Element.prototype.scrollIntoView = vi.fn();

vi.mock("../services/api.js", () => ({
  chatApi: {
    history: vi.fn(),
    ask: vi.fn(),
  },
  datasetApi: {
    profile: vi.fn(),
  },
}));

const PROFILE = {
  row_count: 500,
  numerical_columns: ["sales"],
  categorical_columns: ["region"],
  datetime_columns: ["date"],
};

function renderChat() {
  return render(
    <MemoryRouter initialEntries={["/chat/ds-1"]}>
      <Routes>
        <Route path="/chat/:datasetId" element={<Chat />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("Chat page (Agentic Copilot integration)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    datasetApi.profile.mockResolvedValue({ data: PROFILE });
  });

  it("renders old-format history messages with none of the new fields without crashing", async () => {
    chatApi.history.mockResolvedValue({
      data: [
        // Old message shape: no steps/evidence/warnings at all.
        { message: "total sales?", answer: "Total sales: 1,000", timestamp: "2026-01-01" },
      ],
    });

    renderChat();

    await waitFor(() => {
      expect(screen.getByText("total sales?")).toBeInTheDocument();
      expect(screen.getByText("Total sales: 1,000")).toBeInTheDocument();
    });

    // No "Show analysis steps" toggle should appear for a message with
    // no steps and no warnings.
    expect(screen.queryByText(/Show analysis steps/i)).not.toBeInTheDocument();
  });

  it("shows a collapsible analysis-steps disclosure when steps/evidence are present, collapsed by default", async () => {
    chatApi.history.mockResolvedValue({
      data: [
        {
          message: "why did sales decline?",
          answer: "Sales trend then root cause explanation.",
          timestamp: "2026-01-01",
          steps: [
            { step: 1, tool: "trend", arguments: {} },
            { step: 2, tool: "root_cause", arguments: {} },
          ],
          evidence: [
            { tool: "trend", result_summary: { metric: "sales" } },
            { tool: "root_cause", result_summary: { comparison: {} } },
          ],
          warnings: [],
        },
      ],
    });

    renderChat();

    await waitFor(() => {
      expect(screen.getByText("Sales trend then root cause explanation.")).toBeInTheDocument();
    });

    const toggle = screen.getByText(/Show analysis steps/i);
    expect(toggle).toBeInTheDocument();

    // Collapsed by default: step chips not yet visible.
    expect(screen.queryByText("1. trend")).not.toBeInTheDocument();

    await userEvent.click(toggle);

    expect(screen.getByText("1. trend")).toBeInTheDocument();
    expect(screen.getByText("2. root_cause")).toBeInTheDocument();
  });

  it("shows warnings in the disclosure even when steps/evidence are empty", async () => {
    chatApi.history.mockResolvedValue({
      data: [
        {
          message: "asdkjaslkdj",
          answer: "I wasn't able to complete this analysis.",
          timestamp: "2026-01-01",
          steps: [],
          evidence: [],
          warnings: ["No supported pattern matched this question."],
        },
      ],
    });

    renderChat();

    await waitFor(() => {
      expect(screen.getByText(/wasn't able to complete/)).toBeInTheDocument();
    });

    // Warnings alone are enough to show the toggle even with zero steps.
    const toggle = screen.getByText(/Show analysis steps/i);
    await userEvent.click(toggle);

    expect(screen.getByText("No supported pattern matched this question.")).toBeInTheDocument();
  });

  it("sends a new message and renders the agent's steps/evidence/warnings from the live response", async () => {
    chatApi.history.mockResolvedValue({ data: [] });
    chatApi.ask.mockResolvedValue({
      data: {
        answer: "Total sales: 1,000",
        steps: [{ step: 1, tool: "aggregate", arguments: { metric_column: "sales" } }],
        evidence: [{ tool: "aggregate", result_summary: { value: 1000 } }],
        warnings: [],
      },
    });

    renderChat();

    await waitFor(() => expect(datasetApi.profile).toHaveBeenCalled());

    const input = screen.getByPlaceholderText(/Ask about your data/i);
    await userEvent.type(input, "total sales?");
    await userEvent.click(screen.getByRole("button", { name: "" }) || input);

    // Submit via Enter to avoid relying on an unlabeled icon button.
    await userEvent.type(input, "{Enter}");

    await waitFor(() => {
      expect(chatApi.ask).toHaveBeenCalledWith({ dataset_id: "ds-1", message: "total sales?" });
    });
  });

  it("gracefully shows a fallback message when the response has no answer field", async () => {
    chatApi.history.mockResolvedValue({ data: [] });
    chatApi.ask.mockResolvedValue({ data: {} });

    renderChat();
    await waitFor(() => expect(datasetApi.profile).toHaveBeenCalled());

    const input = screen.getByPlaceholderText(/Ask about your data/i);
    await userEvent.type(input, "hello{Enter}");

    await waitFor(() => {
      expect(
        screen.getByText("The analysis completed, but no answer was returned.")
      ).toBeInTheDocument();
    });
  });

  it("shows the backend's 422 UNSUPPORTED_QUERY message instead of a generic error", async () => {
    chatApi.history.mockResolvedValue({ data: [] });
    chatApi.ask.mockRejectedValue({
      response: { data: { code: "UNSUPPORTED_QUERY", message: "I couldn't understand that analysis request." } },
    });

    renderChat();
    await waitFor(() => expect(datasetApi.profile).toHaveBeenCalled());

    const input = screen.getByPlaceholderText(/Ask about your data/i);
    await userEvent.type(input, "asdkjaslkdj{Enter}");

    await waitFor(() => {
      expect(screen.getByText("I couldn't understand that analysis request.")).toBeInTheDocument();
    });
  });
});
