import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../theme";

export const StatCounter: React.FC<{
  label: string;
  value: number;
  color: string;
  bgColor: string;
  delay?: number;
  icon?: string;
}> = ({ label, value, color, bgColor, delay = 0, icon }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame,
    fps,
    delay,
    config: { damping: 200 },
    durationInFrames: 40,
  });

  const displayValue = Math.round(interpolate(progress, [0, 1], [0, value]));
  const scale = spring({
    frame,
    fps,
    delay,
    config: { damping: 12, stiffness: 200 },
  });

  return (
    <div
      style={{
        background: COLORS.bgCard,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 10,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: COLORS.fgMuted,
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: 0.5,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {icon && <span>{icon}</span>}
        {label}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color,
          lineHeight: 1,
        }}
      >
        {displayValue}
      </div>
      <div
        style={{
          width: "100%",
          height: 3,
          background: bgColor,
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progress * 100}%`,
            height: "100%",
            background: color,
            borderRadius: 2,
          }}
        />
      </div>
    </div>
  );
};
