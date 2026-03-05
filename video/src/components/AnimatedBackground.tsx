import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { COLORS } from "../theme";

export const AnimatedBackground: React.FC<{
  variant?: "dark" | "orange-glow" | "gradient";
}> = ({ variant = "dark" }) => {
  const frame = useCurrentFrame();

  const bgStyle: React.CSSProperties = {
    background:
      variant === "orange-glow"
        ? `radial-gradient(ellipse at center, ${COLORS.orangeGlow} 0%, ${COLORS.bg} 70%)`
        : variant === "gradient"
          ? `linear-gradient(135deg, #0a0a0a 0%, #111827 50%, #0a0a0a 100%)`
          : COLORS.bg,
  };

  // Floating particles
  const particles = Array.from({ length: 20 }, (_, i) => {
    const seed = i * 137.508;
    const x = ((seed * 7.3) % 100);
    const y = ((seed * 13.7) % 100);
    const size = 2 + (i % 3);
    const speed = 0.3 + (i % 5) * 0.1;
    const yOffset = interpolate(
      frame,
      [0, 300],
      [0, -30 * speed],
      { extrapolateRight: "extend" }
    );
    const opacity = interpolate(
      Math.sin(frame * 0.02 + seed),
      [-1, 1],
      [0.05, 0.2]
    );

    return (
      <div
        key={i}
        style={{
          position: "absolute",
          left: `${x}%`,
          top: `${(y + yOffset) % 110}%`,
          width: size,
          height: size,
          borderRadius: "50%",
          background: variant === "orange-glow" ? COLORS.orange : COLORS.fgDim,
          opacity,
        }}
      />
    );
  });

  return (
    <AbsoluteFill style={bgStyle}>
      {particles}
    </AbsoluteFill>
  );
};
