import React, { useEffect, useState } from "react";
import { UploadCloud, Check } from "lucide-react";

/**
 * FluidUploadCircle
 *
 * Clean circular upload control:
 * - No background text
 * - Centered upload icon
 * - Smooth circular progress ring driven by `progress`
 * - Uses DataInsight AI green/teal theme
 * - Keeps the existing phase/progress/onClick API
 */
export default function FluidUploadCircle({
  phase = "idle",
  progress = 0,
  size = 160,
  onClick,
}) {
  const isUploading = phase === "uploading";
  const isSuccess = phase === "success";

  const [displayProgress, setDisplayProgress] = useState(0);

  // Smoothly animate the visual ring toward the real upload progress.
  useEffect(() => {
    const target = isSuccess
      ? 100
      : isUploading
        ? Math.min(Math.max(Number(progress) || 0, 0), 100)
        : 0;

    let frame;
    const animate = () => {
      setDisplayProgress((current) => {
        const difference = target - current;

        if (Math.abs(difference) < 0.25) {
          return target;
        }

        return current + difference * 0.08;
      });

      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frame);
  }, [phase, progress, isUploading, isSuccess]);

  const strokeWidth = 4;
  const radius = (size - strokeWidth * 2 - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset =
    circumference - (displayProgress / 100) * circumference;

  const handleClick = () => {
    if (phase === "idle" && onClick) {
      onClick();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={phase !== "idle"}
      aria-label={
        isUploading
          ? `Uploading ${Math.round(displayProgress)} percent`
          : isSuccess
            ? "Upload complete"
            : "Select dataset file"
      }
      className="relative rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
      style={{
        width: size,
        height: size,
        cursor: phase === "idle" ? "pointer" : "default",
        background:
          "radial-gradient(circle at 35% 30%, #16224d 0%, #0d1738 48%, #071126 100%)",
        boxShadow:
          phase === "uploading"
            ? "0 0 30px rgba(16,185,129,0.18), 0 0 0 1px rgba(16,185,129,0.25)"
            : "0 0 28px rgba(16,185,129,0.12), 0 0 0 1px rgba(16,185,129,0.18)",
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 -rotate-90"
        aria-hidden="true"
      >
        {/* Base ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(16,185,129,0.16)"
          strokeWidth={strokeWidth}
        />

        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#10b981"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke 0.25s ease, filter 0.25s ease",
            filter:
              displayProgress > 0
                ? "drop-shadow(0 0 7px rgba(16,185,129,0.65))"
                : "none",
          }}
        />
      </svg>

      {/* Center icon only — no text */}
      <span
        className={`absolute inset-0 flex items-center justify-center transition-transform duration-300 ${
          phase === "idle" ? "hover:scale-105" : ""
        }`}
      >
        {isSuccess ? (
          <Check
            size={36}
            strokeWidth={2.5}
            className="text-emerald-400"
          />
        ) : (
          <UploadCloud
            size={38}
            strokeWidth={2}
            className={`text-emerald-400 transition-all duration-300 ${
              isUploading ? "scale-95" : ""
            }`}
            style={{
              filter: isUploading
                ? "drop-shadow(0 0 8px rgba(16,185,129,0.55))"
                : "drop-shadow(0 0 5px rgba(16,185,129,0.35))",
            }}
          />
        )}
      </span>
    </button>
  );
}