import React from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from "remotion";

export const FadeSlide: React.FC<{
  children: React.ReactNode;
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
  distance?: number;
  style?: React.CSSProperties;
}> = ({ children, delay = 0, direction = "up", distance = 30, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame,
    fps,
    delay,
    config: { damping: 200 },
  });

  const opacity = interpolate(progress, [0, 1], [0, 1]);

  const translate = interpolate(progress, [0, 1], [distance, 0]);

  const transform =
    direction === "up"
      ? `translateY(${translate}px)`
      : direction === "down"
        ? `translateY(${-translate}px)`
        : direction === "left"
          ? `translateX(${translate}px)`
          : `translateX(${-translate}px)`;

  return (
    <div style={{ opacity, transform, ...style }}>
      {children}
    </div>
  );
};
