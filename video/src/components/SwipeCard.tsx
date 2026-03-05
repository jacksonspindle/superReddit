import React from "react";
import { useCurrentFrame, interpolate, Easing } from "remotion";
import { COLORS } from "../theme";

export const SwipeCard: React.FC<{
  username: string;
  subreddit: string;
  quote: string;
  aiDraft: string;
  swipeDirection: "left" | "right" | null;
  swipeStartFrame: number;
  delay?: number;
  permissionBadge?: string;
}> = ({
  username,
  subreddit,
  quote,
  aiDraft,
  swipeDirection,
  swipeStartFrame,
  delay = 0,
  permissionBadge = "Opted in",
}) => {
  const frame = useCurrentFrame();

  // Entry animation
  const entryProgress = interpolate(frame, [delay, delay + 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.quad),
  });

  // Swipe animation
  let swipeX = 0;
  let swipeRotation = 0;
  let swipeOpacity = 1;
  let overlayOpacity = 0;

  if (swipeDirection && frame >= swipeStartFrame) {
    const swipeProgress = interpolate(
      frame,
      [swipeStartFrame, swipeStartFrame + 12],
      [0, 1],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.quad) }
    );

    const direction = swipeDirection === "right" ? 1 : -1;
    swipeX = direction * swipeProgress * 800;
    swipeRotation = direction * swipeProgress * 12;
    swipeOpacity = interpolate(swipeProgress, [0.5, 1], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    overlayOpacity = interpolate(swipeProgress, [0, 0.5], [0, 0.8], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
  }

  return (
    <div
      style={{
        width: 420,
        background: COLORS.bgCard,
        border: `1px solid ${COLORS.borderStrong}`,
        borderRadius: 16,
        padding: 24,
        transform: `translateX(${swipeX}px) rotate(${swipeRotation}deg) scale(${entryProgress})`,
        opacity: swipeOpacity * entryProgress,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Swipe overlay */}
      {swipeDirection && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              swipeDirection === "right"
                ? `rgba(34, 197, 94, ${overlayOpacity * 0.3})`
                : `rgba(239, 68, 68, ${overlayOpacity * 0.3})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
            borderRadius: 16,
          }}
        >
          <div
            style={{
              fontSize: 32,
              fontWeight: 800,
              color: swipeDirection === "right" ? COLORS.green : COLORS.red,
              opacity: overlayOpacity,
              letterSpacing: 4,
            }}
          >
            {swipeDirection === "right" ? "SEND" : "SKIP"}
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: "50%",
            background: `linear-gradient(135deg, ${COLORS.orange}, ${COLORS.purple})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            fontWeight: 700,
            color: "white",
          }}
        >
          {username[0].toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.fg }}>
            u/{username}
          </div>
          <div style={{ fontSize: 11, color: COLORS.fgDim }}>r/{subreddit}</div>
        </div>
        <div
          style={{
            padding: "3px 8px",
            background: COLORS.greenBg,
            color: COLORS.green,
            fontSize: 10,
            fontWeight: 600,
            borderRadius: 6,
          }}
        >
          {permissionBadge}
        </div>
      </div>

      {/* Quote */}
      <div
        style={{
          padding: 12,
          background: COLORS.bgMuted,
          borderRadius: 8,
          borderLeft: `3px solid ${COLORS.orange}`,
          fontSize: 12,
          color: COLORS.fgMuted,
          lineHeight: 1.5,
          marginBottom: 14,
        }}
      >
        "{quote}"
      </div>

      {/* AI Draft */}
      <div style={{ marginBottom: 4 }}>
        <div
          style={{
            fontSize: 10,
            color: COLORS.accent,
            fontWeight: 600,
            marginBottom: 6,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {"✨"} AI Draft
        </div>
        <div
          style={{
            padding: 12,
            background: "rgba(167,139,250,0.06)",
            border: `1px solid rgba(167,139,250,0.15)`,
            borderRadius: 8,
            fontSize: 12,
            color: COLORS.fg,
            lineHeight: 1.5,
          }}
        >
          {aiDraft}
        </div>
      </div>
    </div>
  );
};
