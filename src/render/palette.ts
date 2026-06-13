/**
 * Retro 16-bit MapleStory palette — night sky, big moon, snowy fir.
 * Kept as flat hex strings; the renderer maps them onto a pixel grid.
 */
export const palette = {
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
} as const;
