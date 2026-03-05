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
import { COLORS } from "../theme";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

const LEADS = [
  {
    label: "Lead",
    username: "u/startup_mike in r/SaaS",
    quote: "\"Looking for a better CRM alternative...\"",
    draftLabel: "AI Draft",
    draft: "Hey Mike! Saw your post about CRM tools. We built SuperReddit for...",
  },
  {
    label: "Context",
    username: null as string | null,
    quote: "\"Tired of paying so much for outreach tools\"",
    draftLabel: "Personalized",
    draft: "I hear you on tool costs! We're actually way more affordable and...",
  },
];

export const S04SwipeQueue: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Sparkle icon ──
  const iconScale = spring({
    frame,
    fps,
    from: 0,
    to: 1,
    delay: 0,
    config: { damping: 12 },
  });
  const iconOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // ── Headline typing effect ──
  const headlineText = "A Team That Guides You Through Every Step";
  const charsVisible = Math.floor(
    interpolate(frame, [8, 50], [0, headlineText.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );
  const headlineOpacity = interpolate(frame, [5, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cursorVisible = frame < 58 ? true : Math.floor(frame / 8) % 2 === 0;

  // ── Card row timings ──
  const row1Delay = 55;
  const row2Delay = 80;

  // ── Batch processing bar ──
  const batchDelay = 105;
  const batchOpacity = interpolate(frame, [batchDelay, batchDelay + 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const batchProgress = interpolate(
    frame,
    [batchDelay + 15, 210],
    [0, 11 / 12],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.quad),
    }
  );
  const draftsCount = Math.floor(batchProgress * 12);

  return (
    <AbsoluteFill
      style={{
        background: COLORS.bg,
        fontFamily,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 80px",
      }}
    >
      {/* ══ Sparkle Icon ══ */}
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 22,
          background: "linear-gradient(135deg, #a855f7, #7c3aed)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 40,
          marginBottom: 28,
          opacity: iconOpacity,
          transform: `scale(${iconScale})`,
          boxShadow: "0 8px 32px rgba(168,85,247,0.3)",
        }}
      >
        {"✨"}
      </div>

      {/* ══ Headline with typing cursor ══ */}
      <div
        style={{
          fontSize: 58,
          fontWeight: 800,
          color: COLORS.fg,
          textAlign: "center",
          marginBottom: 52,
          opacity: headlineOpacity,
          lineHeight: 1.15,
          maxWidth: 900,
        }}
      >
        {headlineText.slice(0, charsVisible)}
        {cursorVisible && (
          <span
            style={{
              display: "inline-block",
              width: 3,
              height: 54,
              background: COLORS.accent,
              marginLeft: 2,
              verticalAlign: "middle",
              borderRadius: 2,
            }}
          />
        )}
      </div>

      {/* ══ Lead → AI Draft card rows ══ */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 22,
          width: "100%",
          maxWidth: 960,
        }}
      >
        {LEADS.map((lead, i) => {
          const delay = i === 0 ? row1Delay : row2Delay;

          const leftOpacity = interpolate(
            frame,
            [delay, delay + 12],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          const leftX = interpolate(frame, [delay, delay + 12], [-30, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.out(Easing.quad),
          });
          const arrowOpacity = interpolate(
            frame,
            [delay + 8, delay + 18],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          const rightOpacity = interpolate(
            frame,
            [delay + 12, delay + 24],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          const rightX = interpolate(
            frame,
            [delay + 12, delay + 24],
            [30, 0],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.quad),
            }
          );

          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 18,
              }}
            >
              {/* Left card — Lead / Context */}
              <div
                style={{
                  flex: 1,
                  background: COLORS.bgCard,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: 16,
                  padding: 26,
                  opacity: leftOpacity,
                  transform: `translateX(${leftX}px)`,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    color: COLORS.fgDim,
                    marginBottom: 10,
                  }}
                >
                  {lead.label}
                </div>
                {lead.username && (
                  <div
                    style={{
                      fontSize: 19,
                      fontWeight: 700,
                      color: COLORS.fg,
                      marginBottom: 6,
                    }}
                  >
                    {lead.username}
                  </div>
                )}
                <div
                  style={{
                    fontSize: 17,
                    color: COLORS.fgMuted,
                    fontStyle: lead.username ? "italic" : "normal",
                    lineHeight: 1.5,
                  }}
                >
                  {lead.quote}
                </div>
              </div>

              {/* Arrow */}
              <div
                style={{
                  fontSize: 26,
                  color: COLORS.fgDim,
                  opacity: arrowOpacity,
                  flexShrink: 0,
                }}
              >
                {"→"}
              </div>

              {/* Right card — AI Draft / Personalized */}
              <div
                style={{
                  flex: 1,
                  background: "rgba(168,85,247,0.08)",
                  border: "1px solid rgba(168,85,247,0.2)",
                  borderRadius: 16,
                  padding: 26,
                  opacity: rightOpacity,
                  transform: `translateX(${rightX}px)`,
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    color: COLORS.accent,
                    marginBottom: 10,
                    fontWeight: 600,
                  }}
                >
                  {"✨"} {lead.draftLabel}
                </div>
                <div
                  style={{
                    fontSize: 17,
                    color: COLORS.fg,
                    lineHeight: 1.5,
                  }}
                >
                  {lead.draft}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ══ Batch Processing bar ══ */}
      <div
        style={{
          width: "100%",
          maxWidth: 960,
          marginTop: 28,
          background: COLORS.bgCard,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 16,
          padding: "22px 28px",
          opacity: batchOpacity,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.fg }}>
            {"⚡"} Batch Processing
          </div>
          <div style={{ fontSize: 16, color: COLORS.fgMuted }}>
            {draftsCount}/12 drafts generated
          </div>
        </div>
        <div
          style={{
            height: 10,
            borderRadius: 5,
            background: COLORS.bgMuted,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${batchProgress * 100}%`,
              borderRadius: 5,
              background: "linear-gradient(90deg, #7c3aed, #a855f7)",
              transition: "width 0.1s",
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
