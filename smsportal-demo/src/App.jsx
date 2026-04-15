import { useState, useEffect, useCallback, useRef, memo } from "react";

// ─── SMS constants & helpers ──────────────────────────────────────────────────
const GSM7 = new Set(
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1bÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà"
);
const isGSM7 = (str) => [...str].every((c) => GSM7.has(c));
const smsLimit = (str) => {
  const gsm = isGSM7(str);
  const single = gsm ? 160 : 70;
  const multi = gsm ? 153 : 67;
  const len = str.length;
  if (len <= single) return { parts: 1, limit: single, remaining: single - len, gsm, len };
  const parts = Math.ceil(len / multi);
  return { parts, limit: multi * parts, remaining: multi * parts - len, gsm, len };
};

// ─── Link preview ─────────────────────────────────────────────────────────────
async function fetchLinkPreview(url) {
  try {
    const r = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      const d = await r.json();
      if (d.title && !d.error)
        return { title: d.title, description: d.author_name ? `By ${d.author_name}` : "", image: d.thumbnail_url || null, siteName: d.provider_name || new URL(url).hostname.replace("www.", ""), url };
    }
  } catch {}
  try {
    const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error();
    const { contents } = await res.json();
    const doc = new DOMParser().parseFromString(contents, "text/html");
    const m = (n) => doc.querySelector(`meta[property='${n}']`)?.getAttribute("content") || doc.querySelector(`meta[name='${n}']`)?.getAttribute("content") || null;
    return { title: m("og:title") || doc.title || url, description: m("og:description") || m("description") || "", image: m("og:image") || null, siteName: m("og:site_name") || new URL(url).hostname.replace("www.", ""), url };
  } catch { return null; }
}

function extractUrl(text) {
  const m = text.match(/https?:\/\/[^\s]+/);
  return m ? m[0] : null;
}

// ─── iPhone: message text with link highlight ─────────────────────────────────
const MessageText = memo(({ text }) => {
  const re = /(https?:\/\/[^\s]+)/g;
  return (
    <>
      {text.split(re).map((p, i) =>
        re.test(p) ? <span key={i} style={{ color: "#a8d8ff", textDecoration: "underline" }}>{p}</span>
                   : <span key={i}>{p}</span>
      )}
    </>
  );
});

