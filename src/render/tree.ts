/**
 * Renders contribution data as a retro 16-bit (pixel-art) MapleStory christmas
 * tree on a night sky.
 *
 * Technique:
 *   - The tree/snow/trunk are rasterised onto a coarse PIXEL GRID and emitted
 *     as axis-aligned <rect>s with `shape-rendering: crispEdges`, giving the
 *     blocky retro look. Horizontal run-length encoding keeps the SVG small.
 *   - Ornaments are small pixel SPRITES scattered at seeded-random positions
 *     INSIDE the tree silhouette — not in neat rows. The number revealed grows
 *     with the user's contributions, but positions are stable per user.
 *
 * All art is original (no game assets) so the Action is safe to publish.
 */

import { ContributionStats } from "../github/fetch";
import { palette as C } from "./palette";
import { getTheme } from "./themes";

const PX = 8; // size of one "pixel"
const COLS = 80;
const ROWS = 84;
const W = COLS * PX; // 640
const H = ROWS * PX; // 672
const CX = 40; // centre column

// overlapping fir tiers (in grid cells) -> layered drooping silhouette.
// Top tier is kept short so the pointy crown isn't elongated.
const TIERS = [
  { apex: 5, base: 18, half: 9 },
  { apex: 13, base: 29, half: 13 },
  { apex: 22, base: 41, half: 18 },
  { apex: 32, base: 53, half: 23 },
  { apex: 44, base: 65, half: 28 },
  { apex: 55, base: 74, half: 32 },
];
const TRUNK_TOP = 74;
const TRUNK_BOT = 80;
const GROUND_ROW = 78;

// ---------------------------------------------------------------------------
// pixel grid
// ---------------------------------------------------------------------------

type Cell = string | null; // hex colour or empty

class Grid {
  cells: Cell[] = new Array(COLS * ROWS).fill(null);
  set(c: number, r: number, color: Cell) {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
    this.cells[r * COLS + c] = color;
  }
  get(c: number, r: number): Cell {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return null;
    return this.cells[r * COLS + c];
  }
  /** run-length encode each row into rects */
  toSvg(): string {
    let out = "";
    for (let r = 0; r < ROWS; r++) {
      let c = 0;
      while (c < COLS) {
        const color = this.get(c, r);
        if (color === null) {
          c++;
          continue;
        }
        let run = 1;
        while (c + run < COLS && this.get(c + run, r) === color) run++;
        out += `<rect x="${c * PX}" y="${r * PX}" width="${run * PX}" height="${PX}" fill="${color}"/>`;
        c += run;
      }
    }
    return out;
  }
}

// ---------------------------------------------------------------------------
// deterministic RNG (mulberry32) so a given user always gets the same tree
// ---------------------------------------------------------------------------

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// rasterise the tree
// ---------------------------------------------------------------------------

function halfWidthAt(tier: (typeof TIERS)[number], r: number): number {
  const span = tier.base - tier.apex;
  if (r < tier.apex || r > tier.base) return -1;
  return Math.round((tier.half * (r - tier.apex)) / span);
}

const LEAF = new Set<string>([C.leafHi, C.leafMid, C.leafLo, C.leafShadow, C.leafOutline]);
const isLeaf = (v: string | null): boolean => v !== null && LEAF.has(v);

