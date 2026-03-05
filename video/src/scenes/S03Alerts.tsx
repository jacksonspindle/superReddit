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

// ── Data ──

const KEYWORDS = [
  { phrase: '"alternative to"', count: 23, active: true },
  { phrase: '"best tool for"', count: 18, active: false },
  { phrase: '"tired of using"', count: 9, active: false },
  { phrase: '"looking for"', count: 15, active: false },
];

const POSTS = [
  {
    sub: "r/SaaS",
    title: 'Looking for an alternative to Zendesk that doesn\'t cost a fortune',
    body: "Small biz with 3 support agents. Zendesk wants $89/agent/month which is wild for our volume.",
    time: "1h ago",
    upvotes: 142,
    comments: 47,
    keyword: "alternative to",
  },
  {
    sub: "r/smallbusiness",
    title: 'Any good alternative to Calendly for scheduling?',
    body: "Free tier is too limited and the paid plans are pricey for a solo consultant.",
    time: "2h ago",
    upvotes: 67,
    comments: 28,
    keyword: "alternative to",
  },
  {
    sub: "r/startups",
    title: 'Need an alternative to Asana — their pricing is insane now',
    body: "We're a 12-person agency. Asana wants us on Business tier at $25/user/month just for timeline view.",
    time: "4h ago",
    upvotes: 45,
    comments: 19,
    keyword: "alternative to",
  },
  {
    sub: "r/webdev",
    title: 'Free alternative to Figma for solo designers?',
    body: "Now that Figma is pushing teams pricing, I need something for personal projects. Penpot looks promising.",
    time: "6h ago",
    upvotes: 112,
    comments: 41,
    keyword: "alternative to",
  },
  {
    sub: "r/SaaS",
    title: 'Open source alternative to Intercom for customer chat?',
    body: "We're bootstrapped and paying $74/mo for Intercom is eating our runway.",
    time: "8h ago",
    upvotes: 89,
    comments: 36,
    keyword: "alternative to",
  },
  {
    sub: "r/SEO",
    title: 'Cheap alternative to Ahrefs for SEO research?',
    body: "I'm a freelancer and can't justify $99/mo for Ahrefs. Mainly need keyword research and backlink checking.",
    time: "12h ago",
    upvotes: 71,
    comments: 29,
    keyword: "alternative to",
  },
];

