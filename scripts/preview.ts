/**
 * Local preview WITHOUT calling the GitHub API.
 *
 *   npx ts-node scripts/preview.ts          # default sample
 *   TOTAL=600 MAXDAY=20 STREAK=40 npx ts-node scripts/preview.ts
 *
 * Writes preview.svg in the repo root so you can iterate on the tree art fast.
 */
import { promises as fs } from "fs";
import { renderTree } from "../src/render/tree";
import { ContributionStats } from "../src/github/fetch";

const stats: ContributionStats = {
  username: process.env.USERNAME || "octocat",
  year: Number(process.env.YEAR ?? new Date().getUTCFullYear()),
  total: Number(process.env.TOTAL ?? 320),
  maxDay: Number(process.env.MAXDAY ?? 12),
  longestStreak: Number(process.env.STREAK ?? 21),
  currentStreak: Number(process.env.CURRENT ?? 5),
};

const theme = process.env.THEME || "default";

fs.writeFile("preview.svg", renderTree(stats, theme), "utf8").then(() =>
  process.stdout.write(`Wrote preview.svg (theme: ${theme}) — open it in a browser.\n`)
);
