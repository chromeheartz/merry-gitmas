require('./sourcemap-register.js');/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ 463:
/***/ ((__unused_webpack_module, exports) => {


/**
 * Fetch a user's GitHub contribution calendar and reduce it to the few
 * numbers the tree renderer cares about.
 *
 * Uses the GitHub GraphQL API (`contributionsCollection`). Node 20's global
 * `fetch` is used, so there are no runtime dependencies.
 */
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.fetchStats = fetchStats;
const QUERY = `
  query ($login: String!, $from: DateTime!, $to: DateTime!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              contributionCount
              date
            }
          }
        }
      }
    }
  }
`;
async function fetchStats(username, token) {
    // scope to the current calendar year: Jan 1 (UTC) → now
    const now = new Date();
    const year = now.getUTCFullYear();
    const from = `${year}-01-01T00:00:00Z`;
    const to = now.toISOString();
    const res = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: {
            Authorization: `bearer ${token}`,
            "Content-Type": "application/json",
            "User-Agent": "merry-gitmas",
        },
        body: JSON.stringify({ query: QUERY, variables: { login: username, from, to } }),
    });
    if (!res.ok) {
        throw new Error(`GitHub API request failed: ${res.status} ${res.statusText}`);
    }
    const json = (await res.json());
    if (json.errors?.length) {
        throw new Error(`GraphQL error: ${json.errors.map((e) => e.message).join("; ")}`);
    }
    const calendar = json.data?.user?.contributionsCollection?.contributionCalendar;
    if (!calendar) {
        throw new Error(`No contribution data found for user "${username}".`);
    }
    const days = calendar.weeks
        .flatMap((w) => w.contributionDays)
        .sort((a, b) => a.date.localeCompare(b.date));
    return {
        username,
        year,
        total: calendar.totalContributions,
        maxDay: days.reduce((m, d) => Math.max(m, d.contributionCount), 0),
        longestStreak: longestStreak(days),
        currentStreak: currentStreak(days),
    };
}
function longestStreak(days) {
    let best = 0;
    let run = 0;
    for (const d of days) {
        if (d.contributionCount > 0) {
            run += 1;
            best = Math.max(best, run);
        }
        else {
            run = 0;
        }
    }
    return best;
}
function currentStreak(days) {
    // Walk backwards from the most recent day. Today counting as 0 is fine —
    // the streak is whatever consecutive active days lead up to the end.
    let run = 0;
    for (let i = days.length - 1; i >= 0; i--) {
        if (days[i].contributionCount > 0)
            run += 1;
        else
            break;
    }
    return run;
}


/***/ }),

/***/ 730:
/***/ (function(__unused_webpack_module, exports, __nccwpck_require__) {


/**
 * Action entry point.
 *
 * Reads inputs (GitHub Actions passes them as INPUT_* env vars), fetches the
 * contribution stats, renders the SVG, and writes it to disk. Committing the
 * file back to the repo is done by the workflow (see README), not here — that
 * keeps this step pure and easy to test.
 *
 * Runs locally too:  GITHUB_TOKEN=ghp_xxx USERNAME=you npx ts-node src/main.ts
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
const fs_1 = __nccwpck_require__(896);
const path = __importStar(__nccwpck_require__(928));
const fetch_1 = __nccwpck_require__(463);
const tree_1 = __nccwpck_require__(190);
function getInput(name, fallback = "") {
    const key = name.toUpperCase();
    return (process.env[`INPUT_${key}`] ?? // GitHub Actions `with:` inputs
        process.env[key] ?? // plain env var for local runs
        fallback).trim();
}
async function main() {
    const token = getInput("github_token") || getInput("github-token");
    if (!token) {
        throw new Error("Missing input: github_token (use secrets.GITHUB_TOKEN).");
    }
    // username defaults to the repo owner when run inside Actions
    const username = getInput("username") || process.env.GITHUB_REPOSITORY_OWNER || "";
    if (!username) {
        throw new Error("Missing input: username (could not infer from environment).");
    }
    const output = getInput("output", "profile-tree.svg");
    const theme = getInput("theme", "default");
    const width = parseInt(getInput("width", "350"), 10) || 350;
    process.stdout.write(`Fetching contributions for @${username}…\n`);
    const stats = await (0, fetch_1.fetchStats)(username, token);
    process.stdout.write(`  total=${stats.total} maxDay=${stats.maxDay} longestStreak=${stats.longestStreak}\n`);
    const svg = (0, tree_1.renderTree)(stats, theme, width);
    const outPath = path.resolve(process.cwd(), output);
    await fs_1.promises.mkdir(path.dirname(outPath), { recursive: true });
    await fs_1.promises.writeFile(outPath, svg, "utf8");
    process.stdout.write(`Wrote ${outPath}\n`);
}
main().catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exit(1);
});


/***/ }),

