import React from "react";
import { CalendarOff, Hash, Tags, SearchX, Layers } from "lucide-react";
import { Card, EmptyState } from "../UI.jsx";

const PRESETS = {
  "no-date": {
    icon: CalendarOff,
    title: "No date column available",
    desc: "This dataset needs a date/time column to perform period-over-period Root Cause Analysis.",
  },
  "no-metric": {
    icon: Hash,
    title: "No numeric metric available",
    desc: "Root Cause Analysis compares a numeric metric over time. This dataset doesn't have a numerical column to analyze.",
  },
  "no-dimensions": {
    icon: Tags,
    title: "No categorical dimensions available",
    desc: "Root Cause Analysis breaks a change down by segments (like Region or Category). This dataset doesn't have categorical columns to break down by.",
  },
  "insufficient-periods": {
    icon: Layers,
    title: "Not enough time periods",
    desc: "This dataset needs at least two time periods for period-over-period Root Cause Analysis. Try a shorter period (e.g. Daily or Weekly) or upload more historical data.",
  },
  "no-contributors": {
    icon: SearchX,
    title: "No meaningful contributors found",
    desc: "The change in this metric wasn't concentrated in any particular segment of the selected dimensions.",
  },
};

export default function AnalysisEmptyState({ preset, title, desc, icon, className = "" }) {
  const config = PRESETS[preset] || {};
  return (
    <Card className={className}>
      <EmptyState
        icon={icon || config.icon}
        title={title || config.title || "Nothing to show yet"}
        desc={desc || config.desc}
      />
    </Card>
  );
}