/** stable per-cell value noise for leaf speckle texture */
function cellNoise(c: number, r: number): number {
  const x = Math.sin(c * 12.9898 + r * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Per-column downward droop of a tier's branch edge, so each layer ends in a
 * wavy row of drooping branch tips instead of a ruler-straight line.
 * Deterministic (depends only on column + tier) — no rng, so it never shifts
 * ornaments or snow.
 */
function branchDroop(c: number, tierIdx: number): number {
  const x = c + tierIdx * 5;
  const w = Math.sin(x * 0.8) * 0.6 + Math.sin(x * 1.7 + 2) * 0.4;
  return Math.round((w * 0.5 + 0.5) * 4); // 0..4 rows
}

function rasterTree(grid: Grid, rng: () => number, snowFactor: number): void {
  // foliage tiers (classic cone), top drawn last so upper layers overlap lower
  for (let i = TIERS.length - 1; i >= 0; i--) {
    const t = TIERS[i];
    const DROOP_MAX = 4;
    for (let r = t.apex; r <= t.base + DROOP_MAX; r++) {
      const hw = r <= t.base ? halfWidthAt(t, r) : t.half;
      if (hw < 0) continue;
      for (let c = CX - hw; c <= CX + hw; c++) {
        // each column droops a wavy amount → tier ends in drooping tips, not a line
        const bottom = t.base + branchDroop(c, i);
        if (r > bottom) continue; // carve the scalloped underside
        const edge = Math.abs(c - CX) / (hw + 1);
        let col: string = C.leafMid;
        if (edge > 0.72) col = C.leafLo; // darker toward the edges
        else if (edge < 0.3 && r < t.apex + (t.base - t.apex) * 0.5) col = C.leafHi;
        // pixel speckle texture so the green isn't flat (the "dot" feel)
        const n = cellNoise(c, r);
        if (r < bottom - 1) {
          if (n > 0.86) col = C.leafHi;
          else if (n < 0.14) col = C.leafLo;
          else if (n > 0.6 && col === C.leafMid) col = C.leafLo; // sparse darker dabs
        }
        // wavy shaded underside that follows each branch tip (no flat line)
        if (r >= bottom - 1) col = r === bottom ? C.leafShadow : C.leafLo;
        grid.set(c, r, col);
      }
    }

    // snow: rounded white humps that ACCUMULATE with contributions.
    // Each hump slot gets a fixed `appear` threshold; it shows once snowFactor
    // crosses it, so snow only ever grows (never relocates). rng is consumed
    // the same way regardless of total, so ornament positions stay stable.
    for (let row = t.apex + 1; row <= t.base - 1; row += 3) {
      const hw = halfWidthAt(t, row);
      if (hw < 2) continue;
      let c = CX - hw;
      while (c <= CX + hw) {
        const appear = rng();
        const w = 3 + Math.floor(rng() * 6);
        const adv = w + 2 + Math.floor(rng() * 3);
        if (appear < 0.7 * snowFactor) {
          const mid = c + w / 2;
          for (let dc = 0; dc <= w; dc++) {
            const cc = c + dc;
            if (!isLeaf(grid.get(cc, row))) continue;
            const t01 = 1 - Math.abs(cc - mid) / (w / 2 + 1);
            const rise = Math.round(t01 * 1.6);
            grid.set(cc, row, C.snow);
            for (let u = 1; u <= rise; u++) grid.set(cc, row - u, C.snow);
            grid.set(cc, row + 1, C.snowShade);
          }
        }
        c += adv;
      }
    }
  }

  // crisp dark outline + underside shadow → GBA cel-shaded edge (the dot feel)
  outlineFoliage(grid);

  // top dusting grows with snow (1→3 rows). bare tree starts with none.
  if (snowFactor > 0.05) {
    const capRows = 1 + Math.round(Math.min(1, snowFactor) * 2);
    for (let r = TIERS[0].apex; r < TIERS[0].apex + capRows; r++) {
      for (let c = CX - 1; c <= CX + 1; c++) grid.set(c, r, C.snow);
    }
  }

  // trunk (with outline)
  for (let r = TRUNK_TOP; r <= TRUNK_BOT; r++) {
    for (let c = CX - 4; c <= CX + 4; c++) {
      const col = c <= CX - 4 || c >= CX + 4 ? C.leafOutline : c <= CX - 1 ? C.trunkLo : C.trunk;
      grid.set(c, r, col);
    }
  }
}

/** Trace a 1px dark outline around the foliage silhouette and shade undersides. */
function outlineFoliage(grid: Grid): void {
  const edits: { c: number; r: number; col: string }[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!isLeaf(grid.get(c, r))) continue;
      const empties =
        Number(!isLeaf(grid.get(c - 1, r))) +
        Number(!isLeaf(grid.get(c + 1, r))) +
        Number(!isLeaf(grid.get(c, r - 1))) +
        Number(!isLeaf(grid.get(c, r + 1)));
      if (empties === 0) continue;
      // bottom/side edges become the dark outline; the row just inside goes shadow
      if (!isLeaf(grid.get(c, r + 1)) || !isLeaf(grid.get(c - 1, r)) || !isLeaf(grid.get(c + 1, r))) {
        edits.push({ c, r, col: C.leafOutline });
        if (isLeaf(grid.get(c, r - 1))) edits.push({ c, r: r - 1, col: C.leafShadow });
      }
    }
  }
  for (const e of edits) grid.set(e.c, e.r, e.col);
}

