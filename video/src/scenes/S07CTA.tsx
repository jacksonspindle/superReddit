import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { AnimatedBackground } from "../components/AnimatedBackground";
import { COLORS } from "../theme";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

export const S07CTA: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 200 },
  });

  const headlineOpacity = interpolate(frame, [15, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const headlineY = interpolate(frame, [15, 30], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const buttonScale = spring({
    frame,
    fps,
    delay: 30,
    config: { damping: 10, stiffness: 150 },
  });

  // Button pulse
  const pulse = interpolate(
    Math.sin(frame * 0.12),
    [-1, 1],
    [0.97, 1.03]
  );

  const urlOpacity = interpolate(frame, [50, 65], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ fontFamily }}>
      <AnimatedBackground variant="orange-glow" />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
        }}
      >
        {/* Logo */}
        <div
          style={{
            transform: `scale(${logoScale})`,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 52,
              height: 52,
              background: `linear-gradient(135deg, ${COLORS.orange}, #ea580c)`,
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 24,
              fontWeight: 800,
              color: "white",
              boxShadow: `0 4px 32px ${COLORS.orangeGlow}`,
            }}
          >
            SR
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: 40,
            fontWeight: 800,
            color: COLORS.fg,
            textAlign: "center",
            lineHeight: 1.2,
            maxWidth: 700,
            opacity: headlineOpacity,
            transform: `translateY(${headlineY}px)`,
          }}
        >
          Turn Reddit into Your{" "}
          <span style={{ color: COLORS.orange }}>#1 Lead Channel</span>
        </div>

        {/* CTA Button */}
        <div
          style={{
            transform: `scale(${buttonScale * pulse})`,
          }}
        >
          <div
            style={{
              padding: "16px 48px",
              background: `linear-gradient(135deg, ${COLORS.orange}, #ea580c)`,
              borderRadius: 14,
              fontSize: 18,
              fontWeight: 700,
              color: "white",
              boxShadow: `0 8px 32px ${COLORS.orangeGlow}, 0 2px 8px rgba(0,0,0,0.3)`,
              border: "1px solid rgba(255,255,255,0.15)",
            }}
          >
            Get Started Now {"→"}
          </div>
        </div>

        {/* URL */}
        <div
          style={{
            fontSize: 16,
            color: COLORS.fgMuted,
            fontWeight: 500,
            opacity: urlOpacity,
            letterSpacing: 0.5,
          }}
        >
          superreddit.co
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
