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
import { SwipeCard } from "../components/SwipeCard";
import { FadeSlide } from "../components/FadeSlide";
import { COLORS } from "../theme";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const CARDS = [
  {
    username: "startup_mike",
    subreddit: "SaaS",
    quote:
      "We've been looking for a better outreach tool. Our current one is way too expensive.",
    aiDraft:
      "Hey Mike! I saw your post about outreach tools. We built SuperReddit specifically for Reddit-based lead gen — would love to show you how it works.",
    permissionBadge: "Opted in",
  },
  {
    username: "agency_jess",
    subreddit: "marketing",
    quote:
      "Does anyone know a good tool for finding warm leads on Reddit?",
    aiDraft:
      "Hi Jess! Great question — we actually specialize in exactly this. Happy to share how agencies like yours use SuperReddit.",
    permissionBadge: "Opted in",
  },
  {
    username: "cto_alex",
    subreddit: "startups",
    quote: "Tired of cold email. Reddit feels more authentic for outreach.",
    aiDraft:
      "Totally agree Alex! Reddit outreach has way higher response rates. We've helped 50+ startups do this at scale.",
    permissionBadge: "Engaged",
  },
];

export const S04SwipeQueue: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── PHASE 1: Headline (frames 0–50) ──
  const headlineOpacity = interpolate(frame, [0, 10, 38, 50], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const headlineY = interpolate(frame, [0, 12], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // ── PHASE 2: DM Queue UI (frames 45+) ──
  const uiOpacity = interpolate(frame, [45, 60], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Offset: all card timings shifted +50
  // Card 1: swipe RIGHT at frame 120
  // Card 2: swipe LEFT at frame 170
  // Card 3: quick swipe RIGHT at frame 215

  const activeCardIndex =
    frame < 132 ? 0 : frame < 182 ? 1 : 2;

  // Progress bar
  const sentCount = frame < 132 ? 0 : frame < 215 ? 1 : 2;
  const totalLeads = 12;

  const progressBarWidth = interpolate(sentCount, [0, totalLeads], [0, 100]);

  // Counter badge
  const counterScale = spring({
    frame: sentCount > 0 ? frame : 0,
    fps,
    delay: sentCount > 0 ? (sentCount === 1 ? 132 : 215) : 99999,
    config: { damping: 12, stiffness: 200 },
  });

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily }}>
      {/* ══════ PHASE 1: Headline ══════ */}
      {frame < 55 && (
        <AbsoluteFill
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: headlineOpacity,
            transform: `translateY(${headlineY}px)`,
          }}
        >
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: COLORS.fg,
              textAlign: "center",
              lineHeight: 1.15,
              maxWidth: 900,
            }}
          >
            Quickly Qualify Everyone{" "}
            <span style={{ color: COLORS.accent }}>You Interact With</span>
          </div>
        </AbsoluteFill>
      )}

      {/* ══════ PHASE 2: DM Queue UI ══════ */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "30px 60px",
          opacity: uiOpacity,
        }}
      >
        {/* Header */}
        <FadeSlide delay={50}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              marginBottom: 8,
            }}
          >
            <span style={{ fontSize: 32, fontWeight: 700, color: COLORS.fg }}>
              {"💬"} DM Queue
            </span>
            <div
              style={{
                padding: "5px 14px",
                background: COLORS.orangeBg,
                borderRadius: 14,
                fontSize: 16,
                fontWeight: 600,
                color: COLORS.orange,
              }}
            >
              {totalLeads} leads
            </div>
          </div>
        </FadeSlide>

        {/* Progress bar */}
        <FadeSlide delay={58}>
          <div
            style={{
              width: 700,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 15,
                color: COLORS.fgDim,
                marginBottom: 8,
              }}
            >
              <span>Progress</span>
              <span>
                {sentCount}/{totalLeads} sent
              </span>
            </div>
            <div
              style={{
                width: "100%",
                height: 6,
                background: COLORS.bgMuted,
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progressBarWidth}%`,
                  height: "100%",
                  background: COLORS.green,
                  borderRadius: 4,
                }}
              />
            </div>
          </div>
        </FadeSlide>

        {/* Card stack */}
        <div
          style={{
            position: "relative",
            width: 700,
            height: 580,
          }}
        >
          {/* Background cards (stack effect) */}
          {activeCardIndex < 2 && (
            <div
              style={{
                position: "absolute",
                top: 14,
                left: 10,
                right: 10,
                height: 500,
                background: COLORS.bgCard,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 20,
                opacity: 0.4,
              }}
            />
          )}
          {activeCardIndex < 1 && (
            <div
              style={{
                position: "absolute",
                top: 28,
                left: 20,
                right: 20,
                height: 500,
                background: COLORS.bgCard,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 20,
                opacity: 0.2,
              }}
            />
          )}

          {/* Active card */}
          <div style={{ position: "absolute", top: 0, left: 0 }}>
            {activeCardIndex === 0 && (
              <SwipeCard
                {...CARDS[0]}
                swipeDirection={frame >= 120 ? "right" : null}
                swipeStartFrame={120}
                delay={65}
              />
            )}
            {activeCardIndex === 1 && (
              <SwipeCard
                {...CARDS[1]}
                swipeDirection={frame >= 170 ? "left" : null}
                swipeStartFrame={170}
                delay={135}
              />
            )}
            {activeCardIndex === 2 && (
              <SwipeCard
                {...CARDS[2]}
                swipeDirection={frame >= 215 ? "right" : null}
                swipeStartFrame={215}
                delay={185}
              />
            )}
          </div>
        </div>

        {/* Action buttons */}
        <FadeSlide delay={70} style={{ marginTop: -40 }}>
          <div style={{ display: "flex", gap: 60, alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: "50%",
                  background: COLORS.redBg,
                  border: `2px solid ${COLORS.red}44`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                  color: COLORS.red,
                }}
              >
                {"✕"}
              </div>
              <span style={{ fontSize: 14, color: COLORS.fgDim }}>Skip</span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  background: COLORS.greenBg,
                  border: `2px solid ${COLORS.green}44`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 32,
                  color: COLORS.green,
                }}
              >
                {"→"}
              </div>
              <span style={{ fontSize: 14, color: COLORS.fgDim }}>Send</span>
            </div>
          </div>
        </FadeSlide>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
