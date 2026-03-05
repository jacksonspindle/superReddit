import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
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

  // Card 1: swipe RIGHT at frame 70
  // Card 2: swipe LEFT at frame 120
  // Card 3: quick swipe RIGHT at frame 165

  const activeCardIndex =
    frame < 82 ? 0 : frame < 132 ? 1 : 2;

  // Progress bar
  const sentCount = frame < 82 ? 0 : frame < 165 ? 1 : 2;
  const totalLeads = 12;

  const progressBarWidth = interpolate(sentCount, [0, totalLeads], [0, 100]);

  // Counter badge
  const counterScale = spring({
    frame: sentCount > 0 ? frame : 0,
    fps,
    delay: sentCount > 0 ? (sentCount === 1 ? 82 : 165) : 99999,
    config: { damping: 12, stiffness: 200 },
  });

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily }}>
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "40px 60px",
        }}
      >
        {/* Header */}
        <FadeSlide delay={0}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 6,
            }}
          >
            <span style={{ fontSize: 24, fontWeight: 700, color: COLORS.fg }}>
              {"💬"} DM Queue
            </span>
            <div
              style={{
                padding: "3px 10px",
                background: COLORS.orangeBg,
                borderRadius: 12,
                fontSize: 12,
                fontWeight: 600,
                color: COLORS.orange,
              }}
            >
              {totalLeads} leads
            </div>
          </div>
        </FadeSlide>

        {/* Progress bar */}
        <FadeSlide delay={8}>
          <div
            style={{
              width: 420,
              marginBottom: 30,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
                color: COLORS.fgDim,
                marginBottom: 6,
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
                height: 4,
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
            width: 420,
            height: 500,
          }}
        >
          {/* Background cards (stack effect) */}
          {activeCardIndex < 2 && (
            <div
              style={{
                position: "absolute",
                top: 12,
                left: 8,
                right: 8,
                height: 400,
                background: COLORS.bgCard,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 16,
                opacity: 0.4,
              }}
            />
          )}
          {activeCardIndex < 1 && (
            <div
              style={{
                position: "absolute",
                top: 24,
                left: 16,
                right: 16,
                height: 400,
                background: COLORS.bgCard,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 16,
                opacity: 0.2,
              }}
            />
          )}

          {/* Active card */}
          <div style={{ position: "absolute", top: 0, left: 0 }}>
            {activeCardIndex === 0 && (
              <SwipeCard
                {...CARDS[0]}
                swipeDirection={frame >= 70 ? "right" : null}
                swipeStartFrame={70}
                delay={15}
              />
            )}
            {activeCardIndex === 1 && (
              <SwipeCard
                {...CARDS[1]}
                swipeDirection={frame >= 120 ? "left" : null}
                swipeStartFrame={120}
                delay={85}
              />
            )}
            {activeCardIndex === 2 && (
              <SwipeCard
                {...CARDS[2]}
                swipeDirection={frame >= 165 ? "right" : null}
                swipeStartFrame={165}
                delay={135}
              />
            )}
          </div>
        </div>

        {/* Action buttons hint */}
        <FadeSlide delay={20} style={{ marginTop: -60 }}>
          <div style={{ display: "flex", gap: 40, alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: COLORS.redBg,
                  border: `2px solid ${COLORS.red}44`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 20,
                  color: COLORS.red,
                }}
              >
                {"✕"}
              </div>
              <span style={{ fontSize: 10, color: COLORS.fgDim }}>Skip</span>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: COLORS.greenBg,
                  border: `2px solid ${COLORS.green}44`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  color: COLORS.green,
                }}
              >
                {"→"}
              </div>
              <span style={{ fontSize: 10, color: COLORS.fgDim }}>Send</span>
            </div>
          </div>
        </FadeSlide>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
