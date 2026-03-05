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
import { ChatBubble } from "../components/ChatBubble";
import { NotificationToast } from "../components/NotificationToast";
import { FadeSlide } from "../components/FadeSlide";
import { COLORS } from "../theme";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const READY_ITEMS = [
  { name: "startup_mike", stage: "Ready", color: COLORS.green },
  { name: "growth_sara", stage: "Ready", color: COLORS.green },
  { name: "devops_tom", stage: "Ready", color: COLORS.green },
];

const CONVERSATIONS = [
  {
    name: "agency_jess",
    stage: "DM Sent",
    stageColor: COLORS.blue,
    lastMsg: "Hey! Saw your post about...",
  },
  {
    name: "cto_alex",
    stage: "Follow Up",
    stageColor: COLORS.orange,
    lastMsg: "Thanks for reaching out!",
  },
  {
    name: "founder_kim",
    stage: "Interested",
    stageColor: COLORS.green,
    lastMsg: "Can we hop on a call?",
  },
];

export const S05ChatOverlay: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Click on "startup_mike" at frame 50 → chat opens
  const chatOpen = frame >= 50;

  // Stage transition at frame 170
  const stageTransitioned = frame >= 170;

  const Sidebar = (
    <div style={{ fontFamily, fontSize: 12 }}>
      {/* Ready to DM section */}
      <div
        style={{
          borderBottom: `1px solid ${COLORS.border}`,
          background: "linear-gradient(180deg, rgba(108,92,231,0.06) 0%, transparent 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              color: COLORS.accent,
            }}
          >
            {"📋"} Ready to DM
            <span
              style={{
                background: "#6c5ce7",
                color: "white",
                fontSize: 9,
                fontWeight: 700,
                padding: "1px 6px",
                borderRadius: 8,
              }}
            >
              {READY_ITEMS.length}
            </span>
          </div>
        </div>
        <div style={{ padding: "0 8px 8px" }}>
          {READY_ITEMS.map((item, i) => (
            <FadeSlide key={i} delay={10 + i * 8} distance={8}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 8px",
                  borderRadius: 6,
                  background:
                    chatOpen && item.name === "startup_mike"
                      ? "rgba(108,92,231,0.1)"
                      : "transparent",
                  marginBottom: 2,
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${COLORS.purple}, ${COLORS.blue})`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 9,
                    fontWeight: 700,
                    color: "white",
                  }}
                >
                  {item.name[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, fontSize: 11, color: COLORS.fg }}>
                  u/{item.name}
                </div>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: item.color,
                  }}
                />
              </div>
            </FadeSlide>
          ))}
        </div>
      </div>

      {/* Conversation list */}
      <div style={{ padding: "8px" }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: COLORS.fgDim,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            padding: "6px 8px",
            marginBottom: 4,
          }}
        >
          Conversations
        </div>
        {CONVERSATIONS.map((conv, i) => (
          <FadeSlide key={i} delay={30 + i * 8} distance={8}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px",
                borderRadius: 6,
                marginBottom: 2,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: COLORS.bgMuted,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 700,
                  color: COLORS.fgMuted,
                }}
              >
                {conv.name[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <span style={{ fontSize: 11, fontWeight: 500, color: COLORS.fg }}>
                    u/{conv.name}
                  </span>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background:
                        stageTransitioned && conv.name === "agency_jess"
                          ? COLORS.orange
                          : conv.stageColor,
                      flexShrink: 0,
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: COLORS.fgDim,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {conv.lastMsg}
                </div>
              </div>
            </div>
          </FadeSlide>
        ))}
      </div>
    </div>
  );

  return (
    <AbsoluteFill style={{ background: COLORS.bg, fontFamily }}>
      <MockBrowser url="reddit.com/chat" sidebar={Sidebar}>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            padding: 16,
          }}
        >
          {chatOpen ? (
            <>
              {/* Chat header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  paddingBottom: 12,
                  borderBottom: `1px solid ${COLORS.border}`,
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${COLORS.orange}, ${COLORS.purple})`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "white",
                  }}
                >
                  S
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.fg }}>
                    u/startup_mike
                  </div>
                  <div style={{ fontSize: 10, color: COLORS.fgDim }}>Active now</div>
                </div>
                <div style={{ marginLeft: "auto" }}>
                  <div
                    style={{
                      padding: "3px 8px",
                      background: stageTransitioned ? COLORS.orangeBg : COLORS.blueBg,
                      color: stageTransitioned ? COLORS.orange : COLORS.blue,
                      fontSize: 10,
                      fontWeight: 600,
                      borderRadius: 6,
                    }}
                  >
                    {stageTransitioned ? "Follow Up" : "DM Sent"}
                  </div>
                </div>
              </div>

              {/* Chat messages */}
              <div style={{ flex: 1 }}>
                <ChatBubble
                  text="Hey Mike! I saw your post about outreach tools in r/SaaS. We built something specifically for Reddit lead gen — would love to show you how it works."
                  isSent={true}
                  delay={60}
                />
                <ChatBubble
                  text="Oh interesting! I've been looking for something like that. How does it work?"
                  isSent={false}
                  delay={110}
                  showTyping={true}
                  typingDuration={25}
                />
                <ChatBubble
                  text="We monitor subreddits for buying signals, then help you craft personalized DMs. Want me to set up a quick demo?"
                  isSent={true}
                  delay={160}
                />
              </div>
            </>
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: COLORS.fgDim,
                fontSize: 14,
              }}
            >
              Select a conversation to start chatting
            </div>
          )}
        </div>

        {/* Stage update toast */}
        <NotificationToast
          text="Stage updated: Follow Up"
          delay={175}
          icon="📌"
          color={COLORS.orange}
        />
      </MockBrowser>
    </AbsoluteFill>
  );
};