/***/ 883:
/***/ ((__unused_webpack_module, exports) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.palette = void 0;
/**
 * Retro 16-bit MapleStory palette — night sky, big moon, snowy fir.
 * Kept as flat hex strings; the renderer maps them onto a pixel grid.
 */
exports.palette = {
    // night sky + moon
    skyTop: "#16245f",
    skyBottom: "#3552a0",
    star: "#fdf6c9",
    moon: "#f3e6a0",
    moonHi: "#fffbe0",
    moonGlow: "#fff7cf",
    // foliage (hi -> shadow -> outline) — GBA Pokémon style cel-shading
    leafHi: "#9bd84a",
    leafMid: "#5cb83a",
    leafLo: "#3c8f2c",
    leafShadow: "#2a7320",
    leafOutline: "#173f17",
    // snow
    snow: "#ffffff",
    snowShade: "#cfe0f2",
    // trunk + fence
    trunk: "#7c4a22",
    trunkLo: "#5b3416",
    fence: "#8a5a30",
    // ground
    ground: "#eaf3ff",
    groundShade: "#cdddf0",
    // ornaments (color, dark outline, highlight)
    baubleBlue: ["#3aa0e8", "#1f6bb0", "#bfe6ff"],
    baubleGold: ["#f3c33a", "#b3851a", "#fff0b8"],
    baubleRed: ["#e2453a", "#a32018", "#ffc6bf"],
    starGold: ["#f6cf3a", "#c08f14"],
    starGreen: ["#5bd14a", "#2c8a22"],
    starBlue: ["#4cb8f0", "#1f6bb0"],
    cane: ["#e2453a", "#ffffff", "#a32018"],
    glow: "#fff6d8",
    // snowman
    snowman: "#ffffff",
    snowmanShade: "#cfe0f2",
    scarf: "#e2453a",
    coal: "#2a2f3a",
    // text
    text: "#fdf6c9",
    textMuted: "#b9c6e8",
};


/***/ }),

/***/ 556:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.themeNames = void 0;
exports.getTheme = getTheme;
/**
 * Background themes. The tree/snow/ornaments stay the same across themes —
 * only the *backdrop* (sky gradient, stars, and the big celestial body) change.
 *
 * Add a new theme by pushing another entry into THEMES. Users pick one via the
 * `theme` Action input (or THEME env var locally).
 */
const palette_1 = __nccwpck_require__(883);
// ---------------------------------------------------------------------------
// default — snowy night sky with a big moon (the original look)
// ---------------------------------------------------------------------------
const defaultTheme = {
    name: "default",
    skyTop: palette_1.palette.skyTop,
    skyBottom: palette_1.palette.skyBottom,
    starColor: palette_1.palette.star,
    starCount: 50,
    backdrop: (w, _h, maxDay) => {
        const r = (150 + Math.min(40, maxDay * 2)) / 2;
        return `
      <radialGradient id="th-moon" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="${palette_1.palette.moonHi}"/>
        <stop offset="0.7" stop-color="${palette_1.palette.moon}"/>
        <stop offset="1" stop-color="${palette_1.palette.moon}" stop-opacity="0"/>
      </radialGradient>
      <circle cx="${w - 150}" cy="160" r="${r}" fill="url(#th-moon)"/>`;
    },
};
// ---------------------------------------------------------------------------
// space — deep cosmos with a ringed planet and nebula clouds
// ---------------------------------------------------------------------------
const spaceTheme = {
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
const THEMES = {
    default: defaultTheme,
    space: spaceTheme,
};
function getTheme(name) {
    return THEMES[(name || "default").toLowerCase()] ?? defaultTheme;
}
exports.themeNames = Object.keys(THEMES);


/***/ }),

