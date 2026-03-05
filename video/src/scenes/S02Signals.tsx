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
  weights: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
});

// ── Odometer digit component ──
const OdometerDigit: React.FC<{
  value: number;
  prevValue: number;
  triggerFrame: number;
  color: string;
}> = ({ value, prevValue, triggerFrame, color }) => {
  const frame = useCurrentFrame();

  const rollProgress = interpolate(
    frame,
    [triggerFrame, triggerFrame + 18],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) }
  );

  const yOffset = interpolate(rollProgress, [0, 1], [0, -40]);

  return (
    <div
      style={{
        overflow: "hidden",
        height: 48,
        width: 32,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ position: "absolute", transform: `translateY(${yOffset}px)` }}>
        <div
          style={{
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 36,
            fontWeight: 800,
            color,
            lineHeight: 1,
          }}
        >
          {prevValue}
        </div>
        <div
          style={{
            height: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 36,
            fontWeight: 800,
            color,
            lineHeight: 1,
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
};

// ── Odometer counter (multi-digit) ──
const OdometerCounter: React.FC<{
  from: number;
  to: number;
  triggerFrame: number;
  label: string;
  color: string;
  bgColor: string;
  icon: string;
  delay?: number;
}> = ({ from, to, triggerFrame, label, color, bgColor, icon, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entryScale = spring({
    frame,
    fps,
    delay,
    config: { damping: 15, stiffness: 200 },
  });

  const fromDigits = String(from).split("").map(Number);
  const toDigits = String(to).split("").map(Number);
  // Pad to same length
  while (fromDigits.length < toDigits.length) fromDigits.unshift(0);

  // Pulse effect when counter ticks
  const pulseScale = interpolate(
    frame,
    [triggerFrame, triggerFrame + 6, triggerFrame + 18],
    [1, 1.08, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <div
      style={{
        background: COLORS.bgCard,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 14,
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        transform: `scale(${entryScale * pulseScale})`,
        transformOrigin: "center",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: COLORS.fgMuted,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 0.8,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <span style={{ fontSize: 14 }}>{icon}</span>
        {label}
      </div>
      <div style={{ display: "flex", gap: 2 }}>
        {toDigits.map((digit, i) => (
          <OdometerDigit
            key={i}
            value={digit}
            prevValue={fromDigits[i]}
            triggerFrame={triggerFrame}
            color={color}
          />
        ))}
      </div>
      <div
        style={{
          width: "100%",
          height: 3,
          background: bgColor,
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.min(100, (to / 50) * 100)}%`,
            height: "100%",
            background: color,
            borderRadius: 2,
          }}
        />
      </div>
    </div>
  );
};

// ── Phone notification component ──
const PhoneNotification: React.FC<{
  delay: number;
}> = ({ delay }) => {
  const frame = useCurrentFrame();

  const slideDown = interpolate(
    frame,
    [delay, delay + 12],
    [-100, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.quad) }
  );

  const opacity = interpolate(
    frame,
    [delay, delay + 8, delay + 110, delay + 125],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  if (frame < delay) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 24,
        left: "50%",
        transform: `translateX(-50%) translateY(${slideDown}px)`,
        opacity,
        zIndex: 100,
        width: 420,
        background: "rgba(30,30,30,0.95)",
        backdropFilter: "blur(20px)",
        border: `1px solid rgba(255,255,255,0.12)`,
        borderRadius: 16,
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
      }}
    >
      {/* App icon */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: `linear-gradient(135deg, ${COLORS.orange}, #ea580c)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          fontWeight: 800,
          color: "white",
          flexShrink: 0,
        }}
      >
        SR
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 3,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.fg }}>
            SuperReddit
          </span>
          <span style={{ fontSize: 10, color: COLORS.fgDim }}>now</span>
        </div>
        <div style={{ fontSize: 12, color: COLORS.fgMuted, lineHeight: 1.4 }}>
          {"🔥"} <span style={{ color: COLORS.hot, fontWeight: 600 }}>Hot lead</span>{" "}
          detected in r/SaaS — u/startup_mike is looking for an outreach tool
        </div>
      </div>
    </div>
  );
};

// ── Reddit-style post card ──
const RedditPost: React.FC<{
  subreddit: string;
  title: string;
  upvotes: number;
  comments: number;
  time: string;
  delay: number;
  hot?: boolean;
}> = ({ subreddit, title, upvotes, comments, time, delay, hot }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slideUp = spring({
    frame,
    fps,
    delay,
    config: { damping: 20, stiffness: 180 },
  });

  const y = interpolate(slideUp, [0, 1], [40, 0]);
  const opacity = interpolate(slideUp, [0, 1], [0, 1]);

  return (
    <div
      style={{
        background: COLORS.bgCard,
        border: `1px solid ${hot ? `${COLORS.hot}44` : COLORS.border}`,
        borderRadius: 10,
        padding: "14px 16px",
        transform: `translateY(${y}px)`,
        opacity,
        display: "flex",
        gap: 14,
      }}
    >
      {/* Upvote column */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 2,
          minWidth: 36,
        }}
      >
        <span style={{ fontSize: 14, color: COLORS.orange }}>{"▲"}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.fg }}>
          {upvotes}
        </span>
        <span style={{ fontSize: 14, color: COLORS.fgDim }}>{"▽"}</span>
      </div>

      {/* Content */}
      <div style={{ flex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              width: 20,
              height: 20,
              borderRadius: "50%",
              background: COLORS.reddit,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 9,
              fontWeight: 800,
              color: "white",
            }}
          >
            r/
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.fgMuted }}>
            r/{subreddit}
          </span>
          <span style={{ fontSize: 10, color: COLORS.fgDim }}>{"·"} {time}</span>
          {hot && (
            <span
              style={{
                padding: "2px 8px",
                background: COLORS.hotBg,
                color: COLORS.hot,
                fontSize: 9,
                fontWeight: 700,
                borderRadius: 4,
                marginLeft: "auto",
              }}
            >
              {"🔥"} HOT
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: COLORS.fg,
            lineHeight: 1.5,
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "flex",
            gap: 16,
            marginTop: 8,
            fontSize: 11,
            color: COLORS.fgDim,
          }}
        >
          <span>{"💬"} {comments} comments</span>
          <span>{"↗"} Share</span>
        </div>
      </div>
    </div>
  );
};

