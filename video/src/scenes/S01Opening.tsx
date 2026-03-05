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
import { TypewriterText } from "../components/TypewriterText";
import { FadeSlide } from "../components/FadeSlide";
import { COLORS } from "../theme";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const ICONS = [
  { label: "Monitor", emoji: "📡", desc: "Find leads in real-time" },
  { label: "Engage", emoji: "💬", desc: "DM with AI-crafted messages" },
  { label: "Convert", emoji: "🎯", desc: "Track your pipeline" },
];

export const S01Opening: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo scale-in with spring
  const logoScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 200 },
  });

  // Subtitle fade
  const subtitleOpacity = interpolate(frame, [60, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ fontFamily }}>
      <AnimatedBackground variant="gradient" />

      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 60,
        }}
      >
        {/* Logo */}
        <div
          style={{
            transform: `scale(${logoScale})`,
            marginBottom: 32,
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              background: `linear-gradient(135deg, ${COLORS.orange}, #ea580c)`,
              borderRadius: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 800,
              color: "white",
              boxShadow: `0 4px 24px ${COLORS.orangeGlow}`,
            }}
          >
            SR
          </div>
          <span
            style={{
              fontSize: 36,
              fontWeight: 700,
              color: COLORS.fg,
              letterSpacing: -0.5,
            }}
          >
            Super
            <span style={{ color: COLORS.orange }}>Reddit</span>
          </span>
        </div>

        {/* Headline - typewriter */}
        <div
          style={{
            fontSize: 42,
            fontWeight: 700,
            color: COLORS.fg,
            textAlign: "center",
            lineHeight: 1.2,
            marginBottom: 16,
            maxWidth: 800,
          }}
        >
          <TypewriterText
            text="Your 1-on-1 Reddit Growth Agency"
            delay={25}
            charFrames={2}
            cursorColor={COLORS.orange}
          />
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 18,
            color: COLORS.fgMuted,
            textAlign: "center",
            opacity: subtitleOpacity,
            marginBottom: 50,
          }}
        >
          We find your leads. We craft your outreach. You close the deals.
        </div>

        {/* Three icons */}
        <div style={{ display: "flex", gap: 40 }}>
          {ICONS.map((icon, i) => (
            <FadeSlide key={i} delay={90 + i * 15} distance={20}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 16,
                    background: COLORS.bgCard,
                    border: `1px solid ${COLORS.borderStrong}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 28,
                  }}
                >
                  {icon.emoji}
                </div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: COLORS.fg,
                  }}
                >
                  {icon.label}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: COLORS.fgDim,
                    textAlign: "center",
                    maxWidth: 140,
                  }}
                >
                  {icon.desc}
                </div>
              </div>
            </FadeSlide>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