// ── Highlight keyword in text ──
const highlightKeyword = (text: string, keyword: string) => {
  const parts = text.split(new RegExp(`(${keyword})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === keyword.toLowerCase() ? (
      <span
        key={i}
        style={{
          background: COLORS.orangeBg,
          color: COLORS.orange,
          padding: "1px 4px",
          borderRadius: 3,
          fontWeight: 600,
        }}
      >
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
};

// ── iPhone Mockup ──
const IPhoneMockup: React.FC<{
  children: React.ReactNode;
  opacity: number;
  scale: number;
  y: number;
}> = ({ children, opacity, scale, y }) => {
  return (
    <div
      style={{
        position: "absolute",
        right: 80,
        top: "50%",
        transform: `translateY(-50%) translateY(${y}px) scale(${scale})`,
        opacity,
        width: 440,
        height: 900,
        borderRadius: 60,
        background: "#1a1a1a",
        border: "3px solid #333",
        boxShadow:
          "0 40px 100px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05), inset 0 0 0 1px rgba(255,255,255,0.03)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Dynamic Island */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          paddingTop: 14,
          paddingBottom: 10,
        }}
      >
        <div
          style={{
            width: 130,
            height: 34,
            borderRadius: 20,
            background: "#000",
          }}
        />
      </div>

      {/* Screen area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: "0 16px",
          position: "relative",
        }}
      >
        {/* Lock screen time */}
        <div
          style={{
            textAlign: "center",
            paddingTop: 44,
            paddingBottom: 10,
          }}
        >
          <div
            style={{
              fontSize: 76,
              fontWeight: 700,
              color: COLORS.fg,
              letterSpacing: -2,
              lineHeight: 1,
            }}
          >
            9:41
          </div>
          <div
            style={{
              fontSize: 18,
              color: COLORS.fgMuted,
              marginTop: 6,
            }}
          >
            Wednesday, March 5
          </div>
        </div>

        {children}
      </div>

      {/* Home indicator */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          paddingBottom: 10,
          paddingTop: 6,
        }}
      >
        <div
          style={{
            width: 150,
            height: 5,
            borderRadius: 3,
            background: "rgba(255,255,255,0.2)",
          }}
        />
      </div>
    </div>
  );
};

// ── Notification messages ──
const NOTIFICATIONS = [
  { keyword: "alternative to", sub: "r/SaaS", delay: 25 },
  { keyword: "best tool for", sub: "r/startups", delay: 42 },
  { keyword: "tired of using", sub: "r/entrepreneur", delay: 57 },
];

// ── Lock Screen Notification ──
const LockScreenNotification: React.FC<{
  slideDelay: number;
  keyword: string;
  sub: string;
}> = ({ slideDelay, keyword, sub }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const springProgress = spring({
    frame,
    fps,
    delay: slideDelay,
    config: { damping: 14, stiffness: 220 },
  });

  const slideDown = interpolate(springProgress, [0, 1], [-60, 0]);
  const opacity = interpolate(frame, [slideDelay, slideDelay + 5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Red blinking outline
  const blinkPhase = frame - slideDelay;
  const blinkAlpha =
    blinkPhase > 0
      ? interpolate(Math.sin(blinkPhase * 0.5), [-1, 1], [0.15, 0.7])
      : 0;

  if (frame < slideDelay) return null;

  return (
    <div
      style={{
        transform: `translateY(${slideDown}px)`,
        opacity,
        marginTop: 10,
        background: "rgba(40,40,40,0.92)",
        backdropFilter: "blur(20px)",
        border: `1.5px solid rgba(239,68,68,${blinkAlpha})`,
        borderRadius: 20,
        padding: "14px 14px",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        boxShadow: `0 8px 30px rgba(0,0,0,0.4), 0 0 12px rgba(239,68,68,${blinkAlpha * 0.3})`,
      }}
    >
      {/* App icon */}
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 11,
          background: `linear-gradient(135deg, ${COLORS.orange}, #ea580c)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 14,
          fontWeight: 800,
          color: "white",
          flexShrink: 0,
        }}
      >
        SR
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 4,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: COLORS.fg,
            }}
          >
            SuperReddit
          </span>
          <span style={{ fontSize: 11, color: COLORS.fgDim }}>now</span>
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: COLORS.fgMuted,
            lineHeight: 1.45,
          }}
        >
          {"🔥"}{" "}
          <span style={{ color: COLORS.orange, fontWeight: 600 }}>
            Keyword match:
          </span>{" "}
          "{keyword}" found in {sub}
        </div>
      </div>
    </div>
  );
};

// ── Animated cursor (same as S02) ──
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

  const clickScale =
    frame >= clickFrame && frame < clickFrame + 8
      ? interpolate(
          frame,
          [clickFrame, clickFrame + 4, clickFrame + 8],
          [1, 0.7, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        )
      : 1;

  const opacity = interpolate(
    frame,
    [clickFrame + 15, clickFrame + 25],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

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
      <svg width="24" height="28" viewBox="0 0 24 28" fill="none">
        <path
          d="M5 2L5 20L9.5 15.5L13.5 23L16.5 21.5L12.5 13.5L18 12L5 2Z"
          fill="white"
          stroke="#333"
          strokeWidth="1.5"
        />
      </svg>
      {frame >= clickFrame && frame < clickFrame + 12 && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: interpolate(
              frame,
              [clickFrame, clickFrame + 12],
              [8, 40],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            ),
            height: interpolate(
              frame,
              [clickFrame, clickFrame + 12],
              [8, 40],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            ),
            borderRadius: "50%",
            border: `2px solid ${COLORS.accent}`,
            opacity: interpolate(
              frame,
              [clickFrame, clickFrame + 12],
              [0.8, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            ),
            transform: "translate(-50%, -50%)",
          }}
        />
      )}
    </div>
  );
};

