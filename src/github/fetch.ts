/**
 * Fetch a user's GitHub contribution calendar and reduce it to the few
 * numbers the tree renderer cares about.
 *
 * Uses the GitHub GraphQL API (`contributionsCollection`). Node 20's global
 * `fetch` is used, so there are no runtime dependencies.
 */

export interface ContributionStats {
  username: string;
  /** Calendar year the stats are scoped to (e.g. 2026). */
  year: number;
  /** Total contributions made SO FAR THIS calendar year (Jan 1 → now). */
  total: number;
  /** Highest single-day contribution count in the window. */
  maxDay: number;
  /** Longest run of consecutive days with at least one contribution. */
  longestStreak: number;
  /** Current ongoing streak ending today/yesterday. */
  currentStreak: number;
}

interface ContributionDay {
  contributionCount: number;
  date: string;
}

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

export async function fetchStats(
  username: string,
  token: string
): Promise<ContributionStats> {
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
    throw new Error(
      `GitHub API request failed: ${res.status} ${res.statusText}`
    );
  }

  const json = (await res.json()) as {
    data?: {
      user?: {
        contributionsCollection?: {
          contributionCalendar?: {
            totalContributions: number;
            weeks: { contributionDays: ContributionDay[] }[];
          };
        };
      };
    };
    errors?: { message: string }[];
  };

  if (json.errors?.length) {
    throw new Error(`GraphQL error: ${json.errors.map((e) => e.message).join("; ")}`);
  }

  const calendar = json.data?.user?.contributionsCollection?.contributionCalendar;
  if (!calendar) {
    throw new Error(`No contribution data found for user "${username}".`);
  }

  const days: ContributionDay[] = calendar.weeks
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

function longestStreak(days: ContributionDay[]): number {
  let best = 0;
  let run = 0;
  for (const d of days) {
    if (d.contributionCount > 0) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return best;
}

function currentStreak(days: ContributionDay[]): number {
  // Walk backwards from the most recent day. Today counting as 0 is fine —
  // the streak is whatever consecutive active days lead up to the end.
  let run = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].contributionCount > 0) run += 1;
    else break;
  }
  return run;
}
