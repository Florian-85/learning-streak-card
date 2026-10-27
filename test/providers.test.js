"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { getProvider, } = require("../src/providers");
const { ConfigError, ProviderError } = require("../src");
const { fakeFetch, fromFixture, failingFetch, fixture, FAST } = require("./helpers");

const collect = (id, config, fetchImpl) => getProvider(id).collect(config, { fetchImpl, ...FAST });
const rejectsWith = (promise, code) => assert.rejects(promise, error => error instanceof ProviderError && error.code === code, code);

// ---------- Duolingo ----------
test("duolingo: reads the requested course, the streak and the account creation month", async () => {
  const fetchImpl = fromFixture("duolingo-profile.json");
  const result = await collect("duolingo", { username: "sample-learner", language: "es" }, fetchImpl);
  assert.deepEqual(result.columns, [
    { metric: "xp", value: 13223, language: "es" },
    { metric: "streakDays", value: 42 },
    { metric: "accountSince", value: "2020-05" },
  ]);
  assert.equal(fetchImpl.calls.length, 1);
  assert.equal(fetchImpl.calls[0].url, "https://www.duolingo.com/2017-06-30/users?username=sample-learner");
  assert.ok(!("cookie" in fetchImpl.calls[0].init.headers) && !("Authorization" in fetchImpl.calls[0].init.headers));
});

test("duolingo: without a language, total XP of all courses", async () => {
  const result = await collect("duolingo", { username: "sample-learner" }, fromFixture("duolingo-profile.json"));
  assert.deepEqual(result.columns[0], { metric: "xp", value: 24512, scope: "all" });
});

test("duolingo: a streak of zero is 0; a missing streak is absent, not 0", async () => {
  const zero = await collect("duolingo", { username: "u", language: "es" }, fromFixture("duolingo-zero-streak.json"));
  assert.equal(zero.columns[1].value, 0);
  const minimal = await collect("duolingo", { username: "u", language: "es" }, fromFixture("duolingo-minimal.json"));
  assert.equal(minimal.columns[1].value, null);
  assert.equal(minimal.columns[2].value, null);
});

test("duolingo: unknown or private profile, missing course", async () => {
  await rejectsWith(collect("duolingo", { username: "nobody" }, fromFixture("duolingo-empty.json")), "NOT_FOUND");
  await assert.rejects(collect("duolingo", { username: "u", language: "ja" }, fromFixture("duolingo-profile.json")), /courses found: es, fr/);
  await rejectsWith(collect("duolingo", { username: "u", language: "ja" }, fromFixture("duolingo-profile.json")), "NO_DATA");
});

test("duolingo: HTTP errors, rate limit, network failure, timeout", async () => {
  await rejectsWith(collect("duolingo", { username: "u" }, fakeFetch(404, "")), "NOT_FOUND");
  await rejectsWith(collect("duolingo", { username: "u" }, fakeFetch(429, "")), "RATE_LIMITED");
  await rejectsWith(collect("duolingo", { username: "u" }, fakeFetch(403, "")), "HTTP");
  await rejectsWith(collect("duolingo", { username: "u" }, failingFetch(new TypeError("fetch failed"))), "NETWORK");
  const timeout = Object.assign(new Error("timed out"), { name: "TimeoutError" });
  await rejectsWith(collect("duolingo", { username: "u" }, failingFetch(timeout)), "TIMEOUT");
});

test("duolingo: transient failures are retried once, permanent ones are not", async () => {
  let n = 0;
  const flaky = async () => {
    n++;
    if (n === 1) return { ok: false, status: 503, text: async () => "" };
    return { ok: true, status: 200, text: async () => fixture("duolingo-profile.json") };
  };
  assert.equal((await collect("duolingo", { username: "u", language: "es" }, flaky)).columns[0].value, 13223);
  assert.equal(n, 2);
  const always = fakeFetch(500, "");
  await rejectsWith(collect("duolingo", { username: "u" }, always), "HTTP");
  assert.equal(always.calls.length, 2);
  const notFound = fakeFetch(404, "");
  await rejectsWith(collect("duolingo", { username: "u" }, notFound), "NOT_FOUND");
  assert.equal(notFound.calls.length, 1);
});

test("duolingo: wrong or changed response shapes are BAD_RESPONSE or NO_DATA", async () => {
  await rejectsWith(collect("duolingo", { username: "u" }, fakeFetch(200, "<html>blocked</html>")), "BAD_RESPONSE");
  await rejectsWith(collect("duolingo", { username: "u" }, fakeFetch(200, { users: "nope" })), "BAD_RESPONSE");
  await rejectsWith(collect("duolingo", { username: "u" }, fakeFetch(200, { error: "x" })), "BAD_RESPONSE");
  await rejectsWith(collect("duolingo", { username: "u", language: "es" }, fakeFetch(200, { users: [{ courses: "x" }] })), "BAD_RESPONSE");
  await rejectsWith(collect("duolingo", { username: "u", language: "es" }, fakeFetch(200, { users: [{ courses: [{ learningLanguage: "es", xp: "lots" }] }] })), "NO_DATA");
  await rejectsWith(collect("duolingo", { username: "u" }, fakeFetch(200, { users: [{ totalXp: -5 }] })), "NO_DATA");
  await rejectsWith(collect("duolingo", { username: "u" }, fakeFetch(200, " ".repeat(2 * 1024 * 1024))), "BAD_RESPONSE");
});

