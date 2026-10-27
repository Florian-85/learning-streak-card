"use strict";
// Chess.com, via its official public API (Published-Data API, no key needed).
// It has no streak: the middle column shows the best rating instead, and the
// right one the number of games, both straight from the response.

const { ConfigError, ProviderError } = require("../errors");
const { fetchJson } = require("../http");
const { MODES } = require("../contract");

const USERNAME = /^[A-Za-z0-9_-]{3,25}$/;
const count = value => Number.isSafeInteger(value) && value >= 0;

function validate(config) {
  if (!USERNAME.test(config.username ?? "")) throw new ConfigError("chesscom: `username` is required (your public Chess.com username)");
  if (config.mode && !MODES.includes(config.mode)) throw new ConfigError(`chesscom: \`mode\` must be one of ${MODES.join(", ")}`);
}

async function collect(config, { fetchImpl, timeoutMs, retryDelayMs }) {
  const mode = config.mode ?? "rapid";
  // Chess.com asks for lower-case usernames in the URL.
  const url = `https://api.chess.com/pub/player/${encodeURIComponent(config.username.toLowerCase())}/stats`;
  const body = await fetchJson(url, { fetchImpl, timeoutMs, retryDelayMs });
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ProviderError("BAD_RESPONSE", "unexpected response shape");
  const stats = body[`chess_${mode}`];
  if (!stats) throw new ProviderError("NO_DATA", `this player has no ${mode} rating yet`);
  const rating = stats.last?.rating;
  if (!count(rating)) throw new ProviderError("BAD_RESPONSE", `unexpected ${mode} rating`);
  const best = count(stats.best?.rating) ? stats.best.rating : null;
  const r = stats.record;
  const games = r && count(r.win) && count(r.loss) && count(r.draw) ? r.win + r.loss + r.draw : null;

  return {
    account: config.username,
    columns: [
      { metric: "rating", value: rating, mode },
      { metric: "bestRating", value: best, mode },
      { metric: "games", value: games, mode },
    ],
  };
}

module.exports = { id: "chesscom", defaultTitle: "Chess.com", validate, collect };