// ── Reddit posts data ──
const POSTS = [
  {
    subreddit: "SaaS",
    title: "Looking for a better outreach tool — current one is way too expensive and clunky. Any recommendations?",
    upvotes: 47,
    comments: 23,
    time: "2h ago",
    hot: true,
  },
  {
    subreddit: "marketing",
    title: "Has anyone tried using Reddit DMs for lead gen? Thinking about doing it for my agency",
    upvotes: 31,
    comments: 18,
    time: "4h ago",
    hot: false,
  },
  {
    subreddit: "startups",
    title: "Tired of cold email. Reddit feels more authentic for B2B outreach — am I crazy?",
    upvotes: 89,
    comments: 41,
    time: "5h ago",
    hot: true,
  },
  {
    subreddit: "Entrepreneur",
    title: "Best tool for finding warm leads on Reddit? Getting buried in manual searching",
    upvotes: 24,
    comments: 12,
    time: "8h ago",
    hot: false,
  },
  {
    subreddit: "GrowthHacking",
    title: "We switched from cold email to Reddit outreach and 3x'd our reply rate",
    upvotes: 156,
    comments: 67,
    time: "12h ago",
    hot: false,
  },
];

// ── Main scene ──
export const S02Signals: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // PHASE 1: Headline (frames 0–45)
  const headlineOpacity = interpolate(frame, [0, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const headlineY = interpolate(frame, [0, 25], [30, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Headline fades out before counters section takes over
  const headlineFadeOut = interpolate(frame, [120, 150], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // PHASE 2: Notification + counters (frames 50+)
  // PHASE 3: Posts (frames 180+)

  // Counter section slides up
  const counterSectionOpacity = interpolate(frame, [130, 160], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const counterSectionY = interpolate(frame, [130, 160], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily }}>
      {/* Subtle gradient overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(ellipse at 50% 0%, rgba(239,68,68,0.06) 0%, transparent 60%)",
        }}
      />

      {/* PHASE 1: Big headline */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          opacity: headlineFadeOut,
          padding: 60,
        }}
      >
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: COLORS.orange,
            textTransform: "uppercase",
            letterSpacing: 3,
            marginBottom: 20,
            opacity: headlineOpacity,
            transform: `translateY(${headlineY}px)`,
          }}
        >
          {"📡"} Signals
        </div>
        <div
          style={{
            fontSize: 44,
            fontWeight: 800,
            color: COLORS.fg,
            textAlign: "center",
            lineHeight: 1.2,
            maxWidth: 900,
            opacity: headlineOpacity,
            transform: `translateY(${headlineY}px)`,
          }}
        >
          Know Where Hot Leads Appear
          <br />
          <span style={{ color: COLORS.orange }}>As They Appear</span>
        </div>
      </AbsoluteFill>

      {/* Phone notification — drops in at frame 55 */}
      <PhoneNotification delay={55} />

      {/* PHASE 2: Counters + Posts dashboard */}
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "50px 60px",
          opacity: counterSectionOpacity,
          transform: `translateY(${counterSectionY}px)`,
        }}
      >
        {/* Odometer counters row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 14,
            marginBottom: 24,
          }}
        >
          <OdometerCounter
            from={11}
            to={12}
            triggerFrame={170}
            label="Hot Leads"
            color={COLORS.hot}
            bgColor={COLORS.hotBg}
            icon="🔥"
            delay={140}
          />
          <OdometerCounter
            from={33}
            to={34}
            triggerFrame={175}
            label="Warm Leads"
            color={COLORS.warm}
            bgColor={COLORS.warmBg}
            icon="☀️"
            delay={145}
          />
          <OdometerCounter
            from={19}
            to={19}
            triggerFrame={9999}
            label="Unseen"
            color={COLORS.blue}
            bgColor={COLORS.blueBg}
            icon="👁️"
            delay={150}
          />
          <OdometerCounter
            from={186}
            to={187}
            triggerFrame={178}
            label="Total"
            color={COLORS.fg}
            bgColor={COLORS.bgMuted}
            icon="📊"
            delay={155}
          />
        </div>

        {/* Section label */}
        <FadeSlide delay={190} distance={10}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: COLORS.fgDim,
              textTransform: "uppercase",
              letterSpacing: 1,
              marginBottom: 14,
            }}
          >
            Latest Signals
          </div>
        </FadeSlide>

        {/* Reddit-style posts */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {POSTS.map((post, i) => (
            <RedditPost
              key={i}
              {...post}
              delay={200 + i * 18}
            />
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
