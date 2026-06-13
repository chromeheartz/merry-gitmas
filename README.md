# 🎄 merry-gitmas

> **올해 내 GitHub 커밋으로 자라나는 픽셀 크리스마스 트리**
> 연초엔 텅 빈 트리, 커밋을 쌓을수록 장식이 하나둘 늘어나고, 한 해 동안 열심히 하면 꼭대기에 **왕별 👑** 이 뜹니다.

<p align="center">
  <img src="docs/demo-default.svg" width="360" alt="default 테마">
  &nbsp;
  <img src="docs/demo-space.svg" width="360" alt="space 테마">
</p>

---

## ✨ 이게 뭔가요?

GitHub 프로필 README에 넣는 **자동 갱신 위젯**입니다.
매일 한 번 GitHub Action이 돌면서 **올해(1월 1일~오늘) 기여 수**를 읽고,
그에 맞춰 트리 장식을 그린 **SVG 이미지**를 새로 만들어 커밋합니다.

- 사람마다 **장식 위치가 랜덤** (아이디 기반) — 같은 커밋 수라도 트리 모양이 다 다릅니다.
- 같은 사람은 **항상 같은 자리**에 유지되어 트리가 매일 흔들리지 않습니다.
- 게임 에셋을 쓰지 않은 **100% 코드로 그린 오리지널 픽셀아트**라 자유롭게 써도 됩니다.

## ⚙️ 작동 원리

README는 코드를 실행할 수 없기 때문에, "이미지를 주기적으로 다시 그리는" 방식을 씁니다.

```
GitHub Action (매일 cron)
  └─ 올해 기여도 조회        (GraphQL: contributionsCollection)
       └─ SVG 트리 생성       (배경 + 장식 = 기여도 기반)
            └─ 레포에 커밋     (README가 그 SVG를 <img>로 표시)
```

---

## 🚀 사용법

### 1. 프로필 레포 준비

자기 GitHub 아이디와 **똑같은 이름의 레포**(`아이디/아이디`)를 만들면,
그 레포의 `README.md`가 프로필 페이지에 표시됩니다. (이미 있다면 그대로 사용)

### 2. 워크플로우 추가

프로필 레포에 `.github/workflows/build-tree.yml` 파일을 만들고 아래를 붙여넣습니다.

```yaml
name: Build Christmas Tree

on:
  schedule:
    - cron: "0 18 * * *"   # 매일 1회 (UTC 18시)
  workflow_dispatch:        # Actions 탭에서 수동 실행
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
          theme: default          # default | space
          output: profile-tree.svg

      - name: Commit SVG
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "chore: update christmas tree 🎄"
          file_pattern: profile-tree.svg
```

### 3. README에 트리 넣기

```md
![my christmas tree](./profile-tree.svg)
```

### 4. 첫 실행

GitHub **Actions** 탭 → `Build Christmas Tree` → **Run workflow** 를 눌러
첫 이미지를 생성합니다. 이후엔 매일 자동으로 갱신됩니다.

> 💡 **fork 불필요!** `uses:` 한 줄로 참조만 하면 됩니다.
> 트리 디자인을 직접 고치고 싶을 때만 fork 하세요.

---

## 🎁 장식 해금 규칙 (올해 기여도 기준)

트리는 1월 1일에 비어 있고, 올해 기여 수가 구간을 넘을 때마다 새 색깔·아이템이 풀립니다.

| 올해 기여 수 | 해금되는 장식        |
| :---------: | :------------------- |
| `1`         | 💡 전구 (불빛)        |
| `8`         | 🔵 파란 구슬          |
| `25`        | 🟡 금색 구슬          |
| `45`        | ⭐ 초록 별            |
| `70`        | 🔴 빨간 구슬          |
| `100`       | ✨ 금색 별            |
| `140`       | 🍬 지팡이 사탕        |
| `185`       | 💙 파란 별            |
| `235`~`270` | 추가 장식 (트리 가득)  |
| **`300`**   | **👑 꼭대기 왕별**    |

> 숫자는 모두 `src/render/tree.ts` 의 `UNLOCKS` / `CROWN_AT` 상수에서 바로 조정할 수 있습니다.

## 🌌 테마

`theme` 입력으로 배경을 고릅니다. 트리·장식은 그대로, 배경만 바뀝니다.

| 값        | 배경                          |
| --------- | ----------------------------- |
| `default` | 눈 내리는 밤하늘 + 달          |
| `space`   | 보라빛 우주 + 고리 행성 + 성운 |

새 테마는 `src/render/themes.ts` 의 `THEMES` 에 추가하면 됩니다.

## 📥 입력 (inputs)

| 이름           | 필수 | 기본값             | 설명                                            |
| -------------- | :--: | ------------------ | ----------------------------------------------- |
| `github_token` |  ✅  | —                  | 기여도 조회용 토큰. `${{ secrets.GITHUB_TOKEN }}` |
| `username`     |  —   | 레포 주인          | 트리를 그릴 GitHub 아이디                        |
| `theme`        |  —   | `default`          | 배경 테마 (`default` / `space`)                 |
| `output`       |  —   | `profile-tree.svg` | 생성할 SVG 경로                                  |

---

## 🛠 로컬 개발

```bash
npm install

# API 없이 빠르게 트리 미리보기 → preview.svg
npm run preview
TOTAL=300 THEME=space npm run preview   # 변수로 상태 흉내내기

# 실제 GitHub 데이터로 실행
GITHUB_TOKEN=ghp_xxx USERNAME=내아이디 npx ts-node src/main.ts
```

미리보기에서 쓸 수 있는 환경변수: `TOTAL`(올해 기여 수), `MAXDAY`, `STREAK`, `THEME`, `YEAR`, `USERNAME`.

## 📦 배포 (릴리스)

GitHub Action은 **번들된 `dist/index.js`** 를 실행하므로, 빌드 산출물을 커밋해야 합니다.

```bash
npm run package          # src → dist/index.js 번들 (ncc)
git add dist && git commit -m "build dist"
git tag v1 && git push --tags
```

이후 다른 사람들이 `uses: chromeheartz/merry-gitmas@v1` 로 사용할 수 있습니다.

## 🎨 커스터마이징

| 무엇을              | 어디서                                 |
| ------------------- | -------------------------------------- |
| 해금 구간 / 왕별 기준 | `src/render/tree.ts` → `UNLOCKS`, `CROWN_AT` |
| 트리 모양 / 비율    | `src/render/tree.ts` → `TIERS`         |
| 장식 종류 / 색      | `src/render/tree.ts` → `SPRITE`, `palette.ts` |
| 배경 테마           | `src/render/themes.ts`                 |

## 📄 라이선스

MIT
