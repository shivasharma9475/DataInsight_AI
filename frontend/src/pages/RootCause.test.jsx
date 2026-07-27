import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import RootCause from "./RootCause.jsx";
import { datasetApi, rcaApi } from "../services/api.js";

vi.mock("../services/api.js", () => ({
  datasetApi: {
    profile: vi.fn(),
  },
  rcaApi: {
    analyze: vi.fn(),
  },
}));

const PROFILE = {
  row_count: 1000,
  column_count: 5,
  numerical_columns: ["Sales", "Units"],
  categorical_columns: ["Region", "Category"],
  datetime_columns: ["Order Date"],
};

const RESULT = {
  metric: "Sales",
  comparison: {
    previous_period: "2026-01",
    current_period: "2026-02",
    previous_value: 520000,
    current_value: 422760,
    absolute_change: -97240,
    percentage_change: -18.7,
    direction: "decrease",
  },
  dimensions: [
    {
      dimension: "Region",
      contributors: [
        {
          dimension: "Region",
          value: "North",
          previous_value: 50000,
          current_value: 30000,
          change: -20000,
          contribution_pct: 52.4,
          impact: "negative",
        },
      ],
      reconciliation: { dimension_change: -20000, overall_change: -20000, error: 0 },
    },
  ],
  top_contributors: [
    {
      dimension: "Region",
      value: "North",
      previous_value: 50000,
      current_value: 30000,
      change: -20000,
      contribution_pct: 52.4,
      impact: "negative",
    },
  ],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/root-cause/abc123"]}>
      <Routes>
        <Route path="/root-cause/:datasetId" element={<RootCause />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("RootCause page", () => {
  it("renders the configuration panel with smart defaults from the dataset profile", async () => {
    datasetApi.profile.mockResolvedValue({ data: PROFILE });
    renderPage();

    expect(await screen.findByText("Analysis Configuration")).toBeInTheDocument();
    expect(screen.getByLabelText("Metric")).toHaveValue("Sales");
    expect(screen.getByLabelText("Date column")).toHaveValue("Order Date");
    expect(screen.getByRole("button", { name: "Analyze Causes" })).toBeEnabled();
  });

  it("shows an empty state instead of the config form when required columns are missing", async () => {
    datasetApi.profile.mockResolvedValue({
      data: { ...PROFILE, numerical_columns: [], categorical_columns: [] },
    });
    renderPage();
    // No numerical columns -> should show an empty state instead of the config form
    expect(await screen.findByText(/No numeric metric available/i)).toBeInTheDocument();
    expect(screen.queryByText("Analysis Configuration")).not.toBeInTheDocument();
  });

  it("shows a loading state and disables duplicate submissions while analyzing", async () => {
    datasetApi.profile.mockResolvedValue({ data: PROFILE });
    let resolveAnalyze;
    rcaApi.analyze.mockReturnValue(
      new Promise((resolve) => {
        resolveAnalyze = resolve;
      })
    );
    const user = userEvent.setup();
    renderPage();

    const button = await screen.findByRole("button", { name: "Analyze Causes" });
    await user.click(button);

    expect(await screen.findByText(/Analyzing metric changes and contributors/i)).toBeInTheDocument();
    expect(rcaApi.analyze).toHaveBeenCalledTimes(1);

    resolveAnalyze({ data: RESULT });
    await waitFor(() => expect(screen.getByText(/Sales decrease/i)).toBeInTheDocument());
  });

  it("renders a negative change result with contributors", async () => {
    datasetApi.profile.mockResolvedValue({ data: PROFILE });
    rcaApi.analyze.mockResolvedValue({ data: RESULT });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Analyze Causes" }));

    expect(await screen.findByText(/Sales decrease 18.7%/i)).toBeInTheDocument();
    expect(screen.getByText("Top Contributors")).toBeInTheDocument();
    expect(screen.getAllByText("North").length).toBeGreaterThan(0);
    expect(screen.getByText(/Contributed to the decline/i)).toBeInTheDocument();
  });

  it("renders a positive change result", async () => {
    datasetApi.profile.mockResolvedValue({ data: PROFILE });
    const positiveResult = {
      ...RESULT,
      comparison: { ...RESULT.comparison, percentage_change: 18.7, absolute_change: 97240, direction: "increase" },
      top_contributors: [{ ...RESULT.top_contributors[0], change: 20000, impact: "positive" }],
    };
    rcaApi.analyze.mockResolvedValue({ data: positiveResult });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Analyze Causes" }));

    expect(await screen.findByText(/Sales increase 18.7%/i)).toBeInTheDocument();
    expect(screen.getByText(/Contributed to the increase/i)).toBeInTheDocument();
  });

  it("shows an empty state when there are no meaningful contributors", async () => {
    datasetApi.profile.mockResolvedValue({ data: PROFILE });
    rcaApi.analyze.mockResolvedValue({
      data: { ...RESULT, dimensions: [{ ...RESULT.dimensions[0], contributors: [] }], top_contributors: [] },
    });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Analyze Causes" }));

    expect(await screen.findAllByText(/No meaningful contributors found/i)).not.toHaveLength(0);
  });

  it("shows a friendly message on API error", async () => {
    datasetApi.profile.mockResolvedValue({ data: PROFILE });
    rcaApi.analyze.mockRejectedValue({ response: { status: 500, data: {} } });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Analyze Causes" }));

    expect(await screen.findByText(/Something went wrong while analyzing/i)).toBeInTheDocument();
  });

  it("shows a dataset-not-found message for 404 errors", async () => {
    datasetApi.profile.mockResolvedValue({ data: PROFILE });
    rcaApi.analyze.mockRejectedValue({ response: { status: 404, data: {} } });
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Analyze Causes" }));

    expect(await screen.findByText(/could not be found/i)).toBeInTheDocument();
  });
});
