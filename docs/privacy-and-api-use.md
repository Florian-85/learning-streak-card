# Privacy and API use

## What the tool reads and writes

- **Reads**: public profile numbers of the account you name (Duolingo: XP, streak, creation date; Chess.com: ratings and game counts), or your own JSON file.
- **Writes**: one SVG file in your repository. It contains the displayed values, the account name you configured and, in a `<metadata>` element, the same values again (used as fallback). Nothing else is stored, anywhere.
- **Sends**: one HTTPS GET per run to the provider (one retry on a timeout, a network error or a 5xx), with a `User-Agent` that names this project. No cookie, no password, no token, no personal data of yours. Tests enforce that the code contains no credential handling and talks only to the documented hosts.
- No analytics, no third-party service, no server operated by the project.

If your account is public, the card shows public data. Do not configure an account you do not want displayed in a README: the SVG and its metadata are public in a public repository.

## Provider terms

| Provider | Status | Risk and rules |
|---|---|---|
| Duolingo | **Unofficial.** The endpoint is the one the website uses; it is not a documented API. | It can change, be rate limited or be blocked at any time. Duolingo's Terms and Conditions (last revised 2025-09-08, read on 2026-10-27) state that you may not use "data mining, robots, scraping, or similar data gathering or extraction methods to obtain Service Content". Whether a public profile counter counts as Service Content is a legal question this project does not settle: treat the provider as **tolerated at best, never endorsed by Duolingo**, and use it at your own risk. Mitigations: public data only, no login, one request per run, a daily schedule, and a fallback that keeps the last card. The project does not depend on Duolingo: the manual provider and Chess.com work without it. |
| Chess.com | Official Published-Data API. | Serial requests are unlimited, parallel ones may get HTTP 429; data refreshes at most every 12 to 24 hours. Chess.com asks for a recognisable `User-Agent` with contact information (sent) and respect for its branding (no logo used). |
| Manual | Local file. | None. |

## Do not

- Do not put tokens or cookies in the configuration, in the workflow or in an image URL. The tool has no option for them on purpose.
- Do not lower the interval below a few hours: the data does not move faster.
