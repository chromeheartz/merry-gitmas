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
  /** art drawn IN FRONT of the tree (e.g. falling snow over everything) */
  foreground?: (w: number, h: number) => string;
  /** text colours (override for light backgrounds) */
  text?: string;
  textMuted?: string;
  /** make the small star dots twinkle (opacity animation) */
  twinkle?: boolean;
}

// ---------------------------------------------------------------------------
// pixel-art background helpers (used by the space theme)
// ---------------------------------------------------------------------------

const PXC = 8; // background pixel cell

const sq = (x: number, y: number, s: number, fill: string, op = 1): string =>
  `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${fill}"${op < 1 ? ` opacity="${op}"` : ""}/>`;

/**
 * Seamless one-direction scroll: lays the content twice (side by side) and
 * slides the pair by exactly one width, looping forever with no visible jump.
 * Clipped by the frame, so clouds exit one edge and re-enter the other.
 */
function scrollLoop(content: string, w: number, dur: number, dir: -1 | 1 = -1): string {
  const second = dir < 0 ? w : -w; // second copy sits on the incoming side
  const to = dir < 0 ? `${-w} 0` : `${w} 0`;
  return `<g>
    <g>${content}</g>
    <g transform="translate(${second} 0)">${content}</g>
    <animateTransform attributeName="transform" type="translate" from="0 0" to="${to}" dur="${dur}s" repeatCount="indefinite" calcMode="linear"/>
  </g>`;
}

/** chunky pixel planet, lit from the upper-left; optional horizontal bands */
function pixelPlanet(
  cx: number,
  cy: number,
  r: number,
  [hi, mid, lo, out]: string[],
  bands = false
): string {
  const ox = Math.round(cx / PXC) * PXC;
  const oy = Math.round(cy / PXC) * PXC;
  const Rc = Math.ceil(r / PXC);
  let s = "";
  for (let gy = -Rc; gy <= Rc; gy++) {
    for (let gx = -Rc; gx <= Rc; gx++) {
      const dx = gx * PXC;
      const dy = gy * PXC;
      if (Math.sqrt(dx * dx + dy * dy) > r) continue;
      let col: string;
      if (Math.sqrt(dx * dx + dy * dy) > r - PXC) col = out; // dark rim
      else {
        const light = (-dx - dy) / r; // upper-left brighter
        col = light > 0.45 ? hi : light < -0.2 ? lo : mid;
        if (bands && Math.floor((oy + dy) / (PXC * 2)) % 2 === 0 && col === mid) col = lo;
      }
      s += sq(ox + dx, oy + dy, PXC, col);
    }
  }
  return `<g shape-rendering="crispEdges">${s}</g>`;
}

/** 4-point sparkle star (bright core + fading arms) */
function sparkle(cx: number, cy: number, arms: number, color: string): string {
  const u = 4;
  const x = Math.round(cx / u) * u;
  const y = Math.round(cy / u) * u;
  let s = sq(x, y, u, "#ffffff");
  for (let i = 1; i <= arms; i++) {
    const a = i * u;
    const op = 1 - i / (arms + 1);
    s += sq(x, y - a, u, color, op) + sq(x, y + a, u, color, op) + sq(x - a, y, u, color, op) + sq(x + a, y, u, color, op);
  }
  return `<g shape-rendering="crispEdges">${s}</g>`;
}

/** a 4-point sparkle that pulses (scale + opacity) */
function twinkleSparkle(
  cx: number,
  cy: number,
  arms: number,
  color: string,
  dur: number,
  begin: number
): string {
  const inner = sparkle(0, 0, arms, color); // centred at origin so scale pulses in place
  return `<g transform="translate(${Math.round(cx)} ${Math.round(cy)})"><g>${inner}<animate attributeName="opacity" values="1;0.25;1" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="scale" values="1;0.55;1" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/></g></g>`;
}

/** diagonal shooting-star streak with a bright head (u = pixel size) */
function shootingStar(x: number, y: number, len: number, color: string, u = 4): string {
  let s = "";
  for (let i = 0; i < len; i++) s += sq(x + i * u, y + i * u, u, color, 1 - (i / len) * 0.8);
  s += sq(x + len * u, y + len * u, Math.round(u * 1.5), "#ffffff");
  return `<g shape-rendering="crispEdges">${s}</g>`;
}