function rasterGround(grid: Grid, rng: () => number): void {
  for (let r = GROUND_ROW; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      // wavy snow surface on the top row of the ground
      if (r === GROUND_ROW && rng() > 0.7) continue;
      grid.set(c, r, r === GROUND_ROW ? C.snow : r === GROUND_ROW + 1 ? C.snowShade : C.ground);
    }
  }
  // a couple of fence posts peeking out at the sides
  for (const c of [6, 12, 68, 74]) {
    for (let r = GROUND_ROW - 3; r < GROUND_ROW; r++) grid.set(c, r, C.fence);
  }
}

// ---------------------------------------------------------------------------
// ornament sprites (pixel matrices). ' ' = transparent.
// ---------------------------------------------------------------------------

function bauble([col, dark, hi]: readonly string[]): string[][] {
  const o = dark,
    c = col,
    h = hi;
  return [
    ["", "", dark, dark, "", ""],
    ["", "", o, o, "", ""],
    ["", o, c, c, o, ""],
    [o, h, c, c, c, o],
    [o, c, c, c, c, o],
    [o, c, c, c, c, o],
    ["", o, c, c, o, ""],
  ];
}

function star([col, dark]: readonly string[]): string[][] {
  const g = col,
    o = dark;
  return [
    ["", "", "", o, "", "", ""],
    ["", "", o, g, o, "", ""],
    [o, o, o, g, o, o, o],
    ["", o, g, g, g, o, ""],
    ["", o, g, o, g, o, ""],
  ];
}

function candyCane([red, white, dark]: readonly string[]): string[][] {
  const r = red,
    w = white,
    o = dark;
  return [
    ["", r, w, r, ""],
    [r, w, r, "", o],
    [w, r, "", "", ""],
    [r, w, "", "", ""],
    [w, r, "", "", ""],
    [r, w, "", "", ""],
  ];
}

type Kind =
  | "glow"
  | "bauble-blue"
  | "bauble-gold"
  | "bauble-red"
  | "star-green"
  | "star-gold"
  | "star-blue"
  | "cane";

const SPRITE: Record<Exclude<Kind, "glow">, () => string[][]> = {
  "bauble-blue": () => bauble(C.baubleBlue),
  "bauble-gold": () => bauble(C.baubleGold),
  "bauble-red": () => bauble(C.baubleRed),
  "star-green": () => star(C.starGreen),
  "star-gold": () => star(C.starGold),
  "star-blue": () => star(C.starBlue),
  cane: () => candyCane(C.cane),
};

/**
 * Year-based unlock schedule. The tree starts EMPTY on Jan 1; each colour /
 * artifact type unlocks once this year's contributions cross its threshold,
 * adding a small cluster. The tree is FULLY decorated at ~300 contributions,
 * and crossing CROWN_AT lights up the big crown star (왕별) on top.
 */
const CROWN_AT = 300;

/** helper: N copies of an unlock at a threshold */
const rep = (
  n: number,
  at: number,
  kind: Kind,
  label: string
): { at: number; kind: Kind; label: string }[] => Array.from({ length: n }, () => ({ at, kind, label }));

const UNLOCKS: { at: number; kind: Kind; label: string }[] = [
  ...rep(4, 1, "glow", "lights"),
  ...rep(4, 8, "bauble-blue", "blue baubles"),
  ...rep(4, 25, "bauble-gold", "gold baubles"),
  ...rep(3, 45, "star-green", "green stars"),
  ...rep(4, 70, "bauble-red", "red baubles"),
  ...rep(3, 100, "star-gold", "gold stars"),
  ...rep(3, 140, "cane", "candy canes"),
  ...rep(3, 185, "star-blue", "blue stars"),
  // 235: fill out with more of everything
  ...rep(3, 235, "glow", "extra lights"),
  ...rep(3, 235, "bauble-blue", "more blue baubles"),
  // 270: top it off — tree fully packed
  ...rep(3, 270, "bauble-red", "more red baubles"),
  ...rep(3, 270, "bauble-gold", "more gold baubles"),
  ...rep(2, 270, "star-gold", "more gold stars"),
  ...rep(2, 270, "cane", "more candy canes"),
  ...rep(2, 270, "star-green", "more green stars"),
];
const MAX_ORN = UNLOCKS.length; // ~46

