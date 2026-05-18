import React, { useEffect, useRef, useState } from "react";
import { Menu, Moon, Sun, X } from "lucide-react";

export default function SpecialistShell({
  children,
  brand = "FORTIFY OS",
  centerLabel = null,
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
  const themeIconColor = isDark ? "#FFD84D" : "#8B96AE";
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
          "--fo-nav-bg": isDark ? `linear-gradient(180deg, ${palette.background} 0%, #101010 100%)` : `linear-gradient(180deg, ${palette.background} 0%, #efefef 100%)`,
          "--fo-nav-border": palette.borderColor,
          "--fo-nav-border-strong": palette.borderColor,
          "--fo-nav-text": palette.menuText,
          "--fo-nav-active": palette.accentColor,
          "--fo-nav-active-bg": palette.currentBg,
          "--fo-nav-orange": accentColor || (isDark ? "#ff9900" : "#d48a00"),
        }}
      >
        <div className="fo-pagebar-left" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div ref={menuRef} className="fo-mobile-nav" style={{ position: "relative" }}>
            <button
              type="button"
              onPointerDown={(event) => {
                if (event.pointerType === "touch") {
                  event.preventDefault();
                  setMenuOpen((open) => !open);
                }
              }}
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={menuOpen ? "Close page menu" : "Open page menu"}
              aria-expanded={menuOpen}
              className="fo-mobile-nav-toggle"
              style={{
                borderColor: palette.borderColor,
                color: palette.dimColor,
              }}
            >
              {menuOpen ? <X size={14} /> : <Menu size={14} />}
            </button>
            {menuOpen && (
              <div
                className="fo-mobile-nav-pop"
                style={{
                  background: palette.menuBg,
                  borderColor: palette.borderColor,
                  boxShadow: "0 18px 42px rgba(0,0,0,.55)",
                }}
              >
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      className="fo-mobile-nav-item"
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
                        borderBottom: `1px solid ${palette.menuBorder}`,
                        cursor: item.onClick ? "pointer" : "default",
                        opacity: item.onClick || item.current ? 1 : 0.55,
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
              className="fo-pagebar-brand"
              style={{
                color: palette.textColor,
              }}
            >
              {brand}
            </span>
          </div>
        </div>
        {centerLabel ? (
          <span
            className="fo-pagebar-title"
            style={{ fontSize: 14, color: palette.dimColor, textTransform: "uppercase", letterSpacing: "0.22em" }}
          >
            {centerLabel}
          </span>
        ) : null}
        <div className="fo-pagebar-tabs" aria-label="Primary navigation">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={item.current ? "is-current" : ""}
              onClick={item.onClick}
              disabled={!item.onClick}
              style={item.color ? { "--fo-nav-item-color": item.color } : undefined}
            >
              {item.label}
            </button>
          ))}
        </div>
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
              background: "transparent",
              border: "none",
              borderRadius: 0,
              width: 20,
              height: 20,
              padding: 0,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: themeIconColor,
              flexShrink: 0,
            }}
          >
            {isDark ? <Sun size={16} strokeWidth={2.2} fill="currentColor" /> : <Moon size={16} strokeWidth={2.2} fill="currentColor" />}
          </button>
        </div>
      </nav>
      {children}
    </div>
  );
}
