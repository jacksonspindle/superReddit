import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/Inter";
import { MockBrowser } from "../components/MockBrowser";
import { StatCounter } from "../components/StatCounter";
import { NotificationToast } from "../components/NotificationToast";
import { FadeSlide } from "../components/FadeSlide";
import { GlowBadge } from "../components/GlowBadge";
import { COLORS } from "../theme";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const NAV_ITEMS = [
  { label: "Dashboard", active: false },
  { label: "Signals", active: true },
  { label: "Alerts", active: false },
  { label: "DM Queue", active: false },
  { label: "Pipeline", active: false },
];

const SIGNAL_CARDS = [
  {
    user: "startup_mike",
    sub: "r/SaaS",
    text: "Looking for a better CRM alternative...",
    intent: "Solution Seeking",
    intentColor: COLORS.hot,
    temp: "Hot",
  },
  {
    user: "growth_hacker99",
    sub: "r/marketing",
    text: "We switched from X and need something new",
    intent: "Comparing",
    intentColor: COLORS.warm,
    temp: "Warm",
  },
  {
    user: "devops_sarah",
    sub: "r/startups",
    text: "Tired of paying so much for outreach tools",
    intent: "Pain Point",
    intentColor: COLORS.orange,
    temp: "Hot",
  },
  {
    user: "agency_owner",
    sub: "r/Entrepreneur",
    text: "Best tool for finding Reddit leads?",
    intent: "Solution Seeking",
    intentColor: COLORS.hot,
    temp: "Warm",
  },
];

export const S02Signals: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const Sidebar = (
    <div style={{ padding: "12px 10px", fontFamily }}>
      <div
        style={{
          padding: "10px 12px",
          borderBottom: `1px solid ${COLORS.border}`,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: COLORS.fg,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              width: 24,
              height: 24,
              background: `linear-gradient(135deg, ${COLORS.orange}, #ea580c)`,
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 10,
              fontWeight: 800,
              color: "white",
            }}
          >
            SR
          </span>
          SuperReddit
        </div>
      </div>
      {NAV_ITEMS.map((item, i) => (
        <div
          key={i}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 500,
            color: item.active ? COLORS.fg : COLORS.fgDim,
            background: item.active ? COLORS.bgMuted : "transparent",
            marginBottom: 2,
          }}
        >
          {item.label}
        </div>
      ))}
    </div>
  );

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily }}>
      <MockBrowser url="app.superreddit.co/signals" sidebar={Sidebar}>
        <div style={{ padding: 20 }}>
          {/* Header */}
          <FadeSlide delay={0}>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: COLORS.fg,
                marginBottom: 16,
              }}
            >
              {"📡"} Signals Dashboard
            </div>
          </FadeSlide>

          {/* Stat cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 10,
              marginBottom: 20,
            }}
          >
            <StatCounter
              label="Hot"
              value={12}
              color={COLORS.hot}
              bgColor={COLORS.hotBg}
              delay={10}
              icon="🔥"
            />
            <StatCounter
              label="Warm"
              value={34}
              color={COLORS.warm}
              bgColor={COLORS.warmBg}
              delay={15}
              icon="☀️"
            />
            <StatCounter
              label="Unseen"
              value={19}
              color={COLORS.blue}
              bgColor={COLORS.blueBg}
              delay={20}
              icon="👁️"
            />
            <StatCounter
              label="Total"
              value={187}
              color={COLORS.fg}
              bgColor={COLORS.bgMuted}
              delay={25}
              icon="📊"
            />
          </div>

          {/* Signal cards 2x2 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 10,
            }}
          >
            {SIGNAL_CARDS.map((card, i) => (
              <FadeSlide key={i} delay={50 + i * 12} distance={15}>
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
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          background: `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.blue})`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 11,
                          fontWeight: 700,
                          color: "white",
                        }}
                      >
                        {card.user[0].toUpperCase()}
                      </div>
                      <div>
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: COLORS.fg,
                          }}
                        >
                          u/{card.user}
                        </div>
                        <div
                          style={{ fontSize: 10, color: COLORS.fgDim }}
                        >
                          {card.sub}
                        </div>
                      </div>
                    </div>
                    <GlowBadge
                      text={card.temp}
                      color={card.temp === "Hot" ? COLORS.hot : COLORS.warm}
                      bgColor={
                        card.temp === "Hot" ? COLORS.hotBg : COLORS.warmBg
                      }
                    />
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: COLORS.fgMuted,
                      lineHeight: 1.5,
                      marginBottom: 8,
                    }}
                  >
                    {card.text}
                  </div>
                  <div
                    style={{
                      display: "inline-flex",
                      padding: "2px 8px",
                      background: `${card.intentColor}18`,
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 600,
                      color: card.intentColor,
                    }}
                  >
                    {card.intent}
                  </div>
                </div>
              </FadeSlide>
            ))}
          </div>
        </div>

        {/* Toast */}
        <NotificationToast
          text='New hot lead detected in r/SaaS'
          delay={140}
          icon="🔥"
          color={COLORS.hot}
        />
      </MockBrowser>
    </AbsoluteFill>
  );
};
