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

import { promises as fs } from "fs";
import * as path from "path";
import { fetchStats } from "./github/fetch";
import { renderTree } from "./render/tree";

function getInput(name: string, fallback = ""): string {
  const key = name.toUpperCase();
  return (
    process.env[`INPUT_${key}`] ?? // GitHub Actions `with:` inputs
    process.env[key] ?? // plain env var for local runs
    fallback
  ).trim();
}

async function main(): Promise<void> {
  const token = getInput("github_token") || getInput("github-token");
  if (!token) {
    throw new Error("Missing input: github_token (use secrets.GITHUB_TOKEN).");
  }

  // username defaults to the repo owner when run inside Actions
  const username =
    getInput("username") || process.env.GITHUB_REPOSITORY_OWNER || "";
  if (!username) {
    throw new Error("Missing input: username (could not infer from environment).");
  }

  const output = getInput("output", "profile-tree.svg");
  const theme = getInput("theme", "default");

  process.stdout.write(`Fetching contributions for @${username}…\n`);
  const stats = await fetchStats(username, token);
  process.stdout.write(
    `  total=${stats.total} maxDay=${stats.maxDay} longestStreak=${stats.longestStreak}\n`
  );

  const svg = renderTree(stats, theme);
  const outPath = path.resolve(process.cwd(), output);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, svg, "utf8");
  process.stdout.write(`Wrote ${outPath}\n`);
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
