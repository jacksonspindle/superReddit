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

// ── Single odometer digit — only scrolls upward ──
const DIGIT_H = 56;
const OdometerDigit: React.FC<{
  digit: number;
  nextDigit: number;
  fractional: number;
  color: string;
}> = ({ digit, nextDigit, fractional, color }) => {
  const yOffset = -fractional * DIGIT_H;

  return (
    <div style={{ overflow: "hidden", height: DIGIT_H, width: 42, position: "relative" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, transform: `translateY(${yOffset}px)` }}>
        {[digit, nextDigit].map((d, idx) => (
          <div
            key={idx}
            style={{
              height: DIGIT_H,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 48,
              fontWeight: 800,
              color,
              lineHeight: 1,
            }}
          >
            {d}
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Odometer counter — animates whole number upward from→to ──
const OdometerCounter: React.FC<{
  from: number;
  to: number;
  triggerFrame: number;
  spinDuration: number;
  label: string;
  color: string;
  bgColor: string;
  icon: string;
  delay?: number;
}> = ({ from, to, triggerFrame, spinDuration, label, color, bgColor, icon, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const entryScale = spring({
    frame,
    fps,
    delay,
    config: { damping: 15, stiffness: 200 },
  });

  // Animate the whole number from → to (always goes up)
  const rawValue = interpolate(
    frame,
    [triggerFrame, triggerFrame + spinDuration],
    [from, to],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }
  );

  const currentValue = Math.floor(rawValue);
  const fractional = rawValue - currentValue;
  const numDigits = String(to).length;
  const currentStr = String(currentValue).padStart(numDigits, "0");
  const nextStr = String(Math.min(currentValue + 1, to)).padStart(numDigits, "0");

  // Pulse effect at end of spin
  const pulseScale = interpolate(
    frame,
    [triggerFrame + spinDuration - 4, triggerFrame + spinDuration, triggerFrame + spinDuration + 12],
    [1, 1.08, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <div
      style={{
        background: COLORS.bgCard,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 14,
        padding: "22px 24px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        transform: `scale(${entryScale * pulseScale})`,
        transformOrigin: "center",
      }}
    >
      <div
        style={{
          fontSize: 15,
          color: COLORS.fgMuted,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: 0.8,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <span style={{ fontSize: 18 }}>{icon}</span>
        {label}
      </div>
      <div style={{ display: "flex", gap: 2 }}>
        {currentStr.split("").map((d, i) => (
          <OdometerDigit
            key={i}
            digit={Number(d)}
            nextDigit={Number(nextStr[i])}
            fractional={Number(d) !== Number(nextStr[i]) ? fractional : 0}
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
  const { fps } = useVideoConfig();

  // Spring-based slide for fluid motion
  const springProgress = spring({
    frame,
    fps,
    delay,
    config: { damping: 14, stiffness: 220 },
  });

  const slideDown = interpolate(springProgress, [0, 1], [-80, 0]);

  const opacity = interpolate(
    frame,
    [delay, delay + 5, 58, 70],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Slide back up when counters take over
  const exitY = interpolate(frame, [58, 70], [0, -100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Red blinking outline
  const blinkPhase = frame - delay;
  const blinkAlpha = blinkPhase > 0
    ? interpolate(Math.sin(blinkPhase * 0.5), [-1, 1], [0.15, 0.7])
    : 0;

  if (frame < delay) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 24,
        left: "50%",
        transform: `translateX(-50%) translateY(${slideDown + exitY}px)`,
        opacity,
        zIndex: 100,
        width: 860,
        background: "rgba(30,30,30,0.95)",
        backdropFilter: "blur(20px)",
        border: `2px solid rgba(239,68,68,${blinkAlpha})`,
        borderRadius: 24,
        padding: "32px 36px",
        display: "flex",
        alignItems: "center",
        gap: 24,
        boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 20px rgba(239,68,68,${blinkAlpha * 0.4})`,
      }}
    >
      {/* App icon */}
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 18,
          background: `linear-gradient(135deg, ${COLORS.orange}, #ea580c)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 28,
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
            marginBottom: 8,
          }}
        >
          <span style={{ fontSize: 24, fontWeight: 700, color: COLORS.fg }}>
            SuperReddit
          </span>
          <span style={{ fontSize: 16, color: COLORS.fgDim }}>now</span>
        </div>
        <div style={{ fontSize: 22, color: COLORS.fgMuted, lineHeight: 1.5 }}>
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
        borderRadius: 12,
        padding: "18px 20px",
        transform: `translateY(${y}px)`,
        opacity,
        display: "flex",
        gap: 16,
      }}
    >
      {/* Upvote column */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 3,
          minWidth: 44,
        }}
      >
        <span style={{ fontSize: 18, color: COLORS.orange }}>{"▲"}</span>
        <span style={{ fontSize: 17, fontWeight: 700, color: COLORS.fg }}>
          {upvotes}
        </span>
        <span style={{ fontSize: 18, color: COLORS.fgDim }}>{"▽"}</span>
      </div>

      {/* Content */}
      <div style={{ flex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: COLORS.reddit,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 800,
              color: "white",
            }}
          >
            r/
          </div>
          <span style={{ fontSize: 15, fontWeight: 600, color: COLORS.fgMuted }}>
            r/{subreddit}
          </span>
          <span style={{ fontSize: 13, color: COLORS.fgDim }}>{"·"} {time}</span>
          {hot && (
            <span
              style={{
                padding: "3px 10px",
                background: COLORS.hotBg,
                color: COLORS.hot,
                fontSize: 12,
                fontWeight: 700,
                borderRadius: 5,
                marginLeft: "auto",
              }}
            >
              {"🔥"} HOT
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 17,
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
            gap: 20,
            marginTop: 10,
            fontSize: 14,
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

// ── Animated cursor ──
const AnimatedCursor: React.FC<{
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  moveStart: number;
  moveEnd: number;
  clickFrame: number;
}> = ({ startX, startY, endX, endY, moveStart, moveEnd, clickFrame }) => {
  const frame = useCurrentFrame();

  if (frame < moveStart) return null;

  const x = interpolate(frame, [moveStart, moveEnd], [startX, endX], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });
  const y = interpolate(frame, [moveStart, moveEnd], [startY, endY], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });

  // Click pulse
  const clickScale = frame >= clickFrame && frame < clickFrame + 8
    ? interpolate(frame, [clickFrame, clickFrame + 4, clickFrame + 8], [1, 0.7, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })
    : 1;

  // Fade out after click
  const opacity = interpolate(frame, [clickFrame + 15, clickFrame + 25], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        zIndex: 200,
        opacity,
        transform: `scale(${clickScale})`,
        pointerEvents: "none",
      }}
    >
      {/* Cursor SVG */}
      <svg width="24" height="28" viewBox="0 0 24 28" fill="none">
        <path
          d="M5 2L5 20L9.5 15.5L13.5 23L16.5 21.5L12.5 13.5L18 12L5 2Z"
          fill="white"
          stroke="#333"
          strokeWidth="1.5"
        />
      </svg>
      {/* Click ripple */}
      {frame >= clickFrame && frame < clickFrame + 12 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: interpolate(frame, [clickFrame, clickFrame + 12], [8, 40], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            height: interpolate(frame, [clickFrame, clickFrame + 12], [8, 40], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            borderRadius: "50%",
            border: `2px solid ${COLORS.orange}`,
            opacity: interpolate(frame, [clickFrame, clickFrame + 12], [0.8, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            transform: "translate(-50%, -50%)",
          }}
        />
      )}
    </div>
  );
};

// ── Comment reply overlay ──
const CommentReply: React.FC<{
  delay: number;
}> = ({ delay }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const expandProgress = spring({
    frame,
    fps,
    delay,
    config: { damping: 18, stiffness: 160 },
  });

  const height = interpolate(expandProgress, [0, 1], [0, 180]);
  const opacity = interpolate(expandProgress, [0, 0.3], [0, 1]);

  const replyText = "Hey! We actually built a tool specifically for Reddit outreach — handles lead detection, drafting, and sending all in one place. Happy to show you a quick demo if you're interested!";

  // Typewriter effect
  const charsVisible = Math.floor(
    interpolate(frame, [delay + 12, delay + 70], [0, replyText.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    })
  );

  const typedText = replyText.slice(0, charsVisible);
  const showCaret = frame >= delay + 12 && frame < delay + 75;

  if (frame < delay) return null;

  return (
    <div
      style={{
        overflow: "hidden",
        height,
        opacity,
        borderTop: `1px solid ${COLORS.border}`,
        padding: charsVisible > 0 ? "16px 20px" : "0 20px",
      }}
    >
      {/* Reply header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${COLORS.orange}, #ea580c)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            fontWeight: 800,
            color: "white",
          }}
        >
          SR
        </div>
        <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.orange }}>
          u/your_agency
        </span>
        <span style={{ fontSize: 12, color: COLORS.fgDim }}>replying now...</span>
      </div>

      {/* Typed reply */}
      <div
        style={{
          fontSize: 15,
          color: COLORS.fgMuted,
          lineHeight: 1.6,
          paddingLeft: 38,
        }}
      >
        {typedText}
        {showCaret && (
          <span
            style={{
              display: "inline-block",
              width: 2,
              height: 16,
              background: COLORS.orange,
              marginLeft: 2,
              verticalAlign: "text-bottom",
              opacity: Math.sin(frame * 0.4) > 0 ? 1 : 0,
            }}
          />
        )}
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

  // PHASE 1: Headline (frames 0–45) — snappy entrance
  const headlineOpacity = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const headlineY = interpolate(frame, [0, 12], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Headline fades out before counters section takes over
  const headlineFadeOut = interpolate(frame, [42, 58], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // PHASE 2: Counters (frames 55+)
  // PHASE 3: Posts (frames 90+)

  // Counters fade in
  const counterSectionOpacity = interpolate(frame, [69, 84], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Counters start centered, then slide up to top after frame 118
  const countersVerticalY = interpolate(frame, [118, 138], [380, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Posts section fades in after counters move up
  const postsSectionOpacity = interpolate(frame, [138, 152], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
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
            fontSize: 18,
            fontWeight: 600,
            color: COLORS.orange,
            textTransform: "uppercase",
            letterSpacing: 4,
            marginBottom: 24,
            opacity: headlineOpacity,
            transform: `translateY(${headlineY}px)`,
          }}
        >
          {"📡"} Signals
        </div>
        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: COLORS.fg,
            textAlign: "center",
            lineHeight: 1.2,
            maxWidth: 900,
            opacity: headlineOpacity,
            transform: `translateY(${headlineY}px)`,
          }}
        >
          Every Hot Lead, Caught
          <br />
          <span style={{ color: COLORS.orange }}>The Moment They're Looking</span>
        </div>
      </AbsoluteFill>

      {/* Phone notification — drops in at frame 22 */}
      <PhoneNotification delay={22} />

      {/* PHASE 2: Counters — start centered, slide to top */}
      <div
        style={{
          position: "absolute",
          left: 60,
          right: 60,
          top: 16,
          opacity: counterSectionOpacity,
          transform: `translateY(${countersVerticalY}px)`,
        }}
      >
        {/* Headline above counters — fades out as counters move up */}
        <div
          style={{
            fontSize: 44,
            fontWeight: 700,
            color: COLORS.fg,
            textAlign: "center",
            marginBottom: 28,
            opacity: interpolate(frame, [69, 78, 115, 122], [0, 1, 1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          Your Pipeline, <span style={{ color: COLORS.orange }}>Updating Live</span>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 14,
          }}
        >
          <OdometerCounter
            from={4}
            to={12}
            triggerFrame={75}
            spinDuration={38}
            label="Hot Leads"
            color={COLORS.hot}
            bgColor={COLORS.hotBg}
            icon="🔥"
            delay={72}
          />
          <OdometerCounter
            from={26}
            to={34}
            triggerFrame={75}
            spinDuration={38}
            label="Warm Leads"
            color={COLORS.warm}
            bgColor={COLORS.warmBg}
            icon="☀️"
            delay={72}
          />
          <OdometerCounter
            from={12}
            to={19}
            triggerFrame={75}
            spinDuration={38}
            label="Unseen"
            color={COLORS.blue}
            bgColor={COLORS.blueBg}
            icon="👁️"
            delay={72}
          />
          <OdometerCounter
            from={178}
            to={187}
            triggerFrame={75}
            spinDuration={38}
            label="Total"
            color={COLORS.fg}
            bgColor={COLORS.bgMuted}
            icon="📊"
            delay={72}
          />
        </div>
      </div>

      {/* PHASE 3: Posts — appear after counters slide up */}
      <div
        style={{
          position: "absolute",
          left: 60,
          right: 60,
          top: 280,
          bottom: 50,
          opacity: postsSectionOpacity,
          overflow: "hidden",
        }}
      >
        <FadeSlide delay={138} distance={10}>
          <div
            style={{
              fontSize: 17,
              fontWeight: 600,
              color: COLORS.fgDim,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              marginBottom: 16,
            }}
          >
            Latest Signals
          </div>
        </FadeSlide>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {POSTS.map((post, i) => (
            <div key={i}>
              <RedditPost
                {...post}
                delay={148 + i * 12}
              />
              {/* Comment reply expands under the first post after cursor click */}
              {i === 0 && <CommentReply delay={232} />}
            </div>
          ))}
        </div>
      </div>

      {/* Cursor — moves to first post and clicks at frame 228 */}
      <AnimatedCursor
        startX={640}
        startY={600}
        endX={400}
        endY={360}
        moveStart={218}
        moveEnd={228}
        clickFrame={228}
      />
    </AbsoluteFill>
  );
};
