# Study: a hosted URL on Cloudflare Workers Free ("Option 1")

**Decision for v0.1: NO-GO.** Nothing was deployed, no Cloudflare account was touched, no hosted endpoint is documented or promised. The GitHub Actions path (Option 2) is the only supported setup. This can be reopened after v0.1 if the blocking points below are answered.

Studied on 2026-10-27. Limits quoted from the [Workers limits page](https://developers.cloudflare.com/workers/platform/limits/) read that day: Free plan, 100,000 requests per day (reset at 00:00 UTC, errors beyond), 10 ms CPU per request (network wait excluded), 50 subrequests, 128 MB memory.

## What was measured

| Question | Result |
|---|---|
| Does rendering fit in 10 ms CPU? | **Yes, by far.** `renderCard` takes about 0.55 ms per card in Node 24 on a developer laptop (20,000 renders, warmed up), output about 2.7 kB. A Worker isolate is slower than a warm laptop but not 15 times. The renderer is pure (no file, no Node API), so it would bundle for a Worker. |
| Could the existing code run there? | The renderer and the HTTP helper yes (`fetch` is standard). The state/fallback logic reads the previous SVG from a file: on a Worker it would need a store (see below). |
| Is a real provider call possible from a Worker? | Not measured: it would need a deployment, which was not authorised. |

## What blocks it

1. **Shared IP and rate limits.** Every user's request would leave from Cloudflare's address space, not from each user's own runner. Chess.com answers parallel requests with HTTP 429 and may block an abnormal application; Duolingo's unofficial endpoint can block datacenter ranges. Unlike the Action (one daily request from the owner's own run), one Worker concentrates everybody's traffic on one footprint. This risk cannot be tested without a deployment and would hit all users at once.
2. **Cache and "never call the provider per view".** It requires a shared cache (Cache API per data center, or KV). The Cache API is per location and not guaranteed; KV is a stored dependency with its own free quotas (to be verified) and propagation delay. GitHub proxies README images through its own image proxy, which also caches, but its lifetime is not under our control and was not measured on a real README. So freshness would be "somewhere between minutes and a day", and unpredictable.
3. **Fallback on the last valid data.** The Action keeps it inside the SVG in the user's repository, for free. A Worker has no repository: keeping the last valid card for each account means a persistent store, i.e. exactly the infrastructure Option 1 is meant to avoid, plus data retention we would be responsible for.
4. **Privacy.** A parameterised URL turns the service into a lookup tool for **any** account: anyone can request someone else's public Duolingo numbers, and the operator logs every username requested. With the Action, the owner chooses to publish their own account. This needs rate limiting per client, a blocklist/opt-out and a privacy policy before going live.
5. **Strict parameters.** Doable (allow-list of provider, theme, language, username pattern, no token or cookie parameter ever), but it is only part of the abuse story, which also needs per-IP limits (extra quota use) and a kill switch.
6. **Cost and maintenance.** Direct cost is zero while under 100,000 requests per day. The risk is operational: past the quota every card breaks for every user, and the maintainer owns on-call, abuse handling, provider blocks and Cloudflare terms. That contradicts "no recurring technical intervention".
7. **Unofficial Duolingo access at scale.** One person's daily call is defensible; a public proxy of an undocumented endpoint for strangers is a different level of use, with Duolingo's terms unverified.

## Conditions to reopen

- A measured deployment (owner-approved) showing Duolingo and Chess.com answer reliably from Workers.
- A cache design without a persistent store, or an accepted free KV budget, with a documented staleness rule consistent with the Action's.
- Owner-only usage (for example each user deploys their own Worker from a template with their account fixed in an environment variable). That removes points 1, 4 and 6, and could ship as an optional template later.

The renderer stays independent of any host: an HTTP adapter would be a thin file on top of `renderCard`, with no change to the engine.
