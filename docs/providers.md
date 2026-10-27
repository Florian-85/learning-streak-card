# Provider candidates

Measured on **2026-10-20** with public accounts. Everything here is public profile data: no password, no cookie.
"Unofficial" means the endpoint is public but not documented as an API, so it can change without notice: such providers
must stay optional and fall back to the last known value.

## Status in v0.1

| Provider | v0.1 | Notes |
|---|---|---|
| Duolingo | **implemented** | unofficial endpoint, see [privacy-and-api-use.md](privacy-and-api-use.md) |
| Chess.com | **implemented** (second provider) | chosen over Codewars: official API, higher priority in the ranking below, and rating/best rating/games are all real fields. No streak |
| Manual | **implemented** | |
| Others | not started | one file each, see [adding-a-provider.md](adding-a-provider.md) |

## Priority

| # | Provider | Why this rank |
|---|---|---|
| 1 | **Duolingo** | The owner's own use, the largest audience, and the code already exists. Few developers, little competition (12 stars). |
| 2 | **LeetCode** | By far the closest to GitHub profiles (15 058 repositories on the topic) and it has a streak (active days). Existing cards focus on solved counts, not on the streak. Unofficial. |
| 3 | **Chess.com** | Very large audience, official stable API, weak competition (29 stars). No streak: show the rating instead. |
| 4 | **Codeforces** | Smaller, very technical audience, official API (rating, rank). |
| 5 | **Codewars** | Developer audience, documented public API (honor, rank, completed kata). |
| 6 | **Lichess** | Official API, small overlap with GitHub profiles so far. |
| 7 | **Monkeytype** | Free access with XP and streak, but a small audience. |
| early | **Manual provider** | A JSON file kept up to date by the user: covers any service without an API (certifications, online courses) and keeps the card useful when an unofficial source breaks. Build it right after the first real provider. |

## Audience, GitHub signal and competition

| Provider | Users (source) | GitHub repositories on the topic | Best existing README card |
|---|---|---|---|
| Chess.com | 252 M+ members at 2026-03-31, about 9.7 M daily actives ([board report Q1 2026](https://www.chess.com/board-reports/2026-q1)); 268.6 M in July 2026 per [Wikipedia](https://en.wikipedia.org/wiki/Chess.com), unverified | 9 044 (`chess`, all services) | 29 stars (`Balastrong/chess-stats-action`) |
| Duolingo | 140.6 M monthly and 58.7 M daily actives, Q2 2026 ([company results](https://pulse2.com/duolingo-daily-active-users-reach-58-7-million-as-retention-hits-record-84-and-social-accounts-top-1-billion-organic-impressions/)) | 297 | 12 stars (`centrumek/duolingo-readme-stats`) |
| LeetCode | over 12 M registered, third-party estimate with no primary source | 15 058 | 338 stars (`songquanpeng/stats-cards`, several services) |
| Lichess | over 4 M actives in January 2023, no published total | 588 | 4 stars |
| Codeforces | about 1.7 M accounts per a [Wikipedia mirror](https://www.Wikipedia.org/wiki/Codeforces); 345 000 rated users in 2021 | 2 896 | 254 stars (`sudiptob2/cf-stats`) |
| Codewars | no total found; the site claims 75 000+ new members a month | 1 401 | 83 stars (`DiniFarb/codewars_readme_stats`) |
| Monkeytype | no total found; about 120 000 daily users in 2023, 14.8 M visits in January 2026 | 156 | 4 stars |

Treat the last three user counts as orders of magnitude only. Competition was measured with GitHub repository search, so
it is approximate.

## Endpoints tested (2026-10-20)

| Provider | Endpoint | Access | What it returns |
|---|---|---|---|
| Duolingo | `GET https://www.duolingo.com/2017-06-30/users?username=<name>` | unofficial, public profile required | per-course XP, `streakData.currentStreak` (length, start date), total XP, creation date. **No course level.** |
| LeetCode | `POST https://leetcode.com/graphql` with `matchedUser(username){ submitStatsGlobal{ acSubmissionNum{ difficulty count } } userCalendar{ streak totalActiveDays } }` | unofficial GraphQL | solved counts by difficulty, streak, active days |
| Chess.com | `GET https://api.chess.com/pub/player/<name>/stats` | official public API | ratings per time control (rapid, blitz, bullet, daily, FIDE) |
| Codeforces | `GET https://codeforces.com/api/user.info?handles=<name>` | official API | rating, rank, max rating |
| Codewars | `GET https://www.codewars.com/api/v1/users/<name>` | public documented API | honor, overall rank, completed kata, leaderboard position |
| Lichess | `GET https://lichess.org/api/user/<name>` | official API | ratings per mode, total play time |
| Monkeytype | `GET https://api.monkeytype.com/users/<name>/profile` | public, no key | XP, streak, max streak, personal bests |

## Not usable for now

| Service | Reason |
|---|---|
| freeCodeCamp | the public profile endpoint tested returns 404 |
| TryHackMe | rate limiting (HTTP 429) during the test |
| Anki | local only (AnkiConnect), not reachable from a scheduled Action |
| WakaTime, Advent of Code, Todoist | need an API key, a session cookie or a token |
| Credly (badges, certifications) | **to check**: interesting for job searches |

## Design consequences

- A **streak** exists for Duolingo, LeetCode and Monkeytype. For Codewars, Codeforces, Chess.com and Lichess the middle
  column should show another number (rank, rating): decide per provider and document it.
- Every provider declares which of the common measures it can fill (main number, streak, duration) and which labels it uses.
- A provider failure never blocks generation or publication.
