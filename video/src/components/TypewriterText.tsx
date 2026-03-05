import React from "react";
import { useCurrentFrame, interpolate } from "remotion";

const getTypedText = (
  frame: number,
  text: string,
  charFrames: number
): string => {
  const chars = Math.min(text.length, Math.floor(frame / charFrames));
  return text.slice(0, chars);
};

export const TypewriterText: React.FC<{
  text: string;
  charFrames?: number;
  delay?: number;
  style?: React.CSSProperties;
  cursorColor?: string;
  showCursor?: boolean;
}> = ({
  text,
  charFrames = 2,
  delay = 0,
  style,
  cursorColor = "#f97316",
  showCursor = true,
}) => {
  const frame = useCurrentFrame();
  const adjustedFrame = Math.max(0, frame - delay);

  const typedText = getTypedText(adjustedFrame, text, charFrames);
  const isComplete = typedText.length === text.length;

  const cursorOpacity = interpolate(
    adjustedFrame % 16,
    [0, 8, 16],
    [1, 0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  return (
    <span style={style}>
      {typedText}
      {showCursor && (
        <span
          style={{
            opacity: isComplete ? cursorOpacity : 1,
            color: cursorColor,
          }}
        >
          {"\u258C"}
        </span>
      )}
    </span>
  );
};
