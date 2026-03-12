import React, { useEffect, useRef, useState } from "react";
import { Menu, Moon, Sun, X } from "lucide-react";

export default function SpecialistShell({
  children,
  brand = "FORTIFY OS",
  centerLabel = "FORTIFY OS",
  statusLabel = null,
  isDark = true,
  onToggleTheme,
  navItems = [],
  borderColor,
  background,
  textColor,
  dimColor,
  accentColor,
}) {
  const palette = {
    borderColor: borderColor ?? (isDark ? "#232323" : "#CECECE"),
    background: background ?? (isDark ? "#0a0a0a" : "#F7F7F7"),
    textColor: textColor ?? (isDark ? "rgba(255,255,255,.92)" : "#121212"),
    dimColor: dimColor ?? (isDark ? "rgba(255,255,255,.55)" : "#444444"),
    accentColor: accentColor ?? (isDark ? "#00FF41" : "#1D7A3A"),
    menuBg: isDark ? "#0b0b0c" : "#f7f7f7",
    menuText: isDark ? "rgba(255,255,255,.78)" : "#2A2A2A",
    menuBorder: isDark ? "#1a1a1a" : "#d8d8d8",
    currentBg: isDark ? "rgba(0,255,65,.08)" : "rgba(29,122,58,.10)",
  };

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <div>
      <nav
        className="fo-pagebar"
        style={{
          margin: "16px 24px 0",
          padding: "10px 14px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          border: `1px solid ${palette.borderColor}`,
          background: palette.background,
        }}
      >
        <div className="fo-pagebar-left" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div ref={menuRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? "Close page menu" : "Open page menu"}
              aria-expanded={menuOpen}
              style={{
                background: "none",
                border: `1px solid ${palette.borderColor}`,
                borderRadius: 8,
                width: 36,
                height: 36,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                color: palette.dimColor,
              }}
            >
              {menuOpen ? <X size={14} /> : <Menu size={14} />}
            </button>
            {menuOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 8px)",
                  left: 0,
                  minWidth: 220,
                  zIndex: 50,
                  background: palette.menuBg,
                  border: `1px solid ${palette.borderColor}`,
                  boxShadow: "0 18px 42px rgba(0,0,0,.55)",
                }}
              >
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        item.onClick?.();
                      }}
                      disabled={!item.onClick}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        background: item.current ? palette.currentBg : "transparent",
                        color: item.current ? palette.accentColor : palette.menuText,
                        border: "none",
                        borderBottom: `1px solid ${palette.menuBorder}`,
                        textAlign: "left",
                        cursor: item.onClick ? "pointer" : "default",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 13,
                        opacity: item.onClick || item.current ? 1 : 0.55,
                        textTransform: "uppercase",
                        letterSpacing: ".1em",
                      }}
                    >
                      {Icon ? <Icon size={15} /> : <span style={{ fontSize: 15 }}>₿</span>}
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div
            style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            title="Back to top"
          >
            <span
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontWeight: 700,
                fontSize: 18,
                letterSpacing: "-0.02em",
                color: palette.textColor,
              }}
            >
              {brand}
            </span>
          </div>
        </div>
        <span
          className="fo-pagebar-title"
          style={{ fontSize: 14, color: palette.dimColor, textTransform: "uppercase", letterSpacing: "0.22em" }}
        >
          {centerLabel}
        </span>
        <div className="fo-pagebar-right" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {statusLabel ? (
            <div style={{ fontSize: 11, color: palette.dimColor, letterSpacing: ".10em", textTransform: "uppercase" }}>
              {statusLabel}
            </div>
          ) : null}
          <button
            type="button"
            onClick={onToggleTheme}
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            style={{
              background: "none",
              border: `1px solid ${palette.borderColor}`,
              borderRadius: 8,
              width: 36,
              height: 36,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: palette.dimColor,
            }}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </nav>
      {children}
    </div>
  );
}
