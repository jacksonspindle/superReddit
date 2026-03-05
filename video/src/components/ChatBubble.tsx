import React from "react";
import { useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { COLORS } from "../theme";

export const ChatBubble: React.FC<{
  text: string;
  isSent: boolean;
  delay?: number;
  showTyping?: boolean;
  typingDuration?: number;
}> = ({ text, isSent, delay = 0, showTyping = false, typingDuration = 20 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const isVisible = frame >= delay;
  const showTypingIndicator =
    showTyping && frame >= delay && frame < delay + typingDuration;
  const showMessage = showTyping ? frame >= delay + typingDuration : isVisible;

  const scale = spring({
    frame: showMessage ? frame : 0,
    fps,
    delay: showMessage ? delay + (showTyping ? typingDuration : 0) : 99999,
    config: { damping: 15, stiffness: 200 },
  });

  if (!isVisible) return null;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isSent ? "flex-end" : "flex-start",
        marginBottom: 8,
        paddingLeft: isSent ? 60 : 0,
        paddingRight: isSent ? 0 : 60,
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderRadius: isSent ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
          background: isSent ? COLORS.blue : "#2a2a2a",
          color: COLORS.fg,
          fontSize: 12,
          lineHeight: 1.5,
          maxWidth: 280,
          transform: `scale(${showMessage ? scale : 0})`,
          transformOrigin: isSent ? "bottom right" : "bottom left",
        }}
      >
        {showTypingIndicator && !showMessage ? (
          <TypingIndicator frame={frame - delay} />
        ) : (
          text
        )}
      </div>
    </div>
  );
};

const TypingIndicator: React.FC<{ frame: number }> = ({ frame }) => {
  return (
    <div style={{ display: "flex", gap: 4, padding: "4px 8px" }}>
      {[0, 1, 2].map((i) => {
        const opacity = interpolate(
          (frame + i * 5) % 20,
          [0, 10, 20],
          [0.3, 1, 0.3]
        );
        return (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: COLORS.fgMuted,
              opacity,
            }}
          />
        );
      })}
    </div>
  );
};
