# 🎄 merry-gitmas

> **A pixel-art Christmas tree that grows from your GitHub contributions this year.**
> It starts as a bare green tree in January; as you commit, **snow piles up and ornaments unlock one by one**, and a **crown star 👑** appears once you hit a big year.

<p align="center">
  <img src="docs/demo-default.svg" width="270" alt="default theme">
  <img src="docs/demo-space.svg" width="270" alt="space theme">
  <br/>
  <img src="docs/demo-winter.svg" width="270" alt="winter theme">
  <img src="docs/demo-sky.svg" width="270" alt="sky theme">
</p>

> 4 themes — `default` 🌙 / `space` 🪐 / `winter` 🏔️ / `sky` ☁️. **The backgrounds are animated.**

<p align="center"><b>🇺🇸 English</b> · <a href="README.ko.md">🇰🇷 한국어</a></p>

---

## ✨ What is this?

A **self-updating widget for your GitHub profile README**.
Once a day a GitHub Action reads your **contribution count for the current year** (Jan 1 → today)
and regenerates an **SVG image** of a Christmas tree decorated to match, then commits it back to your repo.

- **Animated background** — twinkling stars, drifting clouds, meteor showers, and falling snow. (Not a GIF — infinite-loop animated SVG.)
- **Snow accumulates with your commits** — a bare green tree early in the year, gradually covered in snow as your contributions grow. (Accumulated snow never disappears.)
- **Per-user randomized layout** (seeded by username) — even with the same commit count, every tree looks different.
- The same person always gets **the same layout**, so the tree doesn't jitter day to day.
- **100% original pixel art drawn in code** — no game assets, free to use.

## ⚙️ How it works

A README can't run code, so the trick is to "redraw an image on a schedule."

```
GitHub Action (daily cron)
  └─ fetch this year's contributions   (GraphQL: contributionsCollection)
       └─ render SVG tree              (background + ornaments = based on contributions)
            └─ commit to repo          (README shows that SVG via <img>)
```

---

## 🚀 Usage

### 1. Set up your profile repo

Create a repo with **the same name as your GitHub username** (`username/username`).
Its `README.md` is shown on your profile page. (If you already have one, just use it.)

### 2. Add the workflow

Create `.github/workflows/build-tree.yml` in your profile repo and paste the following.
(Defining `theme` as a `choice` input lets you pick a theme from a dropdown under **Actions → Run workflow**.)

```yaml
name: Build Christmas Tree

on:
  schedule:
    - cron: "0 18 * * *"   # once a day (18:00 UTC)
  workflow_dispatch:        # manual run from the Actions tab (theme dropdown)
    inputs:
      theme:
        description: "Background theme"
        type: choice
        default: default
        options: [default, space, winter, sky]
  push:
    branches: [main]

permissions:
  contents: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Generate tree
        uses: chromeheartz/merry-gitmas@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          theme: ${{ inputs.theme || 'default' }}   # default | space | winter | sky
          width: 350                                 # image width in px (default 350)
          output: profile-tree.svg

      - name: Commit SVG
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "chore: update christmas tree 🎄"
          file_pattern: profile-tree.svg
```

### 3. Embed the tree in your README

Wrapping it in a link so clicking the image leads back here is recommended:

```md
[![my christmas tree](./profile-tree.svg)](https://github.com/chromeheartz/merry-gitmas)
```

> To tweak the size, change the `width` input, or use HTML like `<a href="..."><img src="./profile-tree.svg" width="350"></a>`.

### 4. First run

Go to the **Actions** tab → `Build Christmas Tree` → **Run workflow** to generate the first image.
After that it updates automatically every day.

> 💡 **No fork needed!** Just reference it with a single `uses:` line.
> Only fork if you want to customize the tree design yourself.

---

## 🎁 Growth rules (based on this year's contributions)

The tree starts **bare and green** on January 1st. As your contribution count grows, **snow gradually builds up** (fully unlocked at 300), and each milestone unlocks new colors and items.

| Contributions this year | Unlocked decoration        |
| :---------------------: | :------------------------- |
| `1`                     | 💡 lights                   |
| `8`                     | 🔵 blue baubles             |
| `25`                    | 🟡 gold baubles             |
| `45`                    | ⭐ green stars              |
| `70`                    | 🔴 red baubles              |
| `100`                   | ✨ gold stars               |
| `140`                   | 🍬 candy canes              |
| `185`                   | 💙 blue stars               |
| `235`–`270`             | extra ornaments (full tree) |
| **`300`**               | **❄️ full snow + 👑 crown star on top** |

> All thresholds can be tuned directly in `src/render/tree.ts` via the `UNLOCKS` / `CROWN_AT` constants.

## 🌌 Themes

The `theme` input selects the background. The tree and ornaments stay the same — **only the background changes, and it animates.**

| Value     | Background                    | Animation               |
| --------- | ----------------------------- | ----------------------- |
| `default` | night sky + moon              | ✨ twinkling stars      |
| `space`   | pixel cosmos + planets        | ☄️ meteor shower        |
| `winter`  | snowy mountains + conifers    | ❄️ heavy falling snow   |
| `sky`     | blue sky + puffy clouds       | ☁️ drifting clouds      |

> The **crown star (300 commits)** twinkles in every theme. All animations are infinite-loop SVG, not GIFs — lightweight and crisp.

Add new themes in `THEMES` inside `src/render/themes.ts`.

## 📥 Inputs

| Name           | Required | Default            | Description                                       |
| -------------- | :------: | ------------------ | ------------------------------------------------- |
| `github_token` |   ✅     | —                  | Token to read contributions. `${{ secrets.GITHUB_TOKEN }}` |
| `username`     |   —      | repo owner         | GitHub username to render the tree for            |
| `theme`        |   —      | `default`          | Background theme (`default` / `space` / `winter` / `sky`) |
| `width`        |   —      | `350`              | Image width in px (height auto from aspect ratio) |
| `output`       |   —      | `profile-tree.svg` | Output SVG path                                   |

---

## 🛠 Local development

```bash
npm install

# Quick preview without the API → preview.svg
npm run preview
TOTAL=300 THEME=space npm run preview   # fake a state via env vars

# Run against real GitHub data
GITHUB_TOKEN=ghp_xxx USERNAME=yourname npx ts-node src/main.ts
```

Preview env vars: `TOTAL` (this year's contributions), `MAXDAY`, `STREAK`, `THEME`, `YEAR`, `USERNAME`.

## 📦 Publishing (releases)

The Action runs the **bundled `dist/index.js`**, so the build output must be committed.

```bash
npm run package          # bundle src → dist/index.js (ncc)
git add dist && git commit -m "build dist"
git tag v1 && git push --tags
```

Others can then use it via `uses: chromeheartz/merry-gitmas@v1`.

## 🎨 Customizing

| What                      | Where                                  |
| ------------------------- | -------------------------------------- |
| Unlock thresholds / crown | `src/render/tree.ts` → `UNLOCKS`, `CROWN_AT` |
| Tree shape / proportions  | `src/render/tree.ts` → `TIERS`         |
| Ornament types / colors   | `src/render/tree.ts` → `SPRITE`, `palette.ts` |
| Background themes         | `src/render/themes.ts`                 |

## 📄 License

MIT
