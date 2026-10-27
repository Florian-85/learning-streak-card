"use strict";
// The data contract between providers and the renderer, and the format of the
// data kept inside the generated SVG. Anything that does not match is rejected:
// a provider (or an old file) can never push an invented or malformed number
// into the card.
//
// card = {
//   v: 1,
//   key:      "duolingo:alice:es"      identifies the source; old data is only reused for the same key
//   provider: "duolingo",
//   account:  "alice",
//   asOf:     "2026-10-27"             UTC day these values were last seen to change
//   columns:  [col, col, col]          left, middle, right
// }
// col = { metric, value, language?, scope?, mode? }   scope "all" = the xp adds up every course
//   value is a number, a "YYYY-MM" month, or null = the source does not give this metric
//   (rendered as an explicit "—", never as 0).

const { ProviderError } = require("./errors");

const KINDS = {
  xp: "count",
  streakDays: "count",
  rating: "count",
  bestRating: "count",
  games: "count",
  studyHours: "hours",
  accountSince: "month",
  startedOn: "month",
};
const METRIC_NAMES = Object.keys(KINDS);
const MODES = ["rapid", "blitz", "bullet", "daily"];
const MAX_COUNT = 1e12;
const MAX_HOURS = 1e7;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const LANGUAGE = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;

const bad = message => new ProviderError("BAD_RESPONSE", message);

function validateColumn(col, now) {
  if (!col || typeof col !== "object") throw bad("column is not an object");
  const kind = KINDS[col.metric];
  if (!kind) throw bad(`unknown metric ${JSON.stringify(col.metric)}`);
  const out = { metric: col.metric, value: null };
  const v = col.value;
  if (v !== null && v !== undefined) {
    if (kind === "count") {
      if (!Number.isSafeInteger(v) || v < 0 || v > MAX_COUNT) throw bad(`${col.metric}: expected an integer between 0 and ${MAX_COUNT}`);
    } else if (kind === "hours") {
      if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > MAX_HOURS) throw bad(`${col.metric}: expected a number of hours`);
    } else {
      const m = typeof v === "string" ? MONTH.exec(v) : null;
      if (!m) throw bad(`${col.metric}: expected YYYY-MM`);
      const nowIndex = now.getUTCFullYear() * 12 + now.getUTCMonth();
      if (Number(m[1]) * 12 + Number(m[2]) - 1 > nowIndex) throw bad(`${col.metric}: ${v} is in the future`);
    }
    out.value = v;
  }
  if (col.language !== undefined) {
    if (typeof col.language !== "string" || !LANGUAGE.test(col.language)) throw bad("invalid language code");
    out.language = col.language;
  }
  if (col.scope !== undefined) {
    if (col.scope !== "all") throw bad("invalid scope");
    out.scope = col.scope;
  }
  if (col.mode !== undefined) {
    if (!MODES.includes(col.mode)) throw bad(`invalid mode ${JSON.stringify(col.mode)}`);
    out.mode = col.mode;
  }
  return out;
}

function validateCard(card, now = new Date()) {
  if (!card || typeof card !== "object") throw bad("card is not an object");
  if (card.v !== 1) throw bad("unsupported card version");
  for (const field of ["key", "provider", "account"]) {
    if (typeof card[field] !== "string" || !card[field] || card[field].length > 200) throw bad(`invalid ${field}`);
  }
  if (typeof card.asOf !== "string" || !DAY.test(card.asOf) || Number.isNaN(Date.parse(card.asOf))) throw bad("invalid asOf");
  if (!Array.isArray(card.columns) || card.columns.length !== 3) throw bad("expected exactly 3 columns");
  const columns = card.columns.map(col => validateColumn(col, now));
  if (columns.every(col => col.value === null)) throw bad("no usable metric");
  return { v: 1, key: card.key, provider: card.provider, account: card.account, asOf: card.asOf, columns };
}

module.exports = { validateCard, METRIC_NAMES, MODES, KINDS };
