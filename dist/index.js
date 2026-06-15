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
// pixel-art background helpers (used by the space theme)
// ---------------------------------------------------------------------------
const PXC = 8; // background pixel cell
const sq = (x, y, s, fill, op = 1) => `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${fill}"${op < 1 ? ` opacity="${op}"` : ""}/>`;
/**
 * Seamless one-direction scroll: lays the content twice (side by side) and
 * slides the pair by exactly one width, looping forever with no visible jump.
 * Clipped by the frame, so clouds exit one edge and re-enter the other.
 */
function scrollLoop(content, w, dur, dir = -1) {
    const second = dir < 0 ? w : -w; // second copy sits on the incoming side
    const to = dir < 0 ? `${-w} 0` : `${w} 0`;
    return `<g>
    <g>${content}</g>
    <g transform="translate(${second} 0)">${content}</g>
    <animateTransform attributeName="transform" type="translate" from="0 0" to="${to}" dur="${dur}s" repeatCount="indefinite" calcMode="linear"/>
  </g>`;
}
/** chunky pixel planet, lit from the upper-left; optional horizontal bands */
function pixelPlanet(cx, cy, r, [hi, mid, lo, out], bands = false) {
    const ox = Math.round(cx / PXC) * PXC;
    const oy = Math.round(cy / PXC) * PXC;
    const Rc = Math.ceil(r / PXC);
    let s = "";
    for (let gy = -Rc; gy <= Rc; gy++) {
        for (let gx = -Rc; gx <= Rc; gx++) {
            const dx = gx * PXC;
            const dy = gy * PXC;
            if (Math.sqrt(dx * dx + dy * dy) > r)
                continue;
            let col;
            if (Math.sqrt(dx * dx + dy * dy) > r - PXC)
                col = out; // dark rim
            else {
                const light = (-dx - dy) / r; // upper-left brighter
                col = light > 0.45 ? hi : light < -0.2 ? lo : mid;
                if (bands && Math.floor((oy + dy) / (PXC * 2)) % 2 === 0 && col === mid)
                    col = lo;
            }
            s += sq(ox + dx, oy + dy, PXC, col);
        }
    }
    return `<g shape-rendering="crispEdges">${s}</g>`;
}
/** 4-point sparkle star (bright core + fading arms) */
function sparkle(cx, cy, arms, color) {
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
function twinkleSparkle(cx, cy, arms, color, dur, begin) {
    const inner = sparkle(0, 0, arms, color); // centred at origin so scale pulses in place
    return `<g transform="translate(${Math.round(cx)} ${Math.round(cy)})"><g>${inner}<animate attributeName="opacity" values="1;0.25;1" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="scale" values="1;0.55;1" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/></g></g>`;
}
/** diagonal shooting-star streak with a bright head (u = pixel size) */
function shootingStar(x, y, len, color, u = 4) {
    let s = "";
    for (let i = 0; i < len; i++)
        s += sq(x + i * u, y + i * u, u, color, 1 - (i / len) * 0.8);
    s += sq(x + len * u, y + len * u, Math.round(u * 1.5), "#ffffff");
    return `<g shape-rendering="crispEdges">${s}</g>`;
}
/** a shooting star that streaks across, fades out, pauses, then repeats */
function meteor(sx, sy, len, color, dx, dy, dur, begin, u = 8) {
    const streak = shootingStar(0, 0, len, color, u); // drawn at origin, group is moved
    return `<g opacity="0">${streak}
    <animateTransform attributeName="transform" type="translate" values="${sx} ${sy}; ${sx + dx} ${sy + dy}; ${sx + dx} ${sy + dy}" keyTimes="0;0.22;1" dur="${dur}s" begin="${begin}s" repeatCount="indefinite" calcMode="linear"/>
    <animate attributeName="opacity" values="0;1;1;0;0" keyTimes="0;0.03;0.18;0.24;1" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>
  </g>`;
}
/** chunky snow-capped pixel mountain (snow on top, rock below, lit from left) */
function pixelMountain(peakX, peakY, baseY, halfW, snowFrac, [snow, snowSh, rock, rockSh]) {
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
function pixelCloud(cx, cy, scale) {
    const puffs = [
        [-2.4, 0.3, 1.5],
        [-1.2, -0.5, 1.9],
        [0.2, -0.95, 2.1],
        [1.6, -0.45, 1.8],
        [2.7, 0.25, 1.35],
        [0.1, 0.5, 2.2],
        [-1.7, 0.6, 1.4],
        [1.5, 0.6, 1.5],
    ];
    const ps = puffs.map(([dx, dy, r]) => [cx + dx * scale * PXC, cy + dy * scale * PXC, r * scale * PXC]);
    const g = (v) => Math.round(v / PXC);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [px, py, r] of ps) {
        minX = Math.min(minX, px - r);
        maxX = Math.max(maxX, px + r);
        minY = Math.min(minY, py - r);
        maxY = Math.max(maxY, py + r);
    }
    const has = new Set();
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
function snowfall(w, h, count) {
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
function tinyPine(cx, topY, green) {
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
const defaultTheme = {
    name: "default",
    skyTop: palette_1.palette.skyTop,
    skyBottom: palette_1.palette.skyBottom,
    starColor: palette_1.palette.star,
    starCount: 72,
    twinkle: true, // the small star dots blink
    // a few bigger sparkle stars that pulse, for extra christmas magic
    ambient: (w, h) => [
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
        <stop offset="0" stop-color="${palette_1.palette.moonHi}"/>
        <stop offset="0.7" stop-color="${palette_1.palette.moon}"/>
        <stop offset="1" stop-color="${palette_1.palette.moon}" stop-opacity="0"/>
      </radialGradient>
      <circle cx="${w - 150}" cy="160" r="${r}" fill="url(#th-moon)"/>`;
    },
};
// ---------------------------------------------------------------------------
// space — deep pixel cosmos: chunky planets, sparkle stars, a shooting star
// ---------------------------------------------------------------------------
const spaceTheme = {
    name: "space",
    skyTop: "#0a0a26",
    skyBottom: "#181840",
    starColor: "#ffffff",
    starCount: 80,
    starPalette: ["#ffffff", "#9fe3ff", "#ffd0ec", "#fff2b0", "#8fb0ff", "#ff8f6a", "#c79bff"],
    // subtle horizontal nebula bands (like the reference)
    ambient: (w, h) => `<rect x="0" y="${Math.round(h * 0.36)}" width="${w}" height="30" fill="#2a2a5e" opacity="0.22"/>` +
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
const winterTheme = {
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
        for (const px of [0.06, 0.14, 0.78, 0.88, 0.95])
            s += tinyPine(w * px, 286, "#5c8a5a");
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
const skyTheme = {
    name: "sky",
    skyTop: "#2f63c8",
    skyBottom: "#a9cdee",
    starColor: "#ffffff",
    starCount: 0,
    ambient: (w, h) => {
        const field = (rows) => rows.map(([fx, fy, sc]) => pixelCloud(w * fx, h * fy, sc)).join("");
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
const THEMES = {
    default: defaultTheme,
    space: spaceTheme,
    winter: winterTheme,
    sky: skyTheme,
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
/**
 * Per-column downward droop of a tier's branch edge, so each layer ends in a
 * wavy row of drooping branch tips instead of a ruler-straight line.
 * Deterministic (depends only on column + tier) — no rng, so it never shifts
 * ornaments or snow.
 */
function branchDroop(c, tierIdx) {
    const x = c + tierIdx * 5;
    const w = Math.sin(x * 0.8) * 0.6 + Math.sin(x * 1.7 + 2) * 0.4;
    return Math.round((w * 0.5 + 0.5) * 4); // 0..4 rows
}
function rasterTree(grid, rng, snowFactor) {
    // foliage tiers (classic cone), top drawn last so upper layers overlap lower
    for (let i = TIERS.length - 1; i >= 0; i--) {
        const t = TIERS[i];
        const DROOP_MAX = 4;
        for (let r = t.apex; r <= t.base + DROOP_MAX; r++) {
            const hw = r <= t.base ? halfWidthAt(t, r) : t.half;
            if (hw < 0)
                continue;
            for (let c = CX - hw; c <= CX + hw; c++) {
                // each column droops a wavy amount → tier ends in drooping tips, not a line
                const bottom = t.base + branchDroop(c, i);
                if (r > bottom)
                    continue; // carve the scalloped underside
                const edge = Math.abs(c - CX) / (hw + 1);
                let col = palette_1.palette.leafMid;
                if (edge > 0.72)
                    col = palette_1.palette.leafLo; // darker toward the edges
                else if (edge < 0.3 && r < t.apex + (t.base - t.apex) * 0.5)
                    col = palette_1.palette.leafHi;
                // pixel speckle texture so the green isn't flat (the "dot" feel)
                const n = cellNoise(c, r);
                if (r < bottom - 1) {
                    if (n > 0.86)
                        col = palette_1.palette.leafHi;
                    else if (n < 0.14)
                        col = palette_1.palette.leafLo;
                    else if (n > 0.6 && col === palette_1.palette.leafMid)
                        col = palette_1.palette.leafLo; // sparse darker dabs
                }
                // wavy shaded underside that follows each branch tip (no flat line)
                if (r >= bottom - 1)
                    col = r === bottom ? palette_1.palette.leafShadow : palette_1.palette.leafLo;
                grid.set(c, r, col);
            }
        }
        // snow: rounded white humps that ACCUMULATE with contributions.
        // Each hump slot gets a fixed `appear` threshold; it shows once snowFactor
        // crosses it, so snow only ever grows (never relocates). rng is consumed
        // the same way regardless of total, so ornament positions stay stable.
        for (let row = t.apex + 1; row <= t.base - 1; row += 3) {
            const hw = halfWidthAt(t, row);
            if (hw < 2)
                continue;
            let c = CX - hw;
            while (c <= CX + hw) {
                const appear = rng();
                const w = 3 + Math.floor(rng() * 6);
                const adv = w + 2 + Math.floor(rng() * 3);
                if (appear < 0.7 * snowFactor) {
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
            for (let c = CX - 1; c <= CX + 1; c++)
                grid.set(c, r, palette_1.palette.snow);
        }
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
    // ---- star dots (optionally twinkling) ----
    let sky = "";
    for (let i = 0; i < theme.starCount; i++) {
        const x = Math.floor(rng() * W);
        // cover the whole sky (down to just above the snowy ground), not just the top
        const y = Math.floor(rng() * (GROUND_ROW * PX - 16));
        const s = Math.round((rng() > 0.85 ? PX : PX / 2) * 1.7);
        const col = theme.starPalette
            ? theme.starPalette[Math.floor(rng() * theme.starPalette.length)]
            : theme.starColor;
        const op = (0.5 + rng() * 0.5).toFixed(2);
        if (theme.twinkle) {
            const dur = (1.4 + rng() * 2.4).toFixed(2);
            const begin = (rng() * 3).toFixed(2);
            sky += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${col}"><animate attributeName="opacity" values="${op};0.1;${op}" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/></rect>`;
        }
        else {
            sky += `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${col}" opacity="${op}"/>`;
        }
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
    // ---- crown star (왕별): only once this year hits CROWN_AT — and it twinkles ----
    if (crown) {
        const sx = CX * PX;
        const sy = 5 * PX;
        // pulsing glow halo
        parts.push(`<circle cx="${sx}" cy="${sy}" r="${PX * 4}" fill="url(#orb)">
      <animate attributeName="opacity" values="0.45;1;0.45" dur="1.8s" repeatCount="indefinite"/>
      <animate attributeName="r" values="${PX * 3.2};${PX * 4.8};${PX * 3.2}" dur="1.8s" repeatCount="indefinite"/>
    </circle>`);
        parts.push(`<g shape-rendering="crispEdges">${blitSprite(crownStar(), CX - 5, 0)}</g>`);
        // sparkle burst (a small cross that scales + fades over the star)
        parts.push(`<g transform="translate(${sx} ${sy})">
      <g opacity="0">
        <rect x="-1.5" y="-15" width="3" height="30" fill="#fff6c9"/>
        <rect x="-15" y="-1.5" width="30" height="3" fill="#fff6c9"/>
        <animate attributeName="opacity" values="0;0.95;0" dur="2.2s" repeatCount="indefinite"/>
        <animateTransform attributeName="transform" type="scale" values="0.3;1.1;0.3" dur="2.2s" repeatCount="indefinite"/>
      </g>
    </g>`);
    }
    // ---- small snowman standing on the ground, clear of the tree ----
    parts.push(`<g shape-rendering="crispEdges">${snowman(COLS - 6, GROUND_ROW - 7)}</g>`);
    // ---- foreground (e.g. falling snow), in front of the tree, behind the text ----
    if (theme.foreground)
        parts.push(theme.foreground(W, H));
    // ---- text ----
    const next = nextUnlock(stats.total);
    const status = crown
        ? "👑 crowned!"
        : next
            ? `next: ${next.label} @ ${next.at}`
            : "✦ fully decorated";
    parts.push(`
    <text x="20" y="40" font-family="'Press Start 2P', monospace" font-size="21" font-weight="700" fill="${theme.text ?? palette_1.palette.text}">@${escapeXml(stats.username)}</text>
    <text x="20" y="${H - 18}" font-family="monospace" font-size="14" fill="${theme.textMuted ?? palette_1.palette.textMuted}">★ ${stats.total} contributions in ${stats.year}  ·  ${escapeXml(status)}</text>
  `);
    // intrinsic display size (default 350px wide); viewBox keeps the crisp art.
    // Everything is clipped to the frame so backgrounds never spill past the edges.
    const dw = Math.max(80, Math.round(displayWidth));
    const dh = Math.round((dw * H) / W);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${dw}" height="${dh}" viewBox="0 0 ${W} ${H}" style="shape-rendering:crispEdges" role="img" aria-label="${escapeXml(stats.username)}'s pixel christmas tree"><defs><clipPath id="frame"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath></defs><g clip-path="url(#frame)">${parts.join("")}</g></svg>`;
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