import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { TypewriterText } from "../components/TypewriterText";
import { FadeSlide } from "../components/FadeSlide";
import { COLORS } from "../theme";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

export const S06AI: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // AI sparkle icon animation
  const sparkleScale = spring({
    frame,
    fps,
    config: { damping: 8 },
  });

  const glowPulse = interpolate(
    Math.sin(frame * 0.1),
    [-1, 1],
    [0.4, 1]
  );

  // Row 1: lead card → AI draft materializes (frame 50+)
  const row1Progress = interpolate(frame, [50, 80], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Row 2: context → personalized (frame 85+)
  const row2Progress = interpolate(frame, [85, 115], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Row 3: progress bar (frame 120+)
  const row3Progress = interpolate(frame, [120, 170], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  const draftsGenerated = Math.round(row3Progress * 12);

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily }}>
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 60,
        }}
      >
        {/* AI sparkle icon */}
        <div
          style={{
            transform: `scale(${sparkleScale})`,
            marginBottom: 20,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              background: `linear-gradient(135deg, ${COLORS.accent}, ${COLORS.purple})`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 36,
              boxShadow: `0 0 ${40 * glowPulse}px ${COLORS.accent}66`,
            }}
          >
            {"✨"}
          </div>
        </div>

        {/* Typewriter headline */}
        <div
          style={{
            fontSize: 32,
            fontWeight: 700,
            color: COLORS.fg,
            marginBottom: 40,
            textAlign: "center",
          }}
        >
          <TypewriterText
            text="AI That Writes Your Outreach"
            delay={15}
            charFrames={2}
            cursorColor={COLORS.accent}
          />
        </div>

        {/* Row 1: Lead card → AI Draft */}
        <FadeSlide delay={40} style={{ width: "100%", maxWidth: 800, marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            {/* Lead card (left) */}
            <div
              style={{
                flex: 1,
                background: COLORS.bgCard,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 10,
                padding: 14,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: COLORS.fgDim,
                  marginBottom: 4,
                }}
              >
                Lead
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: COLORS.fg,
                  fontWeight: 500,
                }}
              >
                u/startup_mike in r/SaaS
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: COLORS.fgMuted,
                  marginTop: 4,
                  fontStyle: "italic",
                }}
              >
                "Looking for a better CRM alternative..."
              </div>
            </div>

            {/* Arrow */}
            <div
              style={{
                fontSize: 20,
                color: COLORS.accent,
                opacity: row1Progress,
              }}
            >
              {"→"}
            </div>

            {/* AI Draft (right) */}
            <div
              style={{
                flex: 1,
                background: "rgba(167,139,250,0.06)",
                border: `1px solid rgba(167,139,250,0.2)`,
                borderRadius: 10,
                padding: 14,
                opacity: row1Progress,
                transform: `translateX(${(1 - row1Progress) * 20}px)`,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: COLORS.accent,
                  fontWeight: 600,
                  marginBottom: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {"✨"} AI Draft
              </div>
              <div style={{ fontSize: 12, color: COLORS.fg, lineHeight: 1.5 }}>
                {frame >= 50 && (
                  <TypewriterText
                    text="Hey Mike! Saw your post about CRM tools. We built SuperReddit for..."
                    delay={0}
                    charFrames={1}
                    showCursor={false}
                  />
                )}
              </div>
            </div>
          </div>
        </FadeSlide>

        {/* Row 2: Context → Personalized */}
        <FadeSlide delay={75} style={{ width: "100%", maxWidth: 800, marginBottom: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div
              style={{
                flex: 1,
                background: COLORS.bgCard,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 10,
                padding: 14,
              }}
            >
              <div style={{ fontSize: 11, color: COLORS.fgDim, marginBottom: 4 }}>
                Context
              </div>
              <div style={{ fontSize: 12, color: COLORS.fg }}>
                "Tired of paying so much for outreach tools"
              </div>
            </div>
            <div style={{ fontSize: 20, color: COLORS.accent, opacity: row2Progress }}>
              {"→"}
            </div>
            <div
              style={{
                flex: 1,
                background: "rgba(167,139,250,0.06)",
                border: `1px solid rgba(167,139,250,0.2)`,
                borderRadius: 10,
                padding: 14,
                opacity: row2Progress,
                transform: `translateX(${(1 - row2Progress) * 20}px)`,
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: COLORS.accent,
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                {"✨"} Personalized
              </div>
              <div style={{ fontSize: 12, color: COLORS.fg, lineHeight: 1.5 }}>
                {frame >= 85 && (
                  <TypewriterText
                    text="I hear you on tool costs! We're actually way more affordable and..."
                    delay={0}
                    charFrames={1}
                    showCursor={false}
                  />
                )}
              </div>
            </div>
          </div>
        </FadeSlide>

        {/* Row 3: Batch progress */}
        <FadeSlide delay={110} style={{ width: "100%", maxWidth: 800 }}>
          <div
            style={{
              background: COLORS.bgCard,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 10,
              padding: 18,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: COLORS.fg,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                {"⚡"} Batch Processing
              </div>
              <div style={{ fontSize: 12, color: COLORS.accent, fontWeight: 600 }}>
                {draftsGenerated}/12 drafts generated
              </div>
            </div>
            <div
              style={{
                width: "100%",
                height: 8,
                background: COLORS.bgMuted,
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${row3Progress * 100}%`,
                  height: "100%",
                  background: `linear-gradient(90deg, ${COLORS.accent}, ${COLORS.purple})`,
                  borderRadius: 4,
                }}
              />
            </div>
          </div>
        </FadeSlide>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
