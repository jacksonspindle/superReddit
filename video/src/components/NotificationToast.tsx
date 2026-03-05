import React from "react";
import { useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../theme";

export const NotificationToast: React.FC<{
  text: string;
  delay?: number;
  icon?: string;
  color?: string;
}> = ({ text, delay = 0, icon = "🔔", color = COLORS.orange }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideIn = spring({
    frame,
    fps,
    delay,
    config: { damping: 15, stiffness: 200 },
  });

  const fadeOut = interpolate(frame, [delay + 80, delay + 100], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const translateX = interpolate(slideIn, [0, 1], [300, 0]);

  if (frame < delay) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 20,
        right: 20,
        background: COLORS.bgCard,
        border: `1px solid ${COLORS.borderStrong}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 10,
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        transform: `translateX(${translateX}px)`,
        opacity: fadeOut,
        zIndex: 100,
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 12, color: COLORS.fg, fontWeight: 500 }}>
        {text}
      </span>
    </div>
  );
};