// ── Main Scene ──
export const S03Alerts: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ====== PHASE 1: Headline + iPhone (frames 0–85) ======

  // Headline: fade in 0–10, hold, fade out 72–83
  const headlineOpacity = interpolate(frame, [0, 10, 72, 83], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const headlineY = interpolate(frame, [0, 12], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // iPhone: fade in at 10, fade/slide out 72–85
  const phoneIn = spring({
    frame,
    fps,
    delay: 10,
    config: { damping: 18, stiffness: 160 },
  });
  const phoneScale = interpolate(phoneIn, [0, 1], [0.9, 1]);
  const phoneEntryOpacity = interpolate(phoneIn, [0, 1], [0, 1]);

  const phoneExitOpacity = interpolate(frame, [72, 85], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const phoneExitY = interpolate(frame, [72, 85], [0, 40], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.in(Easing.quad),
  });

  const phoneOpacity = phoneEntryOpacity * phoneExitOpacity;

  // ====== PHASE 2: Keywords Alerts Page (frames 75–255) ======

  // Page section fades in
  const pageSectionOpacity = interpolate(frame, [78, 95], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Keyword strip staggers in
  const keywordStripSlide = interpolate(frame, [80, 100], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Click animation on "alternative to" at frame ~100
  const clickProgress = interpolate(frame, [98, 108], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Post grid fades in after click
  const gridOpacity = interpolate(frame, [108, 125], [0, 1], {
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
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(167,139,250,0.05) 0%, transparent 60%)",
        }}
      />

      {/* ══════ PHASE 1: Headline + iPhone ══════ */}

      {/* Headline — left side */}
      {frame < 85 && (
        <div
          style={{
            position: "absolute",
            left: 70,
            top: "50%",
            transform: `translateY(-50%) translateY(${headlineY}px)`,
            opacity: headlineOpacity,
            zIndex: 10,
            maxWidth: 680,
          }}
        >
          <div
            style={{
              fontSize: 84,
              fontWeight: 800,
              color: COLORS.fg,
              lineHeight: 1.15,
            }}
          >
            Get Notified When Users Use{" "}
            <span style={{ color: COLORS.accent }}>Specific Keywords</span>
          </div>
        </div>
      )}

      {/* iPhone with stacked lock screen notifications */}
      {frame < 90 && (
        <IPhoneMockup
          opacity={phoneOpacity}
          scale={phoneScale}
          y={phoneExitY + 30}
        >
          {NOTIFICATIONS.map((notif, i) => (
            <LockScreenNotification
              key={i}
              slideDelay={notif.delay}
              keyword={notif.keyword}
              sub={notif.sub}
            />
          ))}
        </IPhoneMockup>
      )}

      {/* ══════ PHASE 2: Keywords Alerts Page ══════ */}
      {frame >= 75 && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            padding: "28px 40px",
            opacity: pageSectionOpacity,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Page header */}
          <FadeSlide delay={80} distance={15}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 700,
                  color: COLORS.fg,
                }}
              >
                {"🔔"} Keyword Alerts
              </div>
              <div
                style={{
                  fontSize: 16,
                  color: COLORS.fgMuted,
                }}
              >
                Monitoring <span style={{ color: COLORS.accent, fontWeight: 600 }}>4 keywords</span> across Reddit
              </div>
            </div>
          </FadeSlide>

          {/* Keyword pill strip */}
          <div
            style={{
              display: "flex",
              gap: 12,
              marginBottom: 10,
              transform: `translateY(${keywordStripSlide}px)`,
              opacity: interpolate(frame, [80, 95], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
            }}
          >
            {KEYWORDS.map((kw, i) => {
              const isActive = kw.active;
              const isClicked = isActive && clickProgress > 0;
              const staggerDelay = 82 + i * 4;
              const pillSpring = spring({
                frame,
                fps,
                delay: staggerDelay,
                config: { damping: 20, stiffness: 200 },
              });

              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    padding: "16px 20px",
                    background: isActive
                      ? "linear-gradient(135deg, rgba(167,139,250,0.05), transparent)"
                      : COLORS.surface,
                    border: `1px solid ${isActive ? "rgba(167,139,250,0.25)" : COLORS.border}`,
                    borderRadius: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    position: "relative",
                    opacity: interpolate(pillSpring, [0, 1], [0, 1]),
                    transform: `translateY(${interpolate(pillSpring, [0, 1], [15, 0])}px) scale(${
                      isClicked
                        ? interpolate(
                            clickProgress,
                            [0, 0.5, 1],
                            [1, 0.96, 1]
                          )
                        : 1
                    })`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 600,
                      color: COLORS.fg,
                    }}
                  >
                    {kw.phrase}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 28,
                        fontWeight: 700,
                        color: isActive ? COLORS.accent : COLORS.fg,
                      }}
                    >
                      {kw.count}
                    </div>
                    <div style={{ fontSize: 13, color: COLORS.fgDim }}>
                      catches
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div
                    style={{
                      width: "100%",
                      height: 4,
                      background: COLORS.bgMuted,
                      borderRadius: 2,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${(kw.count / 23) * 100}%`,
                        height: "100%",
                        background: isActive ? COLORS.accent : COLORS.fgDim,
                        borderRadius: 2,
                      }}
                    />
                  </div>
                  {/* Active underline */}
                  {isActive && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: -1,
                        left: "20%",
                        right: "20%",
                        height: 3,
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

          {/* Filter context */}
          <FadeSlide delay={100} distance={8}>
            <div
              style={{
                fontSize: 15,
                color: COLORS.fgMuted,
                marginBottom: 10,
              }}
            >
              Showing{" "}
              <span style={{ color: COLORS.fg, fontWeight: 600 }}>
                23 posts
              </span>{" "}
              matching "
              <span style={{ color: COLORS.accent, fontWeight: 600 }}>
                alternative to
              </span>
              "
            </div>
          </FadeSlide>

          {/* Post grid — 3 columns, fills remaining space */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gridTemplateRows: "1fr 1fr",
              gap: 12,
              opacity: gridOpacity,
              flex: 1,
            }}
          >
            {POSTS.map((post, i) => (
              <FadeSlide key={i} delay={112 + i * 5} distance={10} style={{ display: "flex" }}>
                <div
                  style={{
                    background: COLORS.surface,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: 14,
                    padding: "18px 20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    flex: 1,
                  }}
                >
                  {/* Title with highlighted keyword */}
                  <div
                    style={{
                      fontSize: 17,
                      fontWeight: 500,
                      color: COLORS.fg,
                      lineHeight: 1.4,
                    }}
                  >
                    {highlightKeyword(post.title, post.keyword)}
                  </div>

                  {/* Body preview */}
                  <div
                    style={{
                      fontSize: 14,
                      color: COLORS.fgDim,
                      lineHeight: 1.5,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {post.body}
                  </div>

                  {/* Meta row */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13,
                      color: COLORS.fgDim,
                    }}
                  >
                    <span
                      style={{
                        color: COLORS.fgMuted,
                        fontWeight: 500,
                      }}
                    >
                      {post.sub}
                    </span>
                    <span style={{ color: COLORS.border }}>{"·"}</span>
                    <span>{post.comments} comments</span>
                    <span style={{ color: COLORS.border }}>{"·"}</span>
                    <span>{post.time}</span>
                  </div>

                  {/* Footer */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingTop: 10,
                      borderTop: "1px solid rgba(255,255,255,0.03)",
                      fontSize: 13,
                      color: COLORS.fgDim,
                      marginTop: "auto",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                      }}
                    >
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          color:
                            post.upvotes >= 80 ? COLORS.orange : COLORS.fgDim,
                          fontWeight: post.upvotes >= 80 ? 600 : 400,
                        }}
                      >
                        {"▲"} {post.upvotes}
                      </span>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        {"💬"} {post.comments}
                      </span>
                    </div>
                    <span
                      style={{
                        padding: "2px 10px",
                        borderRadius: 5,
                        background: COLORS.accentBg,
                        color: COLORS.accent,
                        fontWeight: 500,
                        fontSize: 12,
                      }}
                    >
                      {post.keyword}
                    </span>
                  </div>
                </div>
              </FadeSlide>
            ))}
          </div>
        </div>
      )}

      {/* Cursor — clicks on "alternative to" keyword pill */}
      <AnimatedCursor
        startX={640}
        startY={500}
        endX={200}
        endY={195}
        moveStart={90}
        moveEnd={100}
        clickFrame={100}
      />
    </AbsoluteFill>
  );
};