/** a shooting star that streaks across, fades out, pauses, then repeats */
function meteor(
  sx: number,
  sy: number,
  len: number,
  color: string,
  dx: number,
  dy: number,
  dur: number,
  begin: number,
  u = 8
): string {
  const streak = shootingStar(0, 0, len, color, u); // drawn at origin, group is moved
  return `<g opacity="0">${streak}
    <animateTransform attributeName="transform" type="translate" values="${sx} ${sy}; ${sx + dx} ${sy + dy}; ${sx + dx} ${sy + dy}" keyTimes="0;0.22;1" dur="${dur}s" begin="${begin}s" repeatCount="indefinite" calcMode="linear"/>
    <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.03;0.18;0.24;1" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>
  </g>`;
}

/** chunky snow-capped pixel mountain (snow on top, rock below, lit from left) */
function pixelMountain(
  peakX: number,
  peakY: number,
  baseY: number,
  halfW: number,
  snowFrac: number,
  [snow, snowSh, rock, rockSh]: string[]
): string {
  let s = "";
  for (let y = Math.round(peakY / PXC) * PXC; y <= baseY; y += PXC) {
    const t = (y - peakY) / (baseY - peakY);
    const hw = Math.max(PXC, t * halfW);
    const left = Math.round((peakX - hw) / PXC) * PXC;
    for (let x = left; x <= peakX + hw; x += PXC) {
      const rel = (x - peakX) / (hw + 1); // -1 (left) .. 1 (right)
      const snowLine = snowFrac * (1 + 0.14 * Math.sin(x * 0.13)); // wavy snowline
      const col = t < snowLine ? (rel > 0.15 ? snowSh : snow) : rel > 0.1 ? rockSh : rock;
      s += sq(x, y, PXC, col);
    }
  }
  return `<g shape-rendering="crispEdges">${s}</g>`;
}

/** fluffy pixel cumulus cloud (lit from top, shaded + dark rim at the bottom) */
function pixelCloud(cx: number, cy: number, scale: number): string {
  const puffs: [number, number, number][] = [
    [-2.4, 0.3, 1.5],
    [-1.2, -0.5, 1.9],
    [0.2, -0.95, 2.1],
    [1.6, -0.45, 1.8],
    [2.7, 0.25, 1.35],
    [0.1, 0.5, 2.2],
    [-1.7, 0.6, 1.4],
    [1.5, 0.6, 1.5],
  ];
  const ps = puffs.map(
    ([dx, dy, r]) => [cx + dx * scale * PXC, cy + dy * scale * PXC, r * scale * PXC] as const
  );
  const g = (v: number) => Math.round(v / PXC);
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const [px, py, r] of ps) {
    minX = Math.min(minX, px - r);
    maxX = Math.max(maxX, px + r);
    minY = Math.min(minY, py - r);
    maxY = Math.max(maxY, py + r);
  }
  const has = new Set<string>();
  for (let gy = g(minY); gy <= g(maxY); gy++) {
    for (let gx = g(minX); gx <= g(maxX); gx++) {
      const x = gx * PXC;
      const y = gy * PXC;
      for (const [px, py, r] of ps) {
        const dx = x - px;
        const dy = y - py;
        if (dx * dx + dy * dy <= r * r) {
          has.add(gx + "," + gy);
          break;
        }
      }
    }
  }
  let s = "";
  for (const key of has) {
    const [gx, gy] = key.split(",").map(Number);
    const below = (has.has(gx + "," + (gy + 1)) ? 1 : 0) + (has.has(gx + "," + (gy + 2)) ? 1 : 0);
    const topOpen = !has.has(gx + "," + (gy - 1));
    const col = below === 0 ? "#7da6d8" : below === 1 ? "#a9c4e6" : topOpen ? "#ffffff" : "#eef4fc";
    s += sq(gx * PXC, gy * PXC, PXC, col);
  }
  return `<g shape-rendering="crispEdges">${s}</g>`;
}