// ─── iPhone: rich link card ───────────────────────────────────────────────────
const LinkCard = memo(({ preview, loading }) => {
  if (loading) return (
    <div style={{ width: 238, borderRadius: 14, overflow: "hidden", background: "#1c1c1e" }}>
      <div style={{ height: 130, background: "linear-gradient(90deg,#2a2a2a 25%,#333 50%,#2a2a2a 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.2s infinite" }} />
      <div style={{ padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
        {["72%", "44%"].map((w, i) => (
          <div key={i} style={{ height: i === 0 ? 9 : 8, background: "linear-gradient(90deg,#2a2a2a 25%,#333 50%,#2a2a2a 75%)", backgroundSize: "200% 100%", borderRadius: 4, animation: `shimmer 1.2s infinite ${i * 0.12}s`, width: w }} />
        ))}
      </div>
    </div>
  );
  if (!preview) return null;
  const isVideo = /youtube|vimeo/i.test(preview.siteName || "");
  const domain = (() => { try { return new URL(preview.url).hostname.replace("www.", ""); } catch { return ""; } })();
  return (
    <div style={{ width: 238, borderRadius: 14, overflow: "hidden", background: "#1c1c1e" }}>
      {preview.image ? (
        <div style={{ position: "relative", height: 134 }}>
          <img src={preview.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={(e) => { e.target.parentElement.style.display = "none"; }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom,transparent 55%,rgba(0,0,0,0.48) 100%)" }} />
          {isVideo && (
            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 42, height: 42, borderRadius: "50%", background: "rgba(0,0,0,0.58)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M4 2.5L14 8L4 13.5V2.5Z" fill="white"/></svg>
            </div>
          )}
        </div>
      ) : (
        <div style={{ height: 72, background: "#2c2c2e", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" stroke="#636366" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" stroke="#636366" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </div>
      )}
      <div style={{ padding: "8px 11px 10px", display: "flex", alignItems: "center", gap: 6, borderTop: "0.5px solid rgba(255,255,255,0.06)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", lineHeight: 1.3, marginBottom: 2, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {preview.title?.slice(0, 68)}{preview.title?.length > 68 ? "…" : ""}
          </div>
          <div style={{ fontSize: 10.5, color: "#636366" }}>{domain}</div>
        </div>
        <svg width="7" height="12" viewBox="0 0 8 13" fill="none" style={{ flexShrink: 0, opacity: 0.35 }}>
          <path d="M1 1l6 5.5L1 12" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
});

// ─── iPhone shell ─────────────────────────────────────────────────────────────
const IPhoneShell = memo(({ message, preview, previewLoading }) => {
  const empty = !message.trim();
  const dg = { background: "rgba(28,28,30,0.9)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)" };
  return (
    <div style={{ width: 272, height: 572, borderRadius: 48, background: "linear-gradient(158deg,#4a4a5a 0%,#1c1c24 55%,#101015 100%)", boxShadow: ["inset 0 1.5px 0 rgba(255,255,255,0.2)","inset 0 -1px 0 rgba(255,255,255,0.05)","inset 1.5px 0 0 rgba(255,255,255,0.07)","inset -1.5px 0 0 rgba(255,255,255,0.04)","0 28px 56px rgba(0,0,0,0.45)","0 0 0 0.5px rgba(0,0,0,0.7)"].join(","), padding: 9, position: "relative", flexShrink: 0 }}>
      <div style={{ position: "absolute", left: -3, top: 96,  width: 3, height: 24, background: "#2e2e38", borderRadius: "2px 0 0 2px" }} />
      <div style={{ position: "absolute", left: -3, top: 128, width: 3, height: 38, background: "#2e2e38", borderRadius: "2px 0 0 2px" }} />
      <div style={{ position: "absolute", left: -3, top: 174, width: 3, height: 38, background: "#2e2e38", borderRadius: "2px 0 0 2px" }} />
      <div style={{ position: "absolute", right: -3, top: 130, width: 3, height: 54, background: "#2e2e38", borderRadius: "0 2px 2px 0" }} />
      <div style={{ width: "100%", height: "100%", borderRadius: 40, overflow: "hidden", background: "#000", display: "flex", flexDirection: "column", position: "relative" }}>
        <div style={{ position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)", width: 102, height: 30, background: "#000", borderRadius: 17, zIndex: 20, boxShadow: "0 0 0 1px #1a1a1a" }} />
        {/* Status bar */}
        <div style={{ height: 48, flexShrink: 0, display: "flex", alignItems: "flex-end", justifyContent: "space-between", padding: "0 18px 7px", position: "relative", zIndex: 10 }}>
          <span style={{ fontSize: 11.5, fontWeight: 600, color: "#fff" }}>9:41</span>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <svg width="15" height="11" viewBox="0 0 16 12"><rect x="0" y="3" width="3" height="9" rx="1" fill="white"/><rect x="4.5" y="2" width="3" height="10" rx="1" fill="white"/><rect x="9" y="0" width="3" height="12" rx="1" fill="white"/><rect x="13.5" y="0" width="2.5" height="12" rx="1" fill="white" opacity="0.3"/></svg>
            <svg width="14" height="11" viewBox="0 0 24 17"><path d="M1 4.3C4.4.8 9-.1 12 0c3 .1 7.6 1 11 4.3" stroke="white" strokeWidth="2.2" strokeLinecap="round" fill="none"/><path d="M5 9.3C7.2 7 9.7 6 12 6s4.8 1 7 3.3" stroke="white" strokeWidth="2.2" strokeLinecap="round" fill="none"/><path d="M9 14.3C10.1 13 11 12.4 12 12.4s1.9.6 3 1.9" stroke="white" strokeWidth="2.2" strokeLinecap="round" fill="none"/><circle cx="12" cy="17" r="1.5" fill="white"/></svg>
            <div style={{ width: 22, height: 11, border: "1.5px solid rgba(255,255,255,0.65)", borderRadius: 3, padding: "1.5px 2px", display: "flex", alignItems: "center" }}><div style={{ width: "80%", height: "100%", background: "#fff", borderRadius: 1.5 }} /></div>
          </div>
        </div>
        {/* Nav bar */}
        <div style={{ ...dg, flexShrink: 0, borderBottom: "0.5px solid rgba(255,255,255,0.08)", padding: "4px 12px 8px", display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 3, minWidth: 64 }}>
            <svg width="8" height="13" viewBox="0 0 9 15" fill="none"><path d="M8 1L1.5 7.5L8 14" stroke="#007AFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <span style={{ fontSize: 14, color: "#007AFF" }}>Messages</span>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: 31, height: 31, borderRadius: "50%", background: "linear-gradient(135deg,#5856d6,#007aff)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 1 }}>
              <span style={{ color: "#fff", fontSize: 10.5, fontWeight: 700 }}>SP</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
              <span style={{ fontSize: 10, fontWeight: 500, color: "#fff" }}>SMSPortal</span>
              <svg width="5" height="7" viewBox="0 0 6 9" fill="none" style={{ opacity: 0.45 }}><path d="M1 1l4 3.5L1 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          </div>
          <div style={{ minWidth: 64, display: "flex", justifyContent: "flex-end" }}>
            <svg width="22" height="15" viewBox="0 0 24 17" fill="none"><rect x="1" y="1" width="14" height="14" rx="2.5" stroke="#007AFF" strokeWidth="1.8"/><path d="M15 5.5l7.5-3.5v12L15 10.5" stroke="#007AFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </div>
        {/* Chat area */}
        <div style={{ flex: 1, overflowY: "auto", background: "#000", padding: "9px 8px 5px", display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-start" }}>
          <div style={{ alignSelf: "center", fontSize: 9.5, color: "#636366", marginBottom: 7 }}>iMessage · Today 9:41 AM</div>
          {empty && !previewLoading && (
            <div style={{ alignSelf: "center", marginTop: 18, display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
              <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#1c1c1e", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" stroke="#48484a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <span style={{ fontSize: 10, color: "#48484a", textAlign: "center", maxWidth: 140, lineHeight: 1.5 }}>Your message will appear here…</span>
            </div>
          )}
          {(previewLoading || preview) && <LinkCard preview={preview} loading={previewLoading} />}
          {!empty && (
            <div style={{ background: "#3c3c3e", borderRadius: "17px 17px 17px 4px", padding: "7px 11px", maxWidth: "80%", fontSize: 12, lineHeight: 1.45, color: "#fff", wordBreak: "break-word", textAlign: "left", whiteSpace: "pre-wrap", marginTop: 3 }}>
              <MessageText text={message} />
            </div>
          )}
          {!empty && <div style={{ fontSize: 9, color: "#48484a", paddingLeft: 2, marginTop: 2 }}>Delivered</div>}
        </div>
        {/* Input bar */}
        <div style={{ ...dg, flexShrink: 0, borderTop: "0.5px solid rgba(255,255,255,0.07)", padding: "6px 8px 11px", display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#2c2c2e", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="#636366" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </div>
          <div style={{ flex: 1, background: "#1c1c1e", border: "1px solid #38383a", borderRadius: 16, padding: "5px 11px", fontSize: 11.5, color: "#48484a" }}>iMessage</div>
          <div style={{ flexShrink: 0, opacity: 0.5 }}>
            <svg width="16" height="19" viewBox="0 0 18 22" fill="none"><rect x="5" y="1" width="8" height="13" rx="4" stroke="#636366" strokeWidth="1.6"/><path d="M1 9v2a8 8 0 0016 0V9" stroke="#636366" strokeWidth="1.6" strokeLinecap="round"/><path d="M9 19v2M6 21h6" stroke="#636366" strokeWidth="1.6" strokeLinecap="round"/></svg>
          </div>
        </div>
      </div>
    </div>
  );
});

// ─── Sidebar nav icon ─────────────────────────────────────────────────────────
function NavIcon({ type }) {
  const s = { fill: "none", stroke: "currentColor", strokeWidth: "1.65", strokeLinecap: "round", strokeLinejoin: "round" };
  const icons = {
    dashboard: <svg width="17" height="17" viewBox="0 0 24 24" {...s}><rect x="3" y="3" width="7" height="7" rx="1.2"/><rect x="14" y="3" width="7" height="7" rx="1.2"/><rect x="3" y="14" width="7" height="7" rx="1.2"/><rect x="14" y="14" width="7" height="7" rx="1.2"/></svg>,
    send:      <svg width="17" height="17" viewBox="0 0 24 24" {...s}><path d="M22 2L11 13M22 2L15 22 11 13 2 9l20-7z"/></svg>,
    groups:    <svg width="17" height="17" viewBox="0 0 24 24" {...s}><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
    reporting: <svg width="17" height="17" viewBox="0 0 24 24" {...s}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    marketing: <svg width="17" height="17" viewBox="0 0 24 24" {...s}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>,
    shortcodes:<svg width="17" height="17" viewBox="0 0 24 24" {...s}><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
    birthdays: <svg width="17" height="17" viewBox="0 0 24 24" {...s}><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><path d="M12 3c0 0-2.5 1.8-2.5 3.5S12 9 12 9s2.5-.3 2.5-2.5S12 3 12 3z"/><line x1="12" y1="9" x2="12" y2="12"/></svg>,
  };
  return icons[type] || null;
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const NAV = [
  { type: "dashboard", label: "Dashboard" },
  { type: "send",      label: "Sending",        expanded: true, children: ["Send Message", "Templates", "Opt-outs"] },
  { type: "groups",    label: "Groups",          chevron: true },
  { type: "reporting", label: "Reporting",       chevron: true },
  { type: "marketing", label: "Marketing Tools", chevron: true },
  { type: "shortcodes",label: "Short Codes",     chevron: true },
  { type: "birthdays", label: "Birthdays",       chevron: true },
];

function Sidebar({ open }) {
  // open=true  → full 222px with labels
  // open=false → 56px icon-only rail
  const w = open ? 222 : 56;
  return (
    <aside style={{ width: w, minWidth: w, background: "#1b2336", flexShrink: 0, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", transition: "width 0.22s cubic-bezier(0.4,0,0.2,1), min-width 0.22s cubic-bezier(0.4,0,0.2,1)" }}>
      {NAV.map((item) => (
        <div key={item.label}>
          <div
            className="nav-parent"
            title={!open ? item.label : undefined}
            style={{ display: "flex", alignItems: "center", gap: open ? 10 : 0, padding: open ? "11px 16px" : "13px 0", justifyContent: open ? "flex-start" : "center", color: item.expanded ? "#fff" : "rgba(255,255,255,0.6)", cursor: "pointer", fontSize: 13.5, fontWeight: item.expanded ? 500 : 400, overflow: "hidden", whiteSpace: "nowrap" }}
          >
            <NavIcon type={item.type} />
            {open && <span style={{ flex: 1 }}>{item.label}</span>}
            {open && (item.children || item.chevron) && (
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            )}
          </div>
          {open && item.expanded && item.children?.map((child) => (
            <div key={child} className={child === "Send Message" ? "" : "nav-child"} style={{ padding: "9px 16px 9px 46px", fontSize: 13, color: child === "Send Message" ? "#fff" : "rgba(255,255,255,0.48)", cursor: "pointer", background: child === "Send Message" ? "rgba(25,112,241,0.18)" : "transparent", borderLeft: `3px solid ${child === "Send Message" ? "#1970f1" : "transparent"}`, whiteSpace: "nowrap" }}>
              {child}
            </div>
          ))}
        </div>
      ))}
    </aside>
  );
}

// ─── Avatar button (shared desktop + mobile) ──────────────────────────────────
const AvatarBtn = () => (
  <div className="user-btn" style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "4px 6px", borderRadius: 8 }}>
    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#edf0f5", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" stroke="#718096" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/><circle cx="12" cy="7" r="4" stroke="#718096" strokeWidth="1.8"/></svg>
    </div>
    <svg className="hide-sm" width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="#a0aec0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
  </div>
);

const BellBtn = () => (
  <div style={{ position: "relative", cursor: "pointer", padding: 4 }}>
    <svg width="19" height="20" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="#718096" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
    <div style={{ position: "absolute", top: 0, right: 0, width: 16, height: 16, borderRadius: "50%", background: "#e53e3e", color: "#fff", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>1</div>
  </div>
);

// ─── Top bar ──────────────────────────────────────────────────────────────────
function TopBar({ onToggle }) {
  return (
    <header style={{ height: 62, background: "#fff", borderBottom: "1px solid #e5eaf2", display: "flex", alignItems: "center", padding: "0 16px", gap: 10, flexShrink: 0, zIndex: 100 }}>
      {/* Hamburger */}
      <button className="icon-btn" onClick={onToggle} style={{ background: "none", border: "none", cursor: "pointer", padding: "6px 8px", borderRadius: 6, display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
        {[0,1,2].map(i => <div key={i} style={{ width: 20, height: 2, background: "#4a5568", borderRadius: 1 }} />)}
      </button>

      {/* Logo — full on desktop, icon-only on mobile */}
      <div style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#1970f1,#5856d6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" fill="white"/></svg>
        </div>
        <div className="hide-sm">
          <div style={{ fontSize: 8.5, fontWeight: 600, color: "#a0aec0", textTransform: "uppercase", letterSpacing: 0.9, lineHeight: 1 }}>link mobility</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#1b2336", letterSpacing: -0.4, lineHeight: 1.25 }}>smsportal</div>
        </div>
      </div>

      <div style={{ flex: 1 }} />

      {/* Buy Now */}
      <button className="btn-buy" style={{ background: "#1970f1", color: "#fff", border: "none", borderRadius: 22, padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="white" strokeWidth="2.2" strokeLinejoin="round"/><line x1="3" y1="6" x2="21" y2="6" stroke="white" strokeWidth="2.2"/><path d="M16 10a4 4 0 01-8 0" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
        Buy Now
      </button>

      {/* Credits — desktop only */}
      <div className="hide-sm" style={{ display: "flex", alignItems: "center", gap: 7, paddingLeft: 10, borderLeft: "1px solid #e5eaf2" }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#c8d0dd" strokeWidth="1.5"/><path d="M14.5 9.5c-.4-.9-1.3-1.5-2.5-1.5-1.7 0-3 1.1-3 2.5s1.3 2.5 3 2.5 3 1.1 3 2.5-1.3 2.5-3 2.5c-1.2 0-2.1-.6-2.5-1.5M12 7v10" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round"/></svg>
        <div>
          <div style={{ fontSize: 9.5, color: "#a0aec0", lineHeight: 1 }}>Credits</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#1b2336", lineHeight: 1.3 }}>99</div>
        </div>
      </div>

      {/* Status — desktop only */}
      <div className="hide-sm" style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <div style={{ width: 9, height: 9, borderRadius: "50%", background: "#48bb78" }} />
        <span style={{ fontSize: 13, color: "#4a5568" }}>Status</span>
      </div>

      {/* Help — desktop only */}
      <div className="icon-btn hide-sm" style={{ width: 28, height: 28, borderRadius: "50%", border: "1.5px solid #c8d0dd", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
        <span style={{ fontSize: 13, color: "#718096", fontWeight: 700, lineHeight: 1 }}>?</span>
      </div>

      {/* Bell — always visible */}
      <BellBtn />

      {/* Separator + name — desktop only */}
      <div className="hide-sm" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ width: 1, height: 28, background: "#e5eaf2" }} />
        <div style={{ cursor: "default" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1b2336", lineHeight: 1.1 }}>Eino</div>
          <div style={{ fontSize: 10, color: "#a0aec0", lineHeight: 1.2 }}>15 Apr 18:34</div>
        </div>
      </div>

      {/* Avatar — always visible */}
      <AvatarBtn />
    </header>
  );
}

// ─── Chevron icon ─────────────────────────────────────────────────────────────
const ChevronDown = () => (
  <svg width="11" height="7" viewBox="0 0 11 7" fill="none"><path d="M1 1l4.5 4 4.5-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
);

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [message, setMessage]           = useState("");
  const [preview, setPreview]           = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [lastFetchedUrl, setLastFetchedUrl] = useState(null);
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [showVars, setShowVars]         = useState(false);
  const [recipients, setRecipients]     = useState("");
  const debounceRef = useRef(null);

  const sms = smsLimit(message);
  const detectedUrl = extractUrl(message);

  useEffect(() => {
    if (!detectedUrl) { setPreview(null); setPreviewLoading(false); setLastFetchedUrl(null); return; }
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

  const insertTag = (tag) => setMessage((m) => m + tag);

  // Tab definitions matching SMSPortal
  const msgTabs = [
    {
      id: "custom",
      label: "Custom Value",
      icon: (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="3" width="14" height="2" rx="1" fill="currentColor" opacity="0.8"/>
          <rect x="1" y="7" width="10" height="2" rx="1" fill="currentColor" opacity="0.8"/>
          <rect x="1" y="11" width="12" height="2" rx="1" fill="currentColor" opacity="0.8"/>
        </svg>
      ),
      hasDropdown: true,
    },
    {
      id: "template",
      label: "SMS Template",
      icon: (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.4"/>
          <line x1="4" y1="5" x2="12" y2="5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          <line x1="4" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          <line x1="4" y1="11" x2="9" y2="11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      id: "shorturl",
      label: "Short URL",
      icon: (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M7 9a3 3 0 004.24.01l2-2a3 3 0 00-4.24-4.24l-1 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M9 7a3 3 0 00-4.24-.01l-2 2a3 3 0 004.24 4.24l1-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      id: "landing",
      label: "Landing Pages",
      icon: (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="1" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.4"/>
          <line x1="1" y1="5" x2="15" y2="5" stroke="currentColor" strokeWidth="1.2"/>
          <circle cx="3.5" cy="3" r="0.8" fill="currentColor"/>
          <circle cx="6" cy="3" r="0.8" fill="currentColor"/>
          <circle cx="8.5" cy="3" r="0.8" fill="currentColor"/>
        </svg>
      ),
    },
    {
      id: "optout",
      label: "Opt-out URL",
      icon: (
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.4"/>
          <path d="M5 5l6 6M11 5l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
      ),
    },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; }
        body { font-family: 'Inter', -apple-system, sans-serif; -webkit-font-smoothing: antialiased; font-size: 14px; color: #1b2336; }
        @keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        textarea:focus, input:focus { outline: none; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.13); border-radius: 3px; }

        .nav-parent:hover { background: rgba(255,255,255,0.07); }
        .nav-child:hover  { background: rgba(255,255,255,0.05) !important; }
        .icon-btn:hover   { background: #f0f3f8 !important; }
        .btn-buy:hover    { background: #1460d6 !important; }
        .user-btn:hover   { background: #f7f9fc; }

        /* Responsive hide/show helpers */
        .hide-sm { }
        @media (max-width: 640px) {
          .hide-sm { display: none !important; }
          aside { width: 0 !important; min-width: 0 !important; overflow: hidden !important; }
        }

        .sp-input {
          width: 100%; padding: 8px 12px; font-size: 13.5px; font-family: inherit;
          border: 1px solid #d0d7e3; border-radius: 6px; color: #1b2336;
          background: #fff; transition: border-color 0.15s;
        }
        .sp-input:focus { border-color: #1970f1; }
        .sp-input::placeholder { color: #a0aec0; }

        /* Message tabs — clean, no boxy individual borders */
        .msg-tab {
          display: flex; align-items: center; gap: 5px;
          padding: 8px 13px; font-size: 12.5px; font-weight: 500;
          color: #64748b; cursor: pointer;
          border-right: 1px solid #e8ecf1; border-bottom: 2px solid transparent;
          background: transparent; white-space: nowrap; user-select: none; flex-shrink: 0;
          transition: color 0.15s, border-bottom-color 0.15s, background 0.15s;
        }
        .msg-tab:hover { color: #1970f1; background: #f5f8ff; }
        .msg-tab.active { color: #1970f1; font-weight: 600; border-bottom-color: #1970f1; background: #fff; }
        .msg-tab:last-child { border-right: none; }

        .btn-primary {
          background: #1970f1; color: #fff; border: none; border-radius: 6px;
          padding: 9px 22px; font-size: 13.5px; font-weight: 600;
          cursor: pointer; font-family: inherit; transition: background 0.15s;
          white-space: nowrap;
        }
        .btn-primary:hover { background: #1460d6; }

        .btn-outline {
          background: #fff; color: #1970f1; border: 1.5px solid #1970f1;
          border-radius: 6px; padding: 7px 13px; font-size: 13px; font-weight: 600;
          cursor: pointer; font-family: inherit; display: flex; align-items: center; gap: 6px;
          transition: background 0.15s; white-space: nowrap; flex-shrink: 0;
        }
        .btn-outline:hover { background: #ebf3ff; }

        .btn-ghost {
          background: none; border: 1px solid #d0d7e3; border-radius: 6px;
          padding: 7px 13px; font-size: 13px; color: #4a5568;
          cursor: pointer; font-family: inherit; display: flex; align-items: center; gap: 6px;
          transition: background 0.12s, border-color 0.12s;
        }
        .btn-ghost:hover { background: #f7f9fc; border-color: #b0bcc8; }

        .schedule-select {
          appearance: none; -webkit-appearance: none;
          background: #fff url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23718096' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round' fill='none'/%3E%3C/svg%3E") no-repeat right 10px center;
          border: 1px solid #d0d7e3; border-radius: 6px;
          padding: 7px 32px 7px 12px; font-size: 13px; font-family: inherit; color: #1b2336; cursor: pointer;
        }
        .schedule-select:focus { outline: none; border-color: #1970f1; }

        .var-pill {
          background: #eef3ff; border: 1px solid #c3d9ff; border-radius: 5px;
          padding: 3px 10px; font-size: 11.5px; font-family: ui-monospace, monospace;
          color: #1970f1; cursor: pointer; font-weight: 500;
          transition: background 0.12s;
        }
        .var-pill:hover { background: #d9eaff; }

        .adv-input {
          width: 100%; padding: 8px 12px; font-size: 13px; font-family: inherit;
          border: 1px solid #d0d7e3; border-radius: 6px; color: #1b2336; background: #fff;
        }
        .adv-input:focus { outline: none; border-color: #1970f1; }
        .adv-input::placeholder { color: #b0bcc8; }

        /* Content grid: side-by-side on ≥900px, stacked on <900px */
        .content-grid {
          display: flex; gap: 20px; align-items: flex-start; max-width: 1200px;
        }
        .form-card { flex: 1; min-width: 0; background: #fff; border-radius: 6px; border: 1px solid #e2e8f0; overflow: hidden; }
        .preview-panel { width: 316px; flex-shrink: 0; }

        @media (max-width: 900px) {
          .content-grid { flex-direction: column; }
          .form-card { width: 100%; }
          .preview-panel { width: 100% !important; }
          .preview-inner { flex-direction: row !important; align-items: flex-start !important; gap: 20px !important; }
          .preview-phone-wrap { flex: 0 0 auto; }
          .preview-meta { flex: 1; padding-top: 8px; }
        }
        @media (max-width: 640px) {
          .optout-row { flex-wrap: wrap !important; }
          .optout-label { white-space: normal !important; }
          .preview-inner { flex-direction: column !important; align-items: center !important; }
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
        <TopBar onToggle={() => setSidebarOpen((o) => !o)} />

        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          <Sidebar open={sidebarOpen} />

          {/* Scrollable content */}
          <main style={{ flex: 1, overflowY: "auto", overflowX: "hidden", background: "#f4f6f9", padding: "20px 24px 40px" }}>
            <div className="content-grid">

              {/* ── Send Message form card ── */}
              <div className="form-card">

                {/* Card header */}
                <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid #edf0f4" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                    <h1 style={{ fontSize: 19, fontWeight: 700, color: "#1b2336", letterSpacing: -0.2 }}>Send Message</h1>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: "#a0aec0", cursor: "pointer" }}>
                      <path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <p style={{ fontSize: 12.5, color: "#718096" }}>
                    ⓘ To view our sending guides{" "}
                    <span style={{ color: "#1970f1", cursor: "pointer", textDecoration: "underline" }}>Click Here.</span>
                  </p>
                </div>

                <div style={{ padding: "20px 24px" }}>

                  {/* To field */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#4a5568", marginBottom: 6 }}>
                      To <span style={{ color: "#e53e3e" }}>*</span>
                    </label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        className="sp-input"
                        value={recipients}
                        onChange={(e) => setRecipients(e.target.value)}
                        placeholder="Type a number and hit ENTER"
                        style={{ flex: 1 }}
                      />
                      <button className="btn-outline">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
                        File / Group
                        <ChevronDown />
                      </button>
                    </div>
                  </div>

                  {/* Opt-out / recipients row */}
                  <div className="optout-row" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "nowrap" }}>
                    {/* Gear + chevron compound button */}
                    <div style={{ display: "flex", alignItems: "stretch", border: "1px solid #1970f1", borderRadius: 4, overflow: "hidden", height: 30, flexShrink: 0 }}>
                      <div style={{ width: 30, background: "#1970f1", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="white" strokeWidth="2"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" stroke="white" strokeWidth="2"/></svg>
                      </div>
                      <div style={{ width: 24, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", borderLeft: "1px solid #1970f1" }}>
                        <ChevronDown />
                      </div>
                    </div>
                    <label className="optout-label" style={{ fontSize: 13, color: "#4a5568", cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                      <input type="checkbox" defaultChecked style={{ accentColor: "#1970f1", width: 14, height: 14, flexShrink: 0 }} />
                      Check Opt-outs &amp; Duplicate Numbers
                    </label>
                    <div style={{ marginLeft: "auto", fontSize: 12.5, color: "#718096", whiteSpace: "nowrap" }}>
                      Recipients: <strong style={{ color: "#4a5568" }}>0</strong>
                    </div>
                  </div>

                  {/* Message field */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#4a5568", marginBottom: 6 }}>
                      Message <span style={{ color: "#e53e3e" }}>*</span>
                    </label>

                    {/* Message editor card */}
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: 6, overflow: "hidden" }}>

                      {/* Tab bar — nowrap + horizontal scroll so tabs never wrap */}
                      <div style={{ display: "flex", borderBottom: "1px solid #e8ecf1", background: "#f8f9fb", overflowX: "auto", flexShrink: 0 }}>
                        {msgTabs.map((tab) => (
                          <button
                            key={tab.id}
                            className={`msg-tab${tab.id === "custom" ? " active" : ""}`}
                            onClick={tab.id === "custom" ? () => setShowVars((v) => !v) : undefined}
                          >
                            {tab.icon}
                            {tab.label}
                            {tab.hasDropdown && <ChevronDown />}
                          </button>
                        ))}
                      </div>

                      {/* Variable pills dropdown */}
                      {showVars && (
                        <div style={{ padding: "8px 12px", background: "#f7f9fc", borderBottom: "1px solid #e5eaf2", display: "flex", gap: 7, flexWrap: "wrap", alignItems: "center" }}>
                          <span style={{ fontSize: 11.5, color: "#718096", marginRight: 4 }}>Insert:</span>
                          {["{name}", "{link}", "{date}", "{company}"].map((tag) => (
                            <button key={tag} className="var-pill" onClick={() => { insertTag(tag); setShowVars(false); }}>{tag}</button>
                          ))}
                        </div>
                      )}

                      {/* Textarea */}
                      <textarea
                        value={message}
                        onChange={handleChange}
                        placeholder="Type your message here… paste a URL to see it unfurl on the iPhone preview →"
                        style={{ width: "100%", minHeight: 148, padding: "13px 14px", fontSize: 14, lineHeight: 1.55, color: "#1b2336", border: "none", resize: "none", background: "#fff", fontFamily: "inherit", display: "block" }}
                      />
                    </div>
                  </div>

                  {/* Schedule row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 500, color: "#4a5568" }}>Schedule:</span>
                      <select className="schedule-select">
                        <option>Now</option>
                        <option>Later</option>
                      </select>
                    </div>
                    <button className="btn-primary">Preview &amp; Send</button>
                  </div>

                  {/* Trial / char count row */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                    <p style={{ fontSize: 12, color: "#c53030" }}>
                      Your account is in TRIAL MODE. Only the default test message can be sent.
                    </p>
                    <span style={{ fontSize: 12.5, color: "#718096", whiteSpace: "nowrap" }}>
                      ⓘ Characters <strong style={{ color: "#1b2336" }}>{sms.len}</strong>
                      {" | "}Parts <strong style={{ color: "#1b2336" }}>{sms.parts}</strong>
                      {!sms.gsm && <span style={{ color: "#dd6b20", marginLeft: 6 }}>⚠ Unicode</span>}
                    </span>
                  </div>

                  {/* Advanced settings */}
                  <details style={{ marginTop: 4 }}>
                    <summary style={{ fontSize: 13, color: "#1970f1", cursor: "pointer", userSelect: "none", listStyle: "none", display: "flex", alignItems: "center", gap: 4, marginBottom: 14 }}>
                      Hide Advanced Settings
                      <ChevronDown />
                    </summary>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, paddingTop: 4 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#4a5568", marginBottom: 5 }}>Automation Flow (Reply Rule)</label>
                        <select className="adv-input" style={{ width: "100%" }}>
                          <option>None</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#4a5568", marginBottom: 5 }}>Cost centre</label>
                        <input className="adv-input" placeholder="Enter Cost centre (optional)" />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 12.5, fontWeight: 500, color: "#4a5568", marginBottom: 5 }}>Campaign name</label>
                        <input className="adv-input" placeholder="Enter Campaign name (optional)" />
                      </div>
                    </div>
                  </details>

                </div>
              </div>

              {/* ── Device Preview panel ── */}
              <div className="preview-panel">
                <div style={{ background: "#fff", borderRadius: 6, border: "1px solid #e2e8f0" }}>

                  {/* Header */}
                  <div style={{ padding: "16px 20px 13px", borderBottom: "1px solid #edf0f4" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><rect x="5" y="2" width="14" height="20" rx="3" stroke="#a0aec0" strokeWidth="1.8"/><line x1="12" y1="18" x2="12" y2="18.01" stroke="#a0aec0" strokeWidth="2.2" strokeLinecap="round"/></svg>
                      <h2 style={{ fontSize: 16, fontWeight: 700, color: "#1b2336", letterSpacing: -0.1 }}>Device Preview</h2>
                    </div>
                    <p style={{ fontSize: 12.5, color: "#718096" }}>
                      See how your message appears on an iPhone before sending.
                    </p>
                  </div>

                  {/* Phone + meta — side by side on tablet, stacked on mobile */}
                  <div className="preview-inner" style={{ padding: "20px 18px 18px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                    <div className="preview-phone-wrap">
                      <IPhoneShell message={message} preview={preview} previewLoading={previewLoading} />
                    </div>

                    <div className="preview-meta" style={{ width: "100%" }}>
                      {/* URL status */}
                      {detectedUrl && (
                        <p style={{ fontSize: 12, color: previewLoading ? "#c05621" : preview ? "#276749" : "#9b2c2c", marginBottom: 10 }}>
                          {previewLoading ? "⏳ Fetching link preview…" : preview ? `✓ Link preview loaded · ${preview.siteName}` : "✕ No preview available for this URL"}
                        </p>
                      )}

                      {/* Encoding info */}
                      <div style={{ borderTop: "1px solid #edf0f4", paddingTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 12, color: "#718096" }}>
                          Encoding: <strong style={{ color: sms.gsm ? "#276749" : "#c05621", fontWeight: 600 }}>{sms.gsm ? "GSM-7" : "Unicode"}</strong>
                        </span>
                        <span style={{ fontSize: 12, color: "#718096" }}>
                          {sms.remaining} chars left
                        </span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>

            </div>
          </main>
        </div>
      </div>
    </>
  );
}
