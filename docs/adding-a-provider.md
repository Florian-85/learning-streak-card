# Adding a provider

A provider is one file in `src/providers/` plus one line in `src/providers/index.js`. It only returns three **columns** of the shared contract; it never draws anything.

## 1. The contract

```js
// returned by collect():
{
  account: "alice",            // shown in the accessible label
  title: "Optional header",    // optional, otherwise defaultTitle
  columns: [colLeft, colMiddle, colRight],
}
// col = { metric, value, language?, scope?, mode? }
```

`metric` is one of the names in `src/contract.js` (`xp`, `streakDays`, `rating`, `bestRating`, `games`, `studyHours`, `accountSince`, `startedOn`). `value` is a safe integer, hours, a `"YYYY-MM"` month, or **`null` when the service does not give it** (the card prints "—"). Never put 0, an estimate or a guess in place of a missing value; never turn the account creation date into study time.

A new kind of number? Add it to `KINDS` in `src/contract.js` and to `metrics` (both languages) in `src/i18n.js`, then to `describe()` / `icon()` in `src/render.js`.

## 2. The file

```js
"use strict";
const { ConfigError, ProviderError } = require("../errors");
const { fetchJson } = require("../http");

function validate(config) {                 // before any request; bad input -> ConfigError
  if (!/^[a-z0-9_]{1,40}$/i.test(config.username ?? "")) throw new ConfigError("myservice: `username` is required");
}

async function collect(config, { fetchImpl, timeoutMs, retryDelayMs }) {
  const body = await fetchJson(`https://api.example.com/users/${encodeURIComponent(config.username)}`, { fetchImpl, timeoutMs, retryDelayMs });
  if (typeof body?.score !== "number") throw new ProviderError("BAD_RESPONSE", "unexpected response shape");
  return { account: config.username, columns: [
    { metric: "rating", value: body.score },
    { metric: "bestRating", value: body.best ?? null },
    { metric: "games", value: null },
  ] };
}

module.exports = { id: "myservice", defaultTitle: "My Service", validate, collect };
```

Rules:

- Use `fetchJson`: it gives the timeout, one retry on transient errors, the size limit, and turns 404 into `NOT_FOUND` and 429 into `RATE_LIMITED`.
- Throw `ProviderError` (codes: `NOT_FOUND`, `NO_DATA`, `RATE_LIMITED`, `TIMEOUT`, `NETWORK`, `HTTP`, `BAD_RESPONSE`) for anything that comes from the service: `generate()` then keeps the last valid card. Throw `ConfigError` for the user's mistakes: those are never masked.
- Public data only: no password, cookie or token. Document whether the endpoint is official.
- Read `config` options you need (`config.username`, `config.mode`, ...); add new CLI flags to `VALUE_FLAGS` in `bin/cli.js` and inputs to `action.yml` if they are new.

## 3. Register and test

Add `require("./myservice")` to the list in `src/providers/index.js`, save real (trimmed, anonymised) responses in `test/fixtures/`, and copy the cases of `test/providers.test.js`: success, not found, rate limit, network, timeout, bad JSON, bad shape, missing optional values, invalid config. Tests must stay offline (`fromFixture`, `fakeFetch`). Update the provider table in the README and `docs/providers.md`.