/** heavy falling snow that loops forever (negative begins spread flakes out) */
function snowfall(w: number, h: number, count: number): string {
  let a = 0x9e3779b9 >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let s = "";
  for (let i = 0; i < count; i++) {
    const x = Math.round(rnd() * w);
    const big = rnd() > 0.66;
    const size = big ? 8 : 4;
    const dist = h + size * 2 + 24;
    const dur = big ? 6 + rnd() * 3 : 9 + rnd() * 5; // big flakes fall faster
    const begin = -(rnd() * dur); // already mid-fall at t=0 → no empty start
    const sway = (rnd() * 2 - 1) * (big ? 16 : 9);
    const op = big ? 0.95 : 0.7;
    s +=
      `<rect x="${x}" y="${-size}" width="${size}" height="${size}" fill="#ffffff" opacity="${op}">` +
      `<animateTransform attributeName="transform" type="translate" values="0 0; ${sway} ${Math.round(dist / 2)}; 0 ${dist}" dur="${dur.toFixed(2)}s" begin="${begin.toFixed(2)}s" repeatCount="indefinite" calcMode="linear"/>` +
      `</rect>`;
  }
  return `<g shape-rendering="crispEdges">${s}</g>`;
}

/** small distant pine (snow-dusted) */
function tinyPine(cx: number, topY: number, green: string): string {
  const x0 = Math.round(cx / PXC) * PXC;
  let s = "";
  for (let r = 0; r < 4; r++) {
    for (let c = -r; c <= r; c++) {
      s += sq(x0 + c * PXC, topY + r * PXC, PXC, c <= -r + 1 ? "#e8f1f8" : green);
    }
  }
  s += sq(x0, topY + 4 * PXC, PXC, "#6b4a2a"); // trunk
  return `<g shape-rendering="crispEdges">${s}</g>`;
}