test("duolingo: invalid configuration is a ConfigError, before any request", () => {
  const { validate } = getProvider("duolingo");
  assert.throws(() => validate({}), ConfigError);
  assert.throws(() => validate({ username: "a b" }), ConfigError);
  assert.throws(() => validate({ username: "../x" }), ConfigError);
  assert.throws(() => validate({ username: "ok", language: "Spanish" }), ConfigError);
  assert.doesNotThrow(() => validate({ username: "ok.user_1-x", language: "es" }));
});

// ---------- Chess.com ----------
test("chesscom: rating, best rating and games for the chosen mode", async () => {
  const fetchImpl = fromFixture("chesscom-stats.json");
  const result = await collect("chesscom", { username: "Sample-Player" }, fetchImpl);
  assert.deepEqual(result.columns, [
    { metric: "rating", value: 1480, mode: "rapid" },
    { metric: "bestRating", value: 1612, mode: "rapid" },
    { metric: "games", value: 394, mode: "rapid" },
  ]);
  assert.equal(fetchImpl.calls[0].url, "https://api.chess.com/pub/player/sample-player/stats");
  assert.match(fetchImpl.calls[0].init.headers["User-Agent"], /learning-streak-card/);
  const blitz = await collect("chesscom", { username: "p", mode: "blitz" }, fromFixture("chesscom-stats.json"));
  assert.equal(blitz.columns[0].value, 1390);
});

test("chesscom: missing best rating or record are absent, a mode never played is NO_DATA", async () => {
  const result = await collect("chesscom", { username: "p", mode: "blitz" }, fromFixture("chesscom-no-rapid.json"));
  assert.equal(result.columns[1].value, null);
  assert.equal(result.columns[2].value, 5);
  await rejectsWith(collect("chesscom", { username: "p" }, fromFixture("chesscom-no-rapid.json")), "NO_DATA");
});

test("chesscom: not found, rate limit, bad shapes, bad config", async () => {
  await rejectsWith(collect("chesscom", { username: "nobody" }, fromFixture("chesscom-not-found.json", 404)), "NOT_FOUND");
  await rejectsWith(collect("chesscom", { username: "p" }, fakeFetch(429, "")), "RATE_LIMITED");
  await rejectsWith(collect("chesscom", { username: "p" }, fakeFetch(200, [])), "BAD_RESPONSE");
  await rejectsWith(collect("chesscom", { username: "p" }, fakeFetch(200, { chess_rapid: { last: { rating: "high" } } })), "BAD_RESPONSE");
  const { validate } = getProvider("chesscom");
  assert.throws(() => validate({}), ConfigError);
  assert.throws(() => validate({ username: "ab" }), ConfigError);
  assert.throws(() => validate({ username: "fine", mode: "chess960" }), ConfigError);
});

// ---------- Manual ----------
function manualFile(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lsc-manual-"));
  const file = path.join(dir, "data.json");
  fs.writeFileSync(file, typeof content === "string" ? content : JSON.stringify(content));
  return file;
}

test("manual: shows exactly the declared values and marks the others absent", async () => {
  const file = manualFile({ title: "Rust course", xp: 3400, streakDays: 12 });
  const result = await collect("manual", { file });
  assert.deepEqual(result.columns, [
    { metric: "xp", value: 3400 },
    { metric: "streakDays", value: 12 },
    { metric: "studyHours", value: null },
  ]);
  assert.equal(result.title, "Rust course");
});

test("manual: custom columns, declared start month", async () => {
  const file = manualFile({ columns: ["studyHours", "streakDays", "startedOn"], studyHours: 41.5, streakDays: 3, startedOn: "2025-01" });
  const result = await collect("manual", { file });
  assert.deepEqual(result.columns.map(c => c.value), [41.5, 3, "2025-01"]);
});

test("manual: user mistakes are precise ConfigErrors", async () => {
  const bad = async (content, pattern) => assert.rejects(collect("manual", { file: manualFile(content) }), error => error instanceof ConfigError && pattern.test(error.message));
  await bad("{ not json", /not valid JSON/);
  await bad("[]", /not valid JSON/);
  await bad({ xp: -3 }, /xp.*whole number/);
  await bad({ xp: "lots" }, /xp.*whole number/);
  await bad({ studyHours: "many" }, /studyHours/);
  await bad({ xp: 1, startedOn: "last year" }, /startedOn/);
  await bad({ columns: ["xp", "mana", "streakDays"], xp: 1 }, /columns/);
  await bad({ title: "empty" }, /none of/);
  await assert.rejects(collect("manual", { file: path.join(os.tmpdir(), "does-not-exist.json") }), /cannot read/);
  assert.throws(() => getProvider("manual").validate({}), ConfigError);
});

test("unknown provider lists the available ones", () => {
  assert.throws(() => getProvider("lichess"), /available: duolingo, chesscom, manual/);
});