/** kinds currently unlocked by this year's contributions, in unlock order */
function unlockedKinds(total: number): Kind[] {
  return UNLOCKS.filter((u) => total >= u.at).map((u) => u.kind);
}

/** next thing to unlock (for the hint line) — including the crown star finale */
function nextUnlock(total: number): { at: number; label: string } | null {
  const u = UNLOCKS.find((x) => total < x.at);
  if (u) return { at: u.at, label: u.label };
  if (total < CROWN_AT) return { at: CROWN_AT, label: "👑 crown star" };
  return null;
}

/** Blit a sprite anchored at grid cell (col,row). `cell` lets ornaments render
 *  at a smaller pixel size than the tree (default = the tree's PX). */
function blitSprite(matrix: string[][], col: number, row: number, cell: number = PX): string {
  let out = "";
  const x0 = col * PX;
  const y0 = row * PX;
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      const color = matrix[r][c];
      if (!color) continue;
      out += `<rect x="${x0 + c * cell}" y="${y0 + r * cell}" width="${cell}" height="${cell}" fill="${color}"/>`;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// scatter ornaments randomly inside the silhouette
// ---------------------------------------------------------------------------

interface Pos {
  col: number;
  row: number;
}

/** Stable, evenly-spread positions inside the foliage (kind assigned later). */
function scatterPositions(grid: Grid, rng: () => number, max: number): Pos[] {
  const placed: Pos[] = [];
  let attempts = 0;
  while (placed.length < max && attempts < max * 120) {
    attempts++;
    const col = 4 + Math.floor(rng() * (COLS - 8));
    const row = 6 + Math.floor(rng() * (TRUNK_TOP - 8));
    // must sit on foliage, with a little margin
    if (grid.get(col, row) === null) continue;
    if (grid.get(col + 2, row) === null || grid.get(col - 2, row) === null) continue;
    // keep ornaments apart (tighter spacing so the tree can pack ~46 of them)
    if (placed.some((p) => Math.abs(p.col - col) < 4 && Math.abs(p.row - row) < 3)) continue;
    placed.push({ col, row });
  }
  return placed;
}

// ---------------------------------------------------------------------------
// main render
// ---------------------------------------------------------------------------

export function renderTree(
  stats: ContributionStats,
  themeName?: string,
  displayWidth: number = 350
): string {
  const theme = getTheme(themeName);
  const rng = mulberry32(hashStr(stats.username || "octocat"));

  // snow accumulates with contributions, reaching full around CROWN_AT
  const snowFactor = Math.min(1, stats.total / CROWN_AT);

  const grid = new Grid();
  rasterGround(grid, rng);
  rasterTree(grid, rng, snowFactor);

  // positions are stable per user; the unlock schedule decides how many show
  const pool = scatterPositions(grid, rng, MAX_ORN);
  const kinds = unlockedKinds(stats.total);
  const shown = pool
    .slice(0, Math.min(pool.length, kinds.length))
    .map((p, i) => ({ ...p, kind: kinds[i] }));
  const crown = stats.total >= CROWN_AT;

  const parts: string[] = [];

  // ---- defs (theme-driven sky + theme-independent ornament glow) ----
  parts.push(`
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${theme.skyTop}"/>
        <stop offset="1" stop-color="${theme.skyBottom}"/>
      </linearGradient>
      <radialGradient id="orb" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="${C.glow}"/>
        <stop offset="1" stop-color="${C.glow}" stop-opacity="0"/>
      </radialGradient>
    </defs>
  `);

  // ---- sky background ----
  parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="url(#sky)"/>`);

  // ---- ambient (nebula etc.), behind the stars ----
  if (theme.ambient) parts.push(theme.ambient(W, H));

  // ---- twinkling stars (deterministic) ----
  let sky = "";
  for (let i = 0; i < theme.starCount; i++) {
    const x = Math.floor(rng() * W);
    const y = Math.floor(rng() * H * 0.6);
    const s = rng() > 0.85 ? PX : PX / 2;
    const col = theme.starPalette
      ? theme.starPalette[Math.floor(rng() * theme.starPalette.length)]
      : theme.starColor;
    sky += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${col}" opacity="${0.5 + rng() * 0.5}"/>`;
  }
  parts.push(`<g shape-rendering="crispEdges">${sky}</g>`);

  // ---- celestial backdrop (moon / planet), in front of the stars ----
  parts.push(theme.backdrop(W, H, stats.maxDay));

  // ---- the pixel tree (crisp) ----
  parts.push(`<g shape-rendering="crispEdges">${grid.toSvg()}</g>`);

  // ornaments render at a smaller pixel size than the tree so they look daintier
  const ORN_CELL = 6;

  // ---- glow orbs (the "glow" kind) ----
  let glows = "";
  for (const p of shown) {
    if (p.kind !== "glow") continue;
    const cx = p.col * PX + ORN_CELL;
    const cy = p.row * PX + ORN_CELL;
    glows += `<circle cx="${cx}" cy="${cy}" r="${PX * 2}" fill="url(#orb)"/>`;
    glows += `<rect x="${cx - ORN_CELL / 2}" y="${cy - ORN_CELL / 2}" width="${ORN_CELL}" height="${ORN_CELL}" fill="#ffffff"/>`;
  }
  parts.push(glows);

  // ---- ornament sprites (crisp, smaller cell) ----
  let orns = "";
  for (const p of shown) {
    if (p.kind === "glow") continue;
    orns += blitSprite(SPRITE[p.kind](), p.col, p.row, ORN_CELL);
  }
  parts.push(`<g shape-rendering="crispEdges">${orns}</g>`);

  // ---- crown star (왕별): only once this year hits CROWN_AT ----
  if (crown) {
    const sx = CX * PX;
    const sy = 5 * PX;
    parts.push(`<circle cx="${sx}" cy="${sy}" r="${PX * 4}" fill="url(#orb)"/>`);
    parts.push(`<g shape-rendering="crispEdges">${blitSprite(crownStar(), CX - 5, 0)}</g>`);
  }

  // ---- small snowman standing on the ground, clear of the tree ----
  parts.push(`<g shape-rendering="crispEdges">${snowman(COLS - 6, GROUND_ROW - 7)}</g>`);

  // ---- text ----
  const next = nextUnlock(stats.total);
  const status = crown
    ? "👑 crowned!"
    : next
      ? `next: ${next.label} @ ${next.at}`
      : "✦ fully decorated";
  parts.push(`
    <text x="20" y="40" font-family="'Press Start 2P', monospace" font-size="21" font-weight="700" fill="${C.text}">@${escapeXml(stats.username)}</text>
    <text x="20" y="${H - 18}" font-family="monospace" font-size="14" fill="${C.textMuted}">★ ${stats.total} contributions in ${stats.year}  ·  ${escapeXml(status)}</text>
  `);

  // intrinsic display size (default 350px wide); viewBox keeps the crisp art
  const dw = Math.max(80, Math.round(displayWidth));
  const dh = Math.round((dw * H) / W);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${dw}" height="${dh}" viewBox="0 0 ${W} ${H}" style="shape-rendering:crispEdges" role="img" aria-label="${escapeXml(stats.username)}'s pixel christmas tree">${parts.join("")}</svg>`;
}

