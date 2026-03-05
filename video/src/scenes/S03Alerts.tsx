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
import { FadeSlide } from "../components/FadeSlide";
import { COLORS } from "../theme";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const KEYWORDS = [
  { phrase: '"alternative to"', count: 23, active: false },
  { phrase: '"best tool for"', count: 18, active: true },
  { phrase: '"tired of using"', count: 9, active: false },
  { phrase: '"recommend a"', count: 15, active: false },
];

const POSTS = [
  {
    sub: "r/SaaS",
    title: "What's the best tool for finding Reddit leads?",
    time: "2h ago",
    score: 23,
  },
  {
    sub: "r/marketing",
    title: "Need the best tool for outreach automation",
    time: "4h ago",
    score: 15,
  },
  {
    sub: "r/startups",
    title: "Best tool for managing DM campaigns?",
    time: "5h ago",
    score: 31,
  },
  {
    sub: "r/Entrepreneur",
    title: "Looking for the best tool for lead gen on Reddit",
    time: "6h ago",
    score: 12,
  },
  {
    sub: "r/sales",
    title: "Is there a best tool for Reddit prospecting?",
    time: "8h ago",
    score: 19,
  },
  {
    sub: "r/GrowthHacking",
    title: "Best tool for social selling on Reddit?",
    time: "12h ago",
    score: 8,
  },
];

const highlightKeyword = (text: string, keyword: string) => {
  const parts = text.split(new RegExp(`(${keyword})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === keyword.toLowerCase() ? (
      <span
        key={i}
        style={{
          background: `${COLORS.orange}33`,
          color: COLORS.orange,
          padding: "1px 3px",
          borderRadius: 3,
        }}
      >
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
};

export const S03Alerts: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Keyword strip slides in
  const stripSlide = interpolate(frame, [0, 25], [60, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });
  const stripOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Click animation on "best tool for" keyword at frame 60
  const clickProgress = interpolate(frame, [55, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Post grid fades in after click
  const gridOpacity = interpolate(frame, [70, 90], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily, padding: 50 }}>
      {/* Header */}
      <FadeSlide delay={0}>
        <div
          style={{
            fontSize: 24,
            fontWeight: 700,
            color: COLORS.fg,
            marginBottom: 6,
          }}
        >
          {"🔔"} Keyword Alerts
        </div>
        <div
          style={{
            fontSize: 14,
            color: COLORS.fgMuted,
            marginBottom: 28,
          }}
        >
          Monitor Reddit for your target keywords in real-time
        </div>
      </FadeSlide>

      {/* Keyword strip */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 28,
          transform: `translateY(${stripSlide}px)`,
          opacity: stripOpacity,
        }}
      >
        {KEYWORDS.map((kw, i) => {
          const isClicked = kw.active && clickProgress > 0;
          return (
            <div
              key={i}
              style={{
                flex: 1,
                padding: "14px 16px",
                background: isClicked
                  ? `linear-gradient(135deg, rgba(167,139,250,0.05), transparent)`
                  : COLORS.surface,
                border: `1px solid ${isClicked ? "rgba(167,139,250,0.25)" : COLORS.border}`,
                borderRadius: 12,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                position: "relative",
                transform: isClicked ? `scale(${interpolate(clickProgress, [0, 0.5, 1], [1, 0.96, 1])})` : "none",
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: COLORS.fg,
                }}
              >
                {kw.phrase}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: isClicked ? COLORS.accent : COLORS.fg,
                  }}
                >
                  {kw.count}
                </div>
                <div style={{ fontSize: 10, color: COLORS.fgDim }}>matches</div>
              </div>
              {isClicked && (
                <div
                  style={{
                    position: "absolute",
                    bottom: -1,
                    left: "20%",
                    right: "20%",
                    height: 2,
                    background: COLORS.accent,
                    borderRadius: 2,
                    opacity: clickProgress,
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Post grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 10,
          opacity: gridOpacity,
        }}
      >
        {POSTS.map((post, i) => (
          <FadeSlide key={i} delay={75 + i * 8} distance={10}>
            <div
              style={{
                background: COLORS.bgCard,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 10,
                padding: 14,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: COLORS.accent,
                    fontWeight: 600,
                  }}
                >
                  {post.sub}
                </div>
                <div style={{ fontSize: 10, color: COLORS.fgDim }}>
                  {post.time}
                </div>
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: COLORS.fg,
                  lineHeight: 1.5,
                  fontWeight: 500,
                }}
              >
                {highlightKeyword(post.title, "best tool for")}
              </div>
              <div
                style={{
                  marginTop: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 10, color: COLORS.orange }}>
                  {"▲"} {post.score}
                </span>
              </div>
            </div>
          </FadeSlide>
        ))}
      </div>
    </AbsoluteFill>
  );
};
