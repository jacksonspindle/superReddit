import React from "react";
import { COLORS } from "../theme";

export const MockBrowser: React.FC<{
  url: string;
  children: React.ReactNode;
  sidebar?: React.ReactNode;
}> = ({ url, children, sidebar }) => {
  return (
    <div
      style={{
        width: "90%",
        height: "85%",
        margin: "auto",
        borderRadius: 12,
        overflow: "hidden",
        border: `1px solid ${COLORS.borderStrong}`,
        background: COLORS.bg,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 12px 0",
          gap: 4,
          background: "#1a1a1a",
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            background: COLORS.bg,
            borderRadius: "8px 8px 0 0",
            fontSize: 11,
            color: "#fff",
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              background: COLORS.reddit,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 8,
              fontWeight: 800,
              color: "white",
            }}
          >
            R
          </div>
          SuperReddit
        </div>
      </div>

      {/* URL bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "6px 12px 8px",
          background: "#1a1a1a",
        }}
      >
        <div style={{ display: "flex", gap: 6, marginRight: 10 }}>
          {["#555", "#555", "#555"].map((c, i) => (
            <div
              key={i}
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: i === 0 ? "#ff5f57" : i === 1 ? "#ffbd2e" : "#27c93f",
              }}
            />
          ))}
        </div>
        <div
          style={{
            flex: 1,
            padding: "5px 14px",
            background: "#1e1e1e",
            border: `1px solid ${COLORS.border}`,
            borderRadius: 20,
            color: "#888",
            fontSize: 12,
          }}
        >
          <span style={{ color: "#4caf50" }}>{"🔒 "}</span>
          {url}
        </div>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {sidebar && (
          <div
            style={{
              width: 220,
              borderRight: `1px solid ${COLORS.border}`,
              background: COLORS.bgCard,
              flexShrink: 0,
              overflow: "hidden",
            }}
          >
            {sidebar}
          </div>
        )}
        <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
          {children}
        </div>
      </div>
    </div>
  );
};
