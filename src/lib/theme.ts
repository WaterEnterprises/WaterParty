/**
 * WaterParty Theme Tokens
 *
 * Central source of truth for all brand values.
 * Reference these constants instead of hardcoding colors/gradients in components.
 * The Tailwind @theme directive in index.css mirrors these values as CSS variables.
 *
 * Font-size tokens now use fluid `clamp()` values that scale between
 * 360px (small phone) and 768px (tablet), with current base at ~400px:
 *   text-2xs   → clamp(5px,  1.5vw,   8px)   ~6px
 *   text-micro → clamp(7px,  2vw,    10px)   ~8px
 *   text-nano  → clamp(8px,  2.25vw, 11px)   ~9px
 *   text-tiny  → clamp(9px,  2.5vw,  12px)  ~10px
 *   text-xs    → clamp(11px, 3vw,    14px)  ~12px (Tailwind built-in)
 *   text-sm    → clamp(13px, 3.5vw,  16px)  ~14px (Tailwind built-in)
 *   text-base  → clamp(14px, 4vw,    18px)  ~16px (Tailwind built-in)
 *   text-lg    → clamp(17px, 5vw,    24px)  ~20px (Tailwind built-in)
 *   text-xl    → clamp(20px, 6vw,    28px)  ~24px (Tailwind built-in)
 *   text-2xl   → clamp(22px, 7vw,    32px)  ~28px (Tailwind built-in)
 */

// ─── Brand Colors ───────────────────────────────────────────────────
export const colors = {
  brand: {
    primary: "#FF3B5C",       // Red-pink — primary actions, active tabs
    secondary: "#7042F8",     // Purple — secondary gradients, highlights
    accent: "#00D2FF",        // Cyan — accent elements, trust scores
  },
  bg: {
    base: "#090A10",          // App background — use `bg-base`
    card: "#11131F",          // Card/chip background — use `bg-card`
    overlay: "#0A0B14",       // Overlay/detail backgrounds — use `bg-overlay`
    elevated: "#131522",      // Elevated surfaces (tab bar) — use `bg-elevated`
    input: "#11131F",         // Input backgrounds — use `bg-card`
    auth: "#06070D",          // Auth page dedicated background — use `bg-auth`
  },
  text: {
    primary: "#FFFFFF",
    secondary: "rgba(255,255,255,0.7)",
    muted: "rgba(255,255,255,0.4)",
    faint: "rgba(255,255,255,0.2)",
  },
  border: {
    subtle: "rgba(255,255,255,0.05)",
    default: "rgba(255,255,255,0.1)",
    hover: "rgba(255,255,255,0.15)",
  },
  status: {
    success: "#00FFA3",       // Green — likes, confirmations
    error: "#FF3B5C",         // Red — errors, delete
    warning: "#F59E0B",       // Amber — warnings
    info: "#00D2FF",          // Cyan — info
    emerald: "#10B981",       // Emerald — wallet, financial
  },
} as const;

// ─── Fonts ──────────────────────────────────────────────────────────
export const fonts = {
  /** Primary brand font — loaded via @font-face in index.css */
  brand: '"Neue Frutiger World", "Helvetica Neue", Arial, sans-serif',
  /** Fallback system font stack */
  system: '"Helvetica Neue", Arial, sans-serif',
} as const;

// ─── Typography Scale ───────────────────────────────────────────────
/**
 * Standardized font-size tokens.
 * Use these semantic tokens (via Tailwind classes) instead of arbitrary px values.
 *
 * Tailwind class → fluid clamp (base at ~400px, scales 360px–768px):
 *   text-2xs   → clamp(5px,  1.5vw,   8px)    ~6px
 *   text-micro → clamp(7px,  2vw,    10px)    ~8px
 *   text-nano  → clamp(8px,  2.25vw, 11px)    ~9px
 *   text-tiny  → clamp(9px,  2.5vw,  12px)   ~10px
 *   text-xs    → clamp(11px, 3vw,    14px)   ~12px
 *   text-sm    → clamp(13px, 3.5vw,  16px)   ~14px
 *   text-base  → clamp(14px, 4vw,    18px)   ~16px
 *   text-lg    → clamp(17px, 5vw,    24px)   ~20px
 *   text-xl    → clamp(20px, 6vw,    28px)   ~24px
 *   text-2xl   → clamp(22px, 7vw,    32px)   ~28px
 */
export const fontSizes = {
  /** Ultra-small badges */
  "2xs": "6px",
  /** Tiny labels, tags, ETA stamps */
  micro: "8px",
  /** Small labels, secondary info */
  nano: "9px",
  /** Button text, form inputs */
  tiny: "10px",
  /** Standard UI text */
  xs: "12px",
  /** Body text / tertiary headers */
  sm: "14px",
  /** Card titles */
  base: "16px",
  /** Section headers */
  md: "18px",
  /** Page titles */
  lg: "20px",
  /** Hero headings */
  xl: "24px",
} as const;

/** Font weight presets */
export const fontWeights = {
  bold: "700",
  black: "900",
} as const;

// ─── Spacing ────────────────────────────────────────────────────────
export const spacing = {
  /** Page horizontal padding */
  pageX: "24px",
  /** Section vertical gap */
  sectionY: "16px",
  /** Card padding */
  card: "16px",
  /** Chip padding */
  chip: "8px 12px",
} as const;

// ─── Border Radius ──────────────────────────────────────────────────
export const radii = {
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "20px",
  "2xl": "24px",
  full: "9999px",
} as const;

// ─── Shadows ────────────────────────────────────────────────────────
export const shadows = {
  card: "0 4px 30px rgba(0,0,0,0.3)",
  elevated: "0 -8px 30px rgba(0,0,0,0.5)",
  glow: {
    primary: "0 0 15px rgba(255,59,92,0.4)",
    accent: "0 0 15px rgba(0,210,255,0.4)",
    success: "0 0 15px rgba(0,255,163,0.4)",
  },
} as const;

// ─── Gradients ──────────────────────────────────────────────────────
export const gradients = {
  /** Primary action button gradient */
  primary: "linear-gradient(135deg, #FF3B5C, #7042F8)",
  /** Success/confirm gradient */
  success: "linear-gradient(135deg, #10B981, #059669)",
  /** Card overlay fade */
  overlay: "linear-gradient(to top, rgba(0,0,0,0.8), rgba(0,0,0,0.2), transparent)",
  /** Header fade */
  header: "linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)",
  /** Tab active gradient */
  tabActive: "linear-gradient(135deg, #FF3B5C, #7042F8)",
} as const;