/***/ 190:
/***/ ((__unused_webpack_module, exports, __nccwpck_require__) => {


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
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.renderTree = renderTree;
const palette_1 = __nccwpck_require__(883);
const themes_1 = __nccwpck_require__(556);
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
class Grid {
    constructor() {
        this.cells = new Array(COLS * ROWS).fill(null);
    }
    set(c, r, color) {
        if (c < 0 || c >= COLS || r < 0 || r >= ROWS)
            return;
        this.cells[r * COLS + c] = color;
    }
    get(c, r) {
        if (c < 0 || c >= COLS || r < 0 || r >= ROWS)
            return null;
        return this.cells[r * COLS + c];
    }
    /** run-length encode each row into rects */
    toSvg() {
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
                while (c + run < COLS && this.get(c + run, r) === color)
                    run++;
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
function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
function mulberry32(seed) {
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
function halfWidthAt(tier, r) {
    const span = tier.base - tier.apex;
    if (r < tier.apex || r > tier.base)
        return -1;
    return Math.round((tier.half * (r - tier.apex)) / span);
}
const LEAF = new Set([palette_1.palette.leafHi, palette_1.palette.leafMid, palette_1.palette.leafLo, palette_1.palette.leafShadow, palette_1.palette.leafOutline]);
const isLeaf = (v) => v !== null && LEAF.has(v);
/** stable per-cell value noise for leaf speckle texture */
function cellNoise(c, r) {
    const x = Math.sin(c * 12.9898 + r * 78.233) * 43758.5453;
    return x - Math.floor(x);
}
function rasterTree(grid, rng) {
    // foliage tiers (classic cone), top drawn last so upper layers overlap lower
    for (let i = TIERS.length - 1; i >= 0; i--) {
        const t = TIERS[i];
        for (let r = t.apex; r <= t.base; r++) {
            const hw = halfWidthAt(t, r);
            if (hw < 0)
                continue;
            for (let c = CX - hw; c <= CX + hw; c++) {
                const edge = Math.abs(c - CX) / (hw + 1);
                let col = palette_1.palette.leafMid;
                if (edge > 0.72)
                    col = palette_1.palette.leafLo; // darker toward the edges
                if (r >= t.base - 1)
                    col = palette_1.palette.leafShadow; // branch separation line
                else if (edge < 0.3 && r < t.apex + (t.base - t.apex) * 0.5)
                    col = palette_1.palette.leafHi;
                // pixel speckle texture so the green isn't flat (the "dot" feel)
                const n = cellNoise(c, r);
                if (r < t.base - 1) {
                    if (n > 0.86)
                        col = palette_1.palette.leafHi;
                    else if (n < 0.14)
                        col = palette_1.palette.leafLo;
                    else if (n > 0.6 && col === palette_1.palette.leafMid)
                        col = palette_1.palette.leafLo; // sparse darker dabs
                }
                grid.set(c, r, col);
            }
            // jagged branch tips along the bottom edge of each tier
            if (r === t.base) {
                for (let c = CX - hw; c <= CX + hw; c += 2) {
                    if (rng() > 0.45)
                        grid.set(c, r + 1, palette_1.palette.leafShadow);
                }
            }
        }
        // heavy snow: drape rounded white humps across each branch layer
        for (let row = t.apex + 1; row <= t.base - 1; row += 3) {
            const hw = halfWidthAt(t, row);
            if (hw < 2)
                continue;
            let c = CX - hw;
            while (c <= CX + hw) {
                if (rng() < 0.55) {
                    const w = 3 + Math.floor(rng() * 6);
                    const mid = c + w / 2;
                    for (let dc = 0; dc <= w; dc++) {
                        const cc = c + dc;
                        if (!isLeaf(grid.get(cc, row)))
                            continue;
                        const t01 = 1 - Math.abs(cc - mid) / (w / 2 + 1);
                        const rise = Math.round(t01 * 1.6);
                        grid.set(cc, row, palette_1.palette.snow);
                        for (let u = 1; u <= rise; u++)
                            grid.set(cc, row - u, palette_1.palette.snow);
                        grid.set(cc, row + 1, palette_1.palette.snowShade);
                    }
                    c += w + 2 + Math.floor(rng() * 3);
                }
                else {
                    c += 2 + Math.floor(rng() * 3);
                }
            }
        }
    }
    // crisp dark outline + underside shadow → GBA cel-shaded edge (the dot feel)
    outlineFoliage(grid);
    // crisp white cap on the very top
    for (let r = TIERS[0].apex; r <= TIERS[0].apex + 2; r++) {
        for (let c = CX - 1; c <= CX + 1; c++)
            grid.set(c, r, palette_1.palette.snow);
    }
    // trunk (with outline)
    for (let r = TRUNK_TOP; r <= TRUNK_BOT; r++) {
        for (let c = CX - 4; c <= CX + 4; c++) {
            const col = c <= CX - 4 || c >= CX + 4 ? palette_1.palette.leafOutline : c <= CX - 1 ? palette_1.palette.trunkLo : palette_1.palette.trunk;
            grid.set(c, r, col);
        }
    }
}
/** Trace a 1px dark outline around the foliage silhouette and shade undersides. */
function outlineFoliage(grid) {
    const edits = [];
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (!isLeaf(grid.get(c, r)))
                continue;
            const empties = Number(!isLeaf(grid.get(c - 1, r))) +
                Number(!isLeaf(grid.get(c + 1, r))) +
                Number(!isLeaf(grid.get(c, r - 1))) +
                Number(!isLeaf(grid.get(c, r + 1)));
            if (empties === 0)
                continue;
            // bottom/side edges become the dark outline; the row just inside goes shadow
            if (!isLeaf(grid.get(c, r + 1)) || !isLeaf(grid.get(c - 1, r)) || !isLeaf(grid.get(c + 1, r))) {
                edits.push({ c, r, col: palette_1.palette.leafOutline });
                if (isLeaf(grid.get(c, r - 1)))
                    edits.push({ c, r: r - 1, col: palette_1.palette.leafShadow });
            }
        }
    }
    for (const e of edits)
        grid.set(e.c, e.r, e.col);
}
function rasterGround(grid, rng) {
    for (let r = GROUND_ROW; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            // wavy snow surface on the top row of the ground
            if (r === GROUND_ROW && rng() > 0.7)
                continue;
            grid.set(c, r, r === GROUND_ROW ? palette_1.palette.snow : r === GROUND_ROW + 1 ? palette_1.palette.snowShade : palette_1.palette.ground);
        }
    }
    // a couple of fence posts peeking out at the sides
    for (const c of [6, 12, 68, 74]) {
        for (let r = GROUND_ROW - 3; r < GROUND_ROW; r++)
            grid.set(c, r, palette_1.palette.fence);
    }
}
// ---------------------------------------------------------------------------
// ornament sprites (pixel matrices). ' ' = transparent.
// ---------------------------------------------------------------------------
function bauble([col, dark, hi]) {
    const o = dark, c = col, h = hi;
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
function star([col, dark]) {
    const g = col, o = dark;
    return [
        ["", "", "", o, "", "", ""],
        ["", "", o, g, o, "", ""],
        [o, o, o, g, o, o, o],
        ["", o, g, g, g, o, ""],
        ["", o, g, o, g, o, ""],
    ];
}
function candyCane([red, white, dark]) {
    const r = red, w = white, o = dark;
    return [
        ["", r, w, r, ""],
        [r, w, r, "", o],
        [w, r, "", "", ""],
        [r, w, "", "", ""],
        [w, r, "", "", ""],
        [r, w, "", "", ""],
    ];
}
const SPRITE = {
    "bauble-blue": () => bauble(palette_1.palette.baubleBlue),
    "bauble-gold": () => bauble(palette_1.palette.baubleGold),
    "bauble-red": () => bauble(palette_1.palette.baubleRed),
    "star-green": () => star(palette_1.palette.starGreen),
    "star-gold": () => star(palette_1.palette.starGold),
    "star-blue": () => star(palette_1.palette.starBlue),
    cane: () => candyCane(palette_1.palette.cane),
};
/**
 * Year-based unlock schedule. The tree starts EMPTY on Jan 1; each colour /
 * artifact type unlocks once this year's contributions cross its threshold,
 * adding a small cluster. The tree is FULLY decorated at ~300 contributions,
 * and crossing CROWN_AT lights up the big crown star (왕별) on top.
 */
const CROWN_AT = 300;
/** helper: N copies of an unlock at a threshold */
const rep = (n, at, kind, label) => Array.from({ length: n }, () => ({ at, kind, label }));
const UNLOCKS = [
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
function unlockedKinds(total) {
    return UNLOCKS.filter((u) => total >= u.at).map((u) => u.kind);
}
/** next thing to unlock (for the hint line) — including the crown star finale */
function nextUnlock(total) {
    const u = UNLOCKS.find((x) => total < x.at);
    if (u)
        return { at: u.at, label: u.label };
    if (total < CROWN_AT)
        return { at: CROWN_AT, label: "👑 crown star" };
    return null;
}
/** Blit a sprite anchored at grid cell (col,row). `cell` lets ornaments render
 *  at a smaller pixel size than the tree (default = the tree's PX). */
function blitSprite(matrix, col, row, cell = PX) {
    let out = "";
    const x0 = col * PX;
    const y0 = row * PX;
    for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
            const color = matrix[r][c];
            if (!color)
                continue;
            out += `<rect x="${x0 + c * cell}" y="${y0 + r * cell}" width="${cell}" height="${cell}" fill="${color}"/>`;
        }
    }
    return out;
}
/** Stable, evenly-spread positions inside the foliage (kind assigned later). */
function scatterPositions(grid, rng, max) {
    const placed = [];
    let attempts = 0;
    while (placed.length < max && attempts < max * 120) {
        attempts++;
        const col = 4 + Math.floor(rng() * (COLS - 8));
        const row = 6 + Math.floor(rng() * (TRUNK_TOP - 8));
        // must sit on foliage, with a little margin
        if (grid.get(col, row) === null)
            continue;
        if (grid.get(col + 2, row) === null || grid.get(col - 2, row) === null)
            continue;
        // keep ornaments apart (tighter spacing so the tree can pack ~46 of them)
        if (placed.some((p) => Math.abs(p.col - col) < 4 && Math.abs(p.row - row) < 3))
            continue;
        placed.push({ col, row });
    }
    return placed;
}
// ---------------------------------------------------------------------------
// main render
// ---------------------------------------------------------------------------
function renderTree(stats, themeName, displayWidth = 350) {
    const theme = (0, themes_1.getTheme)(themeName);
    const rng = mulberry32(hashStr(stats.username || "octocat"));
    const grid = new Grid();
    rasterGround(grid, rng);
    rasterTree(grid, rng);
    // positions are stable per user; the unlock schedule decides how many show
    const pool = scatterPositions(grid, rng, MAX_ORN);
    const kinds = unlockedKinds(stats.total);
    const shown = pool
        .slice(0, Math.min(pool.length, kinds.length))
        .map((p, i) => ({ ...p, kind: kinds[i] }));
    const crown = stats.total >= CROWN_AT;
    const parts = [];
    // ---- defs (theme-driven sky + theme-independent ornament glow) ----
    parts.push(`
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${theme.skyTop}"/>
        <stop offset="1" stop-color="${theme.skyBottom}"/>
      </linearGradient>
      <radialGradient id="orb" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stop-color="${palette_1.palette.glow}"/>
        <stop offset="1" stop-color="${palette_1.palette.glow}" stop-opacity="0"/>
      </radialGradient>
    </defs>
  `);
    // ---- sky background ----
    parts.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="url(#sky)"/>`);
    // ---- ambient (nebula etc.), behind the stars ----
    if (theme.ambient)
        parts.push(theme.ambient(W, H));
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
        if (p.kind !== "glow")
            continue;
        const cx = p.col * PX + ORN_CELL;
        const cy = p.row * PX + ORN_CELL;
        glows += `<circle cx="${cx}" cy="${cy}" r="${PX * 2}" fill="url(#orb)"/>`;
        glows += `<rect x="${cx - ORN_CELL / 2}" y="${cy - ORN_CELL / 2}" width="${ORN_CELL}" height="${ORN_CELL}" fill="#ffffff"/>`;
    }
    parts.push(glows);
    // ---- ornament sprites (crisp, smaller cell) ----
    let orns = "";
    for (const p of shown) {
        if (p.kind === "glow")
            continue;
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
    <text x="20" y="40" font-family="'Press Start 2P', monospace" font-size="21" font-weight="700" fill="${palette_1.palette.text}">@${escapeXml(stats.username)}</text>
    <text x="20" y="${H - 18}" font-family="monospace" font-size="14" fill="${palette_1.palette.textMuted}">★ ${stats.total} contributions in ${stats.year}  ·  ${escapeXml(status)}</text>
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
function crownStar() {
    const g = palette_1.palette.starGold[0], o = palette_1.palette.starGold[1], h = palette_1.palette.moonHi;
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
function snowman(col, row) {
    const w = palette_1.palette.snowman, s = palette_1.palette.snowmanShade, k = palette_1.palette.coal, f = palette_1.palette.scarf, n = palette_1.palette.baubleGold[0];
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
function escapeXml(s) {
    return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]));
}


/***/ }),

/***/ 896:
/***/ ((module) => {

module.exports = require("fs");

/***/ }),

/***/ 928:
/***/ ((module) => {

module.exports = require("path");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __nccwpck_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			__webpack_modules__[moduleId].call(module.exports, module, module.exports, __nccwpck_require__);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	if (typeof __nccwpck_require__ !== 'undefined') __nccwpck_require__.ab = __dirname + "/";
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module is referenced by other modules so it can't be inlined
/******/ 	var __webpack_exports__ = __nccwpck_require__(730);
/******/ 	module.exports = __webpack_exports__;
/******/ 	
/******/ })()
;
//# sourceMappingURL=index.js.map