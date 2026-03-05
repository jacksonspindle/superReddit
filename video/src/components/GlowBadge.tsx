import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { COLORS } from "../theme";

export const GlowBadge: React.FC<{
  text: string;
  color?: string;
  bgColor?: string;
  delay?: number;
}> = ({
  text,
  color = COLORS.orange,
  bgColor = COLORS.orangeBg,
  delay = 0,
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(frame, [delay, delay + 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const glowIntensity = interpolate(
    Math.sin(frame * 0.08),
    [-1, 1],
    [0.3, 0.8]
  );

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 12px",
        borderRadius: 20,
        background: bgColor,
        border: `1px solid ${color}33`,
        opacity,
        boxShadow: `0 0 ${12 * glowIntensity}px ${color}44`,
      }}
    >
      <span style={{ fontSize: 12, fontWeight: 600, color }}>{text}</span>
    </div>
  );
};
