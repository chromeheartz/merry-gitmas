/**
 * Background themes. The tree/snow/ornaments stay the same across themes —
 * only the *backdrop* (sky gradient, stars, and the big celestial body) change.
 *
 * Add a new theme by pushing another entry into THEMES. Users pick one via the
 * `theme` Action input (or THEME env var locally).
 */
import { palette as C } from "./palette";

export interface Theme {
  name: string;
  skyTop: string;
  skyBottom: string;
  starColor: string;
  starCount: number;
  /** optional per-star colour variety */
  starPalette?: string[];
  /** big background art (moon / planet). maxDay drives brightness/size. */
  backdrop: (w: number, h: number, maxDay: number) => string;
  /** soft art behind the stars (nebula, aurora…) */
  ambient?: (w: number, h: number) => string;
}

// ---------------------------------------------------------------------------
// default — snowy night sky with a big moon (the original look)
// ---------------------------------------------------------------------------
const defaultTheme: Theme = {
  name: "default",
  skyTop: C.skyTop,
  skyBottom: C.skyBottom,
  starColor: C.star,
  starCount: 50,
  backdrop: (w, _h, maxDay) => {
    const r = (150 + Math.min(40, maxDay * 2)) / 2;
    return `
      <radialGradient id="th-moon" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="${C.moonHi}"/>
        <stop offset="0.7" stop-color="${C.moon}"/>
        <stop offset="1" stop-color="${C.moon}" stop-opacity="0"/>
      </radialGradient>
      <circle cx="${w - 150}" cy="160" r="${r}" fill="url(#th-moon)"/>`;
  },
};

// ---------------------------------------------------------------------------
// space — deep cosmos with a ringed planet and nebula clouds
// ---------------------------------------------------------------------------
const spaceTheme: Theme = {
  name: "space",
  skyTop: "#080318",
  skyBottom: "#241046",
  starColor: "#ffffff",
  starCount: 95,
  starPalette: ["#ffffff", "#bfe6ff", "#ffd6f5", "#fff6c9", "#9ad0ff"],
  ambient: (w, h) => `
    <radialGradient id="th-neb1" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#b13bff" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#b13bff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="th-neb2" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#2bd9d2" stop-opacity="0.4"/>
      <stop offset="1" stop-color="#2bd9d2" stop-opacity="0"/>
    </radialGradient>
    <ellipse cx="${w * 0.28}" cy="${h * 0.32}" rx="230" ry="150" fill="url(#th-neb1)"/>
    <ellipse cx="${w * 0.72}" cy="${h * 0.62}" rx="260" ry="170" fill="url(#th-neb2)"/>`,
  backdrop: (w) => {
    const cx = w - 140;
    const cy = 150;
    const r = 64;
    return `
      <radialGradient id="th-planet" cx="0.38" cy="0.32" r="0.8">
        <stop offset="0" stop-color="#8fe0ff"/>
        <stop offset="0.5" stop-color="#5a6fe0"/>
        <stop offset="1" stop-color="#2a2566"/>
      </radialGradient>
      <radialGradient id="th-pglow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="#9ad0ff" stop-opacity="0.5"/>
        <stop offset="1" stop-color="#9ad0ff" stop-opacity="0"/>
      </radialGradient>
      <circle cx="${cx}" cy="${cy}" r="${r * 1.8}" fill="url(#th-pglow)"/>
      <!-- ring behind -->
      <ellipse cx="${cx}" cy="${cy}" rx="${r * 1.9}" ry="${r * 0.55}" fill="none"
               stroke="#c9a6ff" stroke-width="8" opacity="0.45"
               transform="rotate(-20 ${cx} ${cy})"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#th-planet)"/>
      <!-- surface bands -->
      <ellipse cx="${cx}" cy="${cy - 18}" rx="${r * 0.85}" ry="6" fill="#bfe6ff" opacity="0.25"/>
      <ellipse cx="${cx}" cy="${cy + 16}" rx="${r * 0.8}" ry="5" fill="#2a2566" opacity="0.3"/>
      <!-- ring front (lower arc only) -->
      <path d="M ${cx - r * 1.78} ${cy + r * 0.18} A ${r * 1.9} ${r * 0.55} -20 0 0 ${cx + r * 1.78} ${cy - r * 0.18}"
            fill="none" stroke="#e8d6ff" stroke-width="5" opacity="0.85"/>
      <!-- little moon -->
      <circle cx="${cx - 120}" cy="${cy + 80}" r="13" fill="#cfd6ff"/>
      <circle cx="${cx - 116}" cy="${cy + 76}" r="4" fill="#ffffff" opacity="0.7"/>`;
  },
};

const THEMES: Record<string, Theme> = {
  default: defaultTheme,
  space: spaceTheme,
};

export function getTheme(name: string | undefined): Theme {
  return THEMES[(name || "default").toLowerCase()] ?? defaultTheme;
}

export const themeNames = Object.keys(THEMES);
