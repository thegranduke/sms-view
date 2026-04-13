import { useState, useEffect, useCallback, useRef, memo } from "react";

// ─── Constants ───────────────────────────────────────────────────────────────
const GSM7 = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1bÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
);
const isGSM7 = (str) => [...str].every((c) => GSM7.has(c));
const smsLimit = (str) => {
  const gsm = isGSM7(str);
  const single = gsm ? 160 : 70;
  const multi = gsm ? 153 : 67;
  const len = str.length;
  if (len <= single) return { parts: 1, limit: single, remaining: single - len, gsm };
  const parts = Math.ceil(len / multi);
  return { parts, limit: multi * parts, remaining: multi * parts - len, gsm };
};

// ─── Link preview fetcher ─────────────────────────────────────────────────────
async function fetchLinkPreview(url) {
  try {
    const noRes = await fetch(
      `https://noembed.com/embed?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (noRes.ok) {
      const d = await noRes.json();
      if (d.title && !d.error) {
        return {
          title: d.title,
          description: d.author_name ? `By ${d.author_name}` : "",
          image: d.thumbnail_url || null,
          siteName: d.provider_name || new URL(url).hostname.replace("www.", ""),
          url,
        };
      }
    }
  } catch {}

  try {
    const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxy, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error("proxy fail");
    const { contents } = await res.json();
    const doc = new DOMParser().parseFromString(contents, "text/html");
    const meta = (name) =>
      doc.querySelector(`meta[property='${name}']`)?.getAttribute("content") ||
      doc.querySelector(`meta[name='${name}']`)?.getAttribute("content") ||
      null;
    const title = meta("og:title") || doc.title || url;
    const description = meta("og:description") || meta("description") || "";
    const image = meta("og:image") || null;
    const siteName = meta("og:site_name") || new URL(url).hostname.replace("www.", "");
    return { title, description, image, siteName, url };
  } catch {
    return null;
  }
}

function extractUrl(text) {
  const match = text.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : null;
}

// ─── Liquid glass panel primitive ─────────────────────────────────────────────
// Implements the specular highlight layers from the reference component
const Glass = ({ children, style = {}, inner = {} }) => (
  <div style={{
    position: "relative",
    background: "rgba(255,255,255,0.14)",
    backdropFilter: "blur(24px) saturate(180%)",
    WebkitBackdropFilter: "blur(24px) saturate(180%)",
    border: "1px solid rgba(255,255,255,0.42)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.7), 0 0 9px rgba(0,0,0,0.18), 0 3px 10px rgba(0,0,0,0.14)",
    ...style,
  }}>
    {/* top-left specular (::before) */}
    <div style={{
      position: "absolute", inset: 0, borderRadius: "inherit",
      background: "linear-gradient(135deg, rgba(255,255,255,0.55) 0%, transparent 48%)",
      opacity: 0.65, pointerEvents: "none", zIndex: 0,
    }} />
    {/* bottom-right specular (::after) */}
    <div style={{
      position: "absolute", inset: 0, borderRadius: "inherit",
      background: "linear-gradient(315deg, rgba(255,255,255,0.28) 0%, transparent 48%)",
      opacity: 0.45, pointerEvents: "none", zIndex: 0,
    }} />
    <div style={{ position: "relative", zIndex: 1, ...inner }}>{children}</div>
  </div>
);

// ─── Formatted message text ───────────────────────────────────────────────────
const MessageText = memo(({ text, linkColor = "#a8d8ff" }) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return (
    <>
      {parts.map((p, i) =>
        urlRegex.test(p) ? (
          <span key={i} style={{ color: linkColor, textDecoration: "underline", textDecorationColor: `${linkColor}66` }}>{p}</span>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
});

// ─── iOS iMessage Link Preview Card ──────────────────────────────────────────
// Matches the exact layout seen in iOS Messages: image → title + domain + chevron
const LinkCard = memo(({ preview, loading }) => {
  const isVideo = preview && /youtube|vimeo|dailymotion/i.test(preview.siteName || "");
  const domain = preview ? new URL(preview.url).hostname.replace("www.", "") : "";

  if (loading) {
    return (
      <div style={{
        width: 244, borderRadius: 14, overflow: "hidden",
        background: "#1c1c1e",
      }}>
        {/* image skeleton */}
        <div style={{ height: 136, background: "linear-gradient(90deg, #2a2a2a 25%, #333 50%, #2a2a2a 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.2s infinite" }} />
        <div style={{ padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
          {[{ w: "75%", delay: "0s" }, { w: "45%", delay: "0.12s" }].map(({ w, delay }, i) => (
            <div key={i} style={{ height: i === 0 ? 9 : 8, background: "linear-gradient(90deg, #2a2a2a 25%, #333 50%, #2a2a2a 75%)", backgroundSize: "200% 100%", borderRadius: 4, animation: `shimmer 1.2s infinite ${delay}`, width: w }} />
          ))}
        </div>
      </div>
    );
  }

  if (!preview) return null;

  return (
    <div style={{
      width: 244, borderRadius: 14, overflow: "hidden",
      background: "#1c1c1e",
    }}>
      {/* Thumbnail */}
      {preview.image ? (
        <div style={{ position: "relative", height: 140 }}>
          <img
            src={preview.image}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            onError={(e) => { e.target.parentElement.style.display = "none"; }}
          />
          {/* Subtle scrim at bottom */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 55%, rgba(0,0,0,0.5) 100%)" }} />
          {/* Play button for video */}
          {isVideo && (
            <div style={{
              position: "absolute", top: "50%", left: "50%",
              transform: "translate(-50%, -50%)",
              width: 44, height: 44, borderRadius: "50%",
              background: "rgba(0,0,0,0.58)",
              backdropFilter: "blur(6px)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M4 2.5L14 8L4 13.5V2.5Z" fill="white"/>
              </svg>
            </div>
          )}
        </div>
      ) : (
        <div style={{ height: 80, background: "#2c2c2e", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" stroke="#636366" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" stroke="#636366" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      )}

      {/* Title + domain row */}
      <div style={{
        padding: "9px 11px 10px",
        display: "flex",
        alignItems: "center",
        gap: 6,
        background: "#1c1c1e",
        borderTop: "0.5px solid rgba(255,255,255,0.06)",
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", lineHeight: 1.3, marginBottom: 2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {preview.title?.slice(0, 70)}{preview.title?.length > 70 ? "…" : ""}
          </div>
          <div style={{ fontSize: 11, color: "#636366" }}>{domain}</div>
        </div>
        <svg width="8" height="13" viewBox="0 0 8 13" fill="none" style={{ flexShrink: 0, opacity: 0.4 }}>
          <path d="M1 1l6 5.5L1 12" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
});

// ─── iPhone iMessage Shell ────────────────────────────────────────────────────
const IPhoneShell = memo(({ message, preview, previewLoading }) => {
  const empty = !message.trim();

  // Dark nav/input bar — glass over black = very dark translucent material
  const darkGlass = {
    background: "rgba(28,28,30,0.88)",
    backdropFilter: "blur(28px) saturate(180%)",
    WebkitBackdropFilter: "blur(28px) saturate(180%)",
  };

  return (
    <div style={{
      width: 300,
      height: 630,
      borderRadius: 52,
      background: "linear-gradient(158deg, #4a4a5a 0%, #1c1c24 55%, #101015 100%)",
      boxShadow: [
        "inset 0 1.5px 0 rgba(255,255,255,0.2)",
        "inset 0 -1px 0 rgba(255,255,255,0.05)",
        "inset 1.5px 0 0 rgba(255,255,255,0.07)",
        "inset -1.5px 0 0 rgba(255,255,255,0.04)",
        "0 48px 96px rgba(0,0,0,0.5)",
        "0 0 0 0.5px rgba(0,0,0,0.7)",
      ].join(", "),
      padding: 10,
      position: "relative",
      flexShrink: 0,
    }}>
      {/* Physical side buttons */}
      <div style={{ position: "absolute", left: -3, top: 108, width: 3, height: 28, background: "#2e2e38", borderRadius: "2px 0 0 2px" }} />
      <div style={{ position: "absolute", left: -3, top: 146, width: 3, height: 44, background: "#2e2e38", borderRadius: "2px 0 0 2px" }} />
      <div style={{ position: "absolute", left: -3, top: 198, width: 3, height: 44, background: "#2e2e38", borderRadius: "2px 0 0 2px" }} />
      <div style={{ position: "absolute", right: -3, top: 152, width: 3, height: 64, background: "#2e2e38", borderRadius: "0 2px 2px 0" }} />

      {/* Screen — pure black like iOS dark mode */}
      <div style={{
        width: "100%", height: "100%",
        borderRadius: 43,
        overflow: "hidden",
        background: "#000",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}>
        {/* Dynamic island */}
        <div style={{
          position: "absolute", top: 12, left: "50%",
          transform: "translateX(-50%)",
          width: 116, height: 34,
          background: "#000",
          borderRadius: 20,
          zIndex: 20,
          boxShadow: "0 0 0 1px #1a1a1a",
        }} />

        {/* Status bar */}
        <div style={{
          height: 54, flexShrink: 0,
          display: "flex", alignItems: "flex-end", justifyContent: "space-between",
          padding: "0 22px 8px",
          position: "relative", zIndex: 10,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#fff", letterSpacing: 0.2 }}>9:41</span>
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <svg width="17" height="12" viewBox="0 0 16 12">
              <rect x="0" y="3" width="3" height="9" rx="1" fill="white"/>
              <rect x="4.5" y="2" width="3" height="10" rx="1" fill="white"/>
              <rect x="9" y="0" width="3" height="12" rx="1" fill="white"/>
              <rect x="13.5" y="0" width="2.5" height="12" rx="1" fill="white" opacity="0.3"/>
            </svg>
            <svg width="16" height="12" viewBox="0 0 24 17">
              <path d="M1 4.3C4.4 0.8 9 -0.1 12 0c3 .1 7.6 1 11 4.3" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/>
              <path d="M5 9.3C7.2 7 9.7 6 12 6s4.8 1 7 3.3" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/>
              <path d="M9 14.3C10.1 13 11 12.4 12 12.4s1.9.6 3 1.9" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"/>
              <circle cx="12" cy="17" r="1.5" fill="white"/>
            </svg>
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ width: 24, height: 12, border: "1.5px solid rgba(255,255,255,0.65)", borderRadius: 3.5, padding: "1.5px 2px", display: "flex", alignItems: "center" }}>
                <div style={{ width: "82%", height: "100%", background: "#fff", borderRadius: 2 }} />
              </div>
            </div>
          </div>
        </div>

        {/* Nav bar — dark glass */}
        <div style={{
          ...darkGlass,
          flexShrink: 0,
          borderBottom: "0.5px solid rgba(255,255,255,0.08)",
          padding: "6px 14px 10px",
          display: "flex",
          alignItems: "center",
        }}>
          {/* Back */}
          <div style={{ display: "flex", alignItems: "center", gap: 3, minWidth: 72 }}>
            <svg width="9" height="15" viewBox="0 0 9 15" fill="none">
              <path d="M8 1L1.5 7.5L8 14" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontSize: 16, color: "#007AFF", fontWeight: 400 }}>Messages</span>
          </div>

          {/* Contact — centred */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "linear-gradient(135deg, #5856d6, #007aff)",
              display: "flex", alignItems: "center", justifyContent: "center",
              marginBottom: 2,
            }}>
              <span style={{ color: "#fff", fontSize: 12, fontWeight: 700 }}>SP</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: "#fff" }}>SMSPortal</span>
              <svg width="6" height="9" viewBox="0 0 6 9" fill="none" style={{ opacity: 0.5 }}>
                <path d="M1 1l4 3.5L1 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>

          {/* Video icon only — matches iOS reference */}
          <div style={{ minWidth: 72, display: "flex", justifyContent: "flex-end" }}>
            <svg width="26" height="18" viewBox="0 0 24 17" fill="none">
              <rect x="1" y="1" width="15" height="14" rx="3" stroke="#007AFF" strokeWidth="1.8"/>
              <path d="M16 5.5l6.5-3.5v12L16 10.5" stroke="#007AFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* Messages area */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          background: "#000",
          padding: "10px 10px 6px",
          display: "flex",
          flexDirection: "column",
          gap: 3,
          alignItems: "flex-start",
        }}>
          {/* Timestamp header */}
          <div style={{ alignSelf: "center", fontSize: 10.5, color: "#636366", fontWeight: 400, marginBottom: 8, letterSpacing: 0.1 }}>
            iMessage · Today 9:41 AM
          </div>

          {/* Empty state */}
          {empty && !previewLoading && (
            <div style={{ alignSelf: "center", marginTop: 20, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#1c1c1e", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="#48484a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span style={{ fontSize: 11, color: "#48484a", textAlign: "center", maxWidth: 155, lineHeight: 1.5 }}>
                Your message will appear here…
              </span>
            </div>
          )}

          {/* Link preview card — above message bubble (iOS behaviour) */}
          {(previewLoading || preview) && (
            <LinkCard preview={preview} loading={previewLoading} />
          )}

          {/* Text message bubble — received, left-aligned, solid iOS grey */}
          {!empty && (
            <div style={{
              background: "#3c3c3e",
              borderRadius: "18px 18px 18px 4px",
              padding: "9px 13px",
              maxWidth: "80%",
              fontSize: 13,
              lineHeight: 1.45,
              color: "#fff",
              wordBreak: "break-word",
              textAlign: "left",
              whiteSpace: "pre-wrap",
              marginTop: 3,
            }}>
              <MessageText text={message} />
            </div>
          )}

          {/* Delivered */}
          {!empty && (
            <div style={{ fontSize: 10, color: "#48484a", paddingLeft: 3, marginTop: 3 }}>
              Delivered
            </div>
          )}
        </div>

        {/* Input bar — dark glass, iOS layout */}
        <div style={{
          ...darkGlass,
          flexShrink: 0,
          borderTop: "0.5px solid rgba(255,255,255,0.07)",
          padding: "8px 10px 14px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}>
          {/* + button */}
          <div style={{
            width: 30, height: 30, borderRadius: "50%",
            background: "#2c2c2e",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1v12M1 7h12" stroke="#636366" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </div>

          {/* Text input */}
          <div style={{
            flex: 1,
            background: "#1c1c1e",
            border: "1px solid #38383a",
            borderRadius: 20,
            padding: "7px 14px",
            fontSize: 13,
            color: "#48484a",
          }}>
            iMessage
          </div>

          {/* Mic */}
          <div style={{ flexShrink: 0, opacity: 0.6 }}>
            <svg width="18" height="22" viewBox="0 0 18 22" fill="none">
              <rect x="5" y="1" width="8" height="13" rx="4" stroke="#636366" strokeWidth="1.6"/>
              <path d="M1 9v2a8 8 0 0 0 16 0V9" stroke="#636366" strokeWidth="1.6" strokeLinecap="round"/>
              <path d="M9 19v2M6 21h6" stroke="#636366" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
});

// ─── Arc character counter ────────────────────────────────────────────────────
const ArcCounter = memo(({ remaining, parts, limit, gsm }) => {
  const used = limit - remaining;
  const pct = Math.min(used / limit, 1);
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const color = pct > 0.9 ? "#ff3b30" : pct > 0.75 ? "#ff9500" : "#007aff";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <svg width={56} height={56} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={28} cy={28} r={r} fill="none" stroke="#e5e5ea" strokeWidth={3} />
        <circle
          cx={28} cy={28} r={r} fill="none"
          stroke={color} strokeWidth={3}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.2s ease, stroke 0.2s ease" }}
        />
        <text
          x={28} y={32}
          textAnchor="middle"
          style={{ fontSize: 11, fontWeight: 700, fill: color, transform: "rotate(90deg)", transformOrigin: "28px 28px", fontFamily: "inherit" }}
        >
          {remaining}
        </text>
      </svg>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#1c1c1e" }}>{parts} SMS credit{parts !== 1 ? "s" : ""}</div>
        <div style={{ fontSize: 11, color: "#8e8e93" }}>{gsm ? "GSM-7" : "⚠ Unicode"} · {limit} char max</div>
      </div>
    </div>
  );
});

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [lastFetchedUrl, setLastFetchedUrl] = useState(null);
  const debounceRef = useRef(null);

  const sms = smsLimit(message);
  const detectedUrl = extractUrl(message);

  useEffect(() => {
    if (!detectedUrl) {
      setPreview(null);
      setPreviewLoading(false);
      setLastFetchedUrl(null);
      return;
    }
    if (detectedUrl === lastFetchedUrl) return;

    clearTimeout(debounceRef.current);
    setPreviewLoading(true);

    debounceRef.current = setTimeout(async () => {
      const data = await fetchLinkPreview(detectedUrl);
      setPreview(data);
      setPreviewLoading(false);
      setLastFetchedUrl(detectedUrl);
    }, 600);

    return () => clearTimeout(debounceRef.current);
  }, [detectedUrl, lastFetchedUrl]);

  const handleChange = useCallback((e) => setMessage(e.target.value), []);

  const exampleMessages = [
    { label: "YouTube", text: "Check out this video! https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
    { label: "News", text: "Latest update: https://www.bbc.com/news" },
    { label: "Shop", text: "Your order is ready 🎉 Track it here: https://www.amazon.com" },
    { label: "Plain", text: "Hi {name}, your appointment is confirmed for tomorrow at 10am. Reply STOP to opt out." },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', -apple-system, sans-serif; -webkit-font-smoothing: antialiased; }
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        textarea { outline: none; }
        .try-btn { transition: background 0.15s, border-color 0.15s, color 0.15s; }
        .try-btn:hover { background: #eff6ff !important; border-color: #93c5fd !important; color: #0a84ff !important; }
        .clear-btn:hover { background: #f9fafb !important; border-color: #d1d5db !important; }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 3px; }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: [
          "radial-gradient(ellipse 55% 45% at 12% 20%, rgba(10,132,255,0.12) 0%, transparent 65%)",
          "radial-gradient(ellipse 50% 55% at 88% 78%, rgba(88,86,214,0.1) 0%, transparent 65%)",
          "radial-gradient(ellipse 40% 40% at 60% 10%, rgba(52,199,89,0.06) 0%, transparent 60%)",
          "#eef0f5",
        ].join(", "),
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "48px 24px 64px",
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 44, animation: "fadeUp 0.45s ease" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: "linear-gradient(135deg, #0a84ff, #5856d6)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
                <path d="M2 3h14a1 1 0 011 1v8a1 1 0 01-1 1H6l-4 3V4a1 1 0 011-1z" fill="white"/>
              </svg>
            </div>
            <span style={{ fontSize: 19, fontWeight: 700, color: "#111", letterSpacing: -0.4 }}>
              SMSPortal <span style={{ color: "#0a84ff", fontWeight: 500 }}>Live Preview</span>
            </span>
          </div>
          <p style={{ fontSize: 14, color: "#6e6e73", maxWidth: 420, lineHeight: 1.5 }}>
            See exactly what your recipients see — including how links unfurl — before you hit send.
          </p>
        </div>

        {/* Main layout */}
        <div style={{
          display: "flex",
          gap: 40,
          alignItems: "flex-start",
          width: "100%",
          maxWidth: 900,
          flexWrap: "wrap",
          justifyContent: "center",
        }}>

          {/* Composer panel */}
          <div style={{
            flex: "1 1 360px",
            maxWidth: 440,
            display: "flex",
            flexDirection: "column",
            gap: 14,
            animation: "fadeUp 0.45s ease 0.08s both",
          }}>
            {/* Quick examples */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 8 }}>
                Try an example
              </div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {exampleMessages.map((ex) => (
                  <button
                    key={ex.label}
                    className="try-btn"
                    onClick={() => setMessage(ex.text)}
                    style={{
                      background: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: 20,
                      padding: "5px 13px",
                      fontSize: 12,
                      fontWeight: 500,
                      color: "#374151",
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    {ex.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Message box */}
            <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e7eb", overflow: "hidden" }}>
              {/* Toolbar */}
              <div style={{
                padding: "9px 12px",
                borderBottom: "1px solid #f3f4f6",
                display: "flex",
                gap: 7,
                alignItems: "center",
              }}>
                {["{name}", "{link}", "{date}"].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setMessage((m) => m + tag)}
                    style={{
                      background: "#f3f4f6",
                      border: "none",
                      borderRadius: 6,
                      padding: "3px 8px",
                      fontSize: 11,
                      fontFamily: "ui-monospace, monospace",
                      color: "#0a84ff",
                      cursor: "pointer",
                      fontWeight: 500,
                    }}
                  >
                    {tag}
                  </button>
                ))}
                <div style={{ marginLeft: "auto", fontSize: 11, color: detectedUrl ? "#0a84ff" : "#9ca3af" }}>
                  {detectedUrl ? "🔗 Link detected" : "Paste a URL to preview"}
                </div>
              </div>

              {/* Textarea */}
              <textarea
                value={message}
                onChange={handleChange}
                placeholder="Type your SMS message here… paste a link to see it unfurl on the iPhone preview →"
                style={{
                  width: "100%",
                  minHeight: 140,
                  padding: "13px 14px",
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: "#111",
                  border: "none",
                  resize: "none",
                  background: "transparent",
                  fontFamily: "inherit",
                  display: "block",
                }}
              />

              {/* Counter bar */}
              <div style={{
                padding: "9px 12px",
                borderTop: "1px solid #f3f4f6",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
                <ArcCounter {...sms} />
                <button
                  className="clear-btn"
                  onClick={() => setMessage("")}
                  style={{
                    background: "none",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    padding: "5px 12px",
                    fontSize: 12,
                    color: "#9ca3af",
                    cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "all 0.15s",
                  }}
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Info card */}
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: "12px 14px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#111", marginBottom: 5 }}>How it works</div>
              <div style={{ fontSize: 12, color: "#6e6e73", lineHeight: 1.65 }}>
                Paste any URL — YouTube, news article, landing page, or your own short link — and see exactly how it unfurls for recipients in real time. GSM-7 vs Unicode encoding is detected automatically, so credit costs are always accurate.
              </div>
            </div>
          </div>

          {/* iPhone panel */}
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
            animation: "fadeUp 0.45s ease 0.16s both",
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.7 }}>
              Live preview
            </div>
            <IPhoneShell
              message={message}
              preview={preview}
              previewLoading={previewLoading}
            />
            {detectedUrl && (
              <div style={{
                fontSize: 11,
                color: previewLoading ? "#ff9500" : preview ? "#34c759" : "#ff3b30",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                gap: 5,
                transition: "color 0.2s",
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: previewLoading ? "#ff9500" : preview ? "#34c759" : "#ff3b30",
                  transition: "background 0.2s",
                }} />
                {previewLoading
                  ? "Fetching preview…"
                  : preview
                  ? `Preview loaded · ${preview.siteName}`
                  : "No preview available for this URL"}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 56, fontSize: 12, color: "#c7c7cc", textAlign: "center" }}>
          Built by Eino Mpinge · Front-End Engineer candidate
        </div>
      </div>
    </>
  );
}
