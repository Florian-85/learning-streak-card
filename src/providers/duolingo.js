"use strict";
// Duolingo, public profile only. UNOFFICIAL: this is the endpoint the Duolingo
// website itself uses, it is not a documented API and can change or disappear.
// No password, no cookie, no token. See docs/privacy-and-api-use.md.

const { ConfigError, ProviderError } = require("../errors");
const { fetchJson } = require("../http");

const USERNAME = /^[A-Za-z0-9._-]{1,64}$/;
const LANGUAGE = /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/;
const count = value => Number.isSafeInteger(value) && value >= 0;

function validate(config) {
  if (!USERNAME.test(config.username ?? "")) throw new ConfigError("duolingo: `username` is required (your public Duolingo username)");
  if (config.language && !LANGUAGE.test(config.language)) throw new ConfigError("duolingo: `language` must be a language code such as es, fr, de");
}

async function collect(config, { fetchImpl, timeoutMs, retryDelayMs }) {
  const url = `https://www.duolingo.com/2017-06-30/users?username=${encodeURIComponent(config.username)}`;
  const body = await fetchJson(url, { fetchImpl, timeoutMs, retryDelayMs });
  if (!body || !Array.isArray(body.users)) throw new ProviderError("BAD_RESPONSE", "unexpected response shape (no `users` list); the endpoint may have changed");
  const user = body.users[0];
  if (!user) throw new ProviderError("NOT_FOUND", `no Duolingo profile named "${config.username}" (wrong username, or the profile is private)`);
  if (typeof user !== "object") throw new ProviderError("BAD_RESPONSE", "unexpected user shape");

  let xp;
  if (config.language) {
    if (!Array.isArray(user.courses)) throw new ProviderError("BAD_RESPONSE", "unexpected response shape (no `courses` list)");
    const course = user.courses.find(c => c?.learningLanguage === config.language);
    if (!course) {
      const known = user.courses.map(c => c?.learningLanguage).filter(Boolean).join(", ") || "none";
      throw new ProviderError("NO_DATA", `no "${config.language}" course on this profile (courses found: ${known})`);
    }
    xp = course.xp;
  } else {
    xp = user.totalXp;
  }
  if (!count(xp)) throw new ProviderError("NO_DATA", "the profile does not expose an XP value (hidden or empty)");

  // Missing streak data is shown as absent, never as 0. A real streak of 0 arrives as `streak: 0`.
  const streak = count(user.streakData?.currentStreak?.length) ? user.streakData.currentStreak.length
    : count(user.streak) ? user.streak : null;

  // The account creation date is the age of the account, not study time.
  const created = Number.isFinite(user.creationDate) && user.creationDate > 0 ? new Date(user.creationDate * 1000) : null;
  const accountSince = created ? created.toISOString().slice(0, 7) : null;

  return {
    account: config.username,
    columns: [
      { metric: "xp", value: xp, ...(config.language ? { language: config.language } : { scope: "all" }) },
      { metric: "streakDays", value: streak },
      { metric: "accountSince", value: accountSince },
    ],
  };
}

module.exports = { id: "duolingo", defaultTitle: "Duolingo", validate, collect };