// ---------------------------------------------------------------------------
// default — snowy night sky with a big moon (the original look)
// ---------------------------------------------------------------------------
const defaultTheme: Theme = {
  name: "default",
  skyTop: C.skyTop,
  skyBottom: C.skyBottom,
  starColor: C.star,
  starCount: 72,
  twinkle: true, // the small star dots blink
  // a few bigger sparkle stars that pulse, for extra christmas magic
  ambient: (w, h) =>
    [
      twinkleSparkle(w * 0.14, h * 0.13, 3, "#fff6c9", 2.4, 0),
      twinkleSparkle(w * 0.83, h * 0.18, 2, "#bfe6ff", 3.0, 0.6),
      twinkleSparkle(w * 0.25, h * 0.34, 2, "#ffffff", 2.0, 1.1),
      twinkleSparkle(w * 0.7, h * 0.42, 3, "#ffd6f5", 2.8, 0.3),
      twinkleSparkle(w * 0.08, h * 0.5, 2, "#fff6c9", 2.2, 1.5),
      twinkleSparkle(w * 0.55, h * 0.1, 2, "#bfe6ff", 2.6, 0.9),
      // lower sky sparkles (beside the tree base)
      twinkleSparkle(w * 0.06, h * 0.72, 2, "#ffffff", 2.3, 0.4),
      twinkleSparkle(w * 0.93, h * 0.76, 3, "#fff6c9", 2.7, 1.2),
      twinkleSparkle(w * 0.16, h * 0.84, 2, "#bfe6ff", 2.1, 0.8),
    ].join(""),
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
// space — deep pixel cosmos: chunky planets, sparkle stars, a shooting star
// ---------------------------------------------------------------------------
const spaceTheme: Theme = {
  name: "space",
  skyTop: "#0a0a26",
  skyBottom: "#181840",
  starColor: "#ffffff",
  starCount: 80,
  starPalette: ["#ffffff", "#9fe3ff", "#ffd0ec", "#fff2b0", "#8fb0ff", "#ff8f6a", "#c79bff"],
  // subtle horizontal nebula bands (like the reference)
  ambient: (w, h) =>
    `<rect x="0" y="${Math.round(h * 0.36)}" width="${w}" height="30" fill="#2a2a5e" opacity="0.22"/>` +
    `<rect x="0" y="${Math.round(h * 0.5)}" width="${w}" height="36" fill="#34306e" opacity="0.2"/>` +
    `<rect x="0" y="${Math.round(h * 0.64)}" width="${w}" height="26" fill="#3a2a60" opacity="0.18"/>`,
  backdrop: (w) => {
    let s = "";
    // big orange gas giant, top-left (with bands)
    s += pixelPlanet(96, 124, 56, ["#f3c074", "#dd9442", "#a25f24", "#5e3614"], true);
    // teal / lime planet, top-right
    s += pixelPlanet(w - 104, 132, 40, ["#dcef8e", "#7fc28a", "#3c8a72", "#234e46"]);
    // sparkle stars (kept toward the edges so the tree doesn't cover them)
    s += sparkle(150, 60, 3, "#9fe3ff");
    s += sparkle(60, 230, 2, "#ff8f6a");
    s += sparkle(w * 0.5, 48, 2, "#ffffff");
    s += sparkle(w - 70, 210, 4, "#fff2b0");
    s += sparkle(w - 40, 330, 2, "#c79bff");
    s += sparkle(44, 360, 3, "#ffd0ec");
    // shooting stars — several, 2x size, short loop + staggered begins so the
    // shower keeps falling continuously (each one repeats forever)
    s += meteor(w * 0.1, 30, 7, "#bfe6ff", 320, 180, 4.5, 0);
    s += meteor(w * 0.5, 50, 6, "#ffd6f5", 240, 150, 5.0, 0.8);
    s += meteor(w * 0.75, 20, 8, "#fff6c9", 300, 170, 4.2, 1.7);
    s += meteor(w * 0.25, 90, 6, "#9fe3ff", 260, 150, 4.8, 2.5);
    s += meteor(w * 0.62, 110, 7, "#ffffff", 280, 160, 4.4, 3.3);
    s += meteor(w * 0.05, 150, 6, "#c79bff", 300, 170, 5.0, 4.1);
    return s;
  },
};

// ---------------------------------------------------------------------------
// winter — daytime snowy mountain land (bright sky, peaks, distant pines)
// ---------------------------------------------------------------------------
const winterTheme: Theme = {
  name: "winter",
  skyTop: "#a9d6ee",
  skyBottom: "#e9f4fb",
  starColor: "#ffffff",
  starCount: 0, // daytime — no stars; snow flecks added in ambient
  ambient: (w, h) => {
    let s = "";
    // soft hazy back ranges
    s += pixelMountain(w * 0.2, 96, 360, 210, 0.62, ["#eaf3fa", "#d3e3f0", "#c2d4e3", "#aec3d6"]);
    s += pixelMountain(w * 0.86, 120, 360, 190, 0.62, ["#eaf3fa", "#d3e3f0", "#c2d4e3", "#aec3d6"]);
    // main snowy peak
    s += pixelMountain(w * 0.44, 44, 360, 320, 0.55, ["#ffffff", "#dbe9f3", "#b7c8d8", "#93a7ba"]);
    // distant pines along the snow line (kept off-centre, behind the tree)
    for (const px of [0.06, 0.14, 0.78, 0.88, 0.95]) s += tinyPine(w * px, 286, "#5c8a5a");
    return s;
  },
  backdrop: () => "", // scenery lives in ambient (behind the tree)
  foreground: (w, h) => snowfall(w, h, 90), // heavy snow over the whole scene
  text: "#2d3f54",
  textMuted: "#5a7184",
};

// ---------------------------------------------------------------------------
// sky — bright pixel daytime sky with fluffy cumulus clouds
// ---------------------------------------------------------------------------
const skyTheme: Theme = {
  name: "sky",
  skyTop: "#2f63c8",
  skyBottom: "#a9cdee",
  starColor: "#ffffff",
  starCount: 0,
  ambient: (w, h) => {
    const field = (rows: [number, number, number][]) =>
      rows.map(([fx, fy, sc]) => pixelCloud(w * fx, h * fy, sc)).join("");
    // two parallax layers, both drifting left, looping seamlessly
    const far = field([
      [0.3, 0.11, 0.65],
      [0.72, 0.12, 0.75],
      [0.52, 0.22, 0.5],
      [0.05, 0.5, 0.7],
      [0.95, 0.52, 0.7],
      [0.2, 0.42, 0.5],
      [0.8, 0.45, 0.55],
      [0.5, 0.48, 0.85],
    ]);
    const near = field([
      [0.16, 0.27, 1.5],
      [0.85, 0.3, 1.45],
      [0.1, 0.84, 1.35],
      [0.9, 0.85, 1.35],
      [0.34, 0.63, 0.8],
      [0.68, 0.6, 0.85],
      [0.5, 0.78, 1.0],
    ]);
    return scrollLoop(far, w, 24, -1) + scrollLoop(near, w, 14, -1);
  },
  backdrop: () => "",
  text: "#15325c",
  textMuted: "#33558a",
};

const THEMES: Record<string, Theme> = {
  default: defaultTheme,
  space: spaceTheme,
  winter: winterTheme,
  sky: skyTheme,
};

export function getTheme(name: string | undefined): Theme {
  return THEMES[(name || "default").toLowerCase()] ?? defaultTheme;
}

export const themeNames = Object.keys(THEMES);