// ---------------------------------------------------------------------------
// extra sprites
// ---------------------------------------------------------------------------

/** big crown star (왕별) — shown only once the year hits CROWN_AT */
function crownStar(): string[][] {
  const g = C.starGold[0],
    o = C.starGold[1],
    h = C.moonHi;
  const X = ""; // transparent
  return [
    [X, X, X, X, X, o, X, X, X, X, X],
    [X, X, X, X, o, g, o, X, X, X, X],
    [X, X, X, X, o, g, o, X, X, X, X],
    [X, X, o, o, o, h, o, o, o, X, X],
    [o, g, g, g, g, g, g, g, g, g, o],
    [X, o, g, g, g, g, g, g, g, o, X],
    [X, X, o, g, g, g, g, g, o, X, X],
    [X, X, o, g, g, o, g, g, o, X, X],
    [X, X, X, o, o, X, o, o, X, X, X],
  ];
}

function snowman(col: number, row: number): string {
  const w = C.snowman,
    s = C.snowmanShade,
    k = C.coal,
    f = C.scarf,
    n = C.baubleGold[0];
  const m = [
    ["", w, w, ""],
    [w, k, k, w], // eyes
    [w, w, n, w], // nose
    [f, f, f, f], // scarf
    ["", w, w, ""],
    [w, w, w, w],
    [w, k, w, w], // button
    [s, w, w, s],
  ];
  return blitSprite(m, col, row);
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!));
}
