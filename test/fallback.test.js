"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { generate, ConfigError, ProviderError } = require("../src");
const { fakeFetch, fromFixture, failingFetch, NOW, FAST, isWellFormedSvg } = require("./helpers");

const OPTIONS = { provider: "duolingo", username: "sample-learner", language: "es", theme: "dark", lang: "en" };
const run = (options, fetchImpl, previousSvg, now = NOW) => generate(options, { fetchImpl, previousSvg, now, ...FAST });
const LATER = new Date("2026-11-02T10:00:00Z");

test("first run: a fresh card is generated and carries its own data", async () => {
  const { svg, status } = await run(OPTIONS, fromFixture("duolingo-profile.json"));
  assert.equal(status, "fresh");
  assert.ok(isWellFormedSvg(svg));
  assert.match(svg, /<metadata id="learning-streak-card-data">/);
  assert.doesNotMatch(svg, /unreachable/);
});

test("first run with a failing source: explicit error, nothing generated", async () => {
  await assert.rejects(run(OPTIONS, failingFetch(new TypeError("fetch failed"))), error => error instanceof ProviderError && error.code === "NETWORK" && /No previous card exists/.test(error.message));
  await assert.rejects(run(OPTIONS, fromFixture("duolingo-empty.json")), error => error.code === "NOT_FOUND");
});

test("a source outage keeps the previous valid card, flagged as not fresh", async () => {
  const first = await run(OPTIONS, fromFixture("duolingo-profile.json"));
  const failures = [
    failingFetch(new TypeError("fetch failed")),
    fakeFetch(500, ""),
    fakeFetch(429, ""),
    fakeFetch(200, "<html>captcha</html>"),
    fromFixture("duolingo-empty.json"),
  ];
  for (const fetchImpl of failures) {
    const second = await run(OPTIONS, fetchImpl, first.svg, LATER);
    assert.equal(second.status, "stale");
    assert.match(second.warning, /Kept the last valid values \(as of 2026-10-27\)/);
    assert.match(second.svg, /Source unreachable · values as of Oct 27, 2026/);
    assert.match(second.svg, />13,223 XP</);
    assert.ok(isWellFormedSvg(second.svg));
  }
});

test("stale output is stable, and a later recovery replaces it with fresh data", async () => {
  const first = await run(OPTIONS, fromFixture("duolingo-profile.json"));
  const stale1 = await run(OPTIONS, fakeFetch(500, ""), first.svg, LATER);
  const stale2 = await run(OPTIONS, fakeFetch(500, ""), stale1.svg, LATER);
  assert.equal(stale1.svg, stale2.svg);
  const back = await run(OPTIONS, fromFixture("duolingo-profile.json"), stale2.svg, LATER);
  assert.equal(back.status, "fresh");
  assert.doesNotMatch(back.svg, /unreachable/);
});

test("unchanged data gives byte-identical output (no needless commit); changed data moves the date", async () => {
  const first = await run(OPTIONS, fromFixture("duolingo-profile.json"));
  const same = await run(OPTIONS, fromFixture("duolingo-profile.json"), first.svg, new Date("2026-10-27T23:00:00Z"));
  assert.equal(same.svg, first.svg);
  const changed = JSON.parse(fixtureWith(13300));
  const next = await run(OPTIONS, fakeFetch(200, changed), first.svg, LATER);
  assert.match(next.svg, /13,300 XP/);
  assert.match(next.svg, /"asOf":"2026-11-02"/);
  const unchangedLater = await run(OPTIONS, fromFixture("duolingo-profile.json"), first.svg, LATER);
  assert.match(unchangedLater.svg, /"asOf":"2026-10-27"/);
});

function fixtureWith(xp) {
  const body = JSON.parse(require("./helpers").fixture("duolingo-profile.json"));
  body.users[0].courses[0].xp = xp;
  return JSON.stringify(body);
}

test("old data is never reused for another account or another course", async () => {
  const first = await run(OPTIONS, fromFixture("duolingo-profile.json"));
  await assert.rejects(run({ ...OPTIONS, username: "someone-else" }, fakeFetch(500, ""), first.svg), error => error.code === "HTTP");
  await assert.rejects(run({ ...OPTIONS, language: "fr" }, fakeFetch(500, ""), first.svg), error => error.code === "HTTP");
  const sameAccountOtherCase = await run({ ...OPTIONS, username: "SAMPLE-LEARNER" }, fakeFetch(500, ""), first.svg);
  assert.equal(sameAccountOtherCase.status, "stale");
});

test("theme and language can change while the source is down", async () => {
  const first = await run(OPTIONS, fromFixture("duolingo-profile.json"));
  const stale = await run({ ...OPTIONS, theme: "funky-light", lang: "fr" }, fakeFetch(500, ""), first.svg, LATER);
  assert.equal(stale.status, "stale");
  assert.match(stale.svg, /Source injoignable/);
  assert.match(stale.svg, /#D2C6FF/);
});

test("a corrupted or tampered previous file is ignored, not trusted", async () => {
  const first = await run(OPTIONS, fromFixture("duolingo-profile.json"));
  const tampered = first.svg.replace('"value":13223', '"value":-1');
  await assert.rejects(run(OPTIONS, fakeFetch(500, ""), tampered), error => error.code === "HTTP");
  await assert.rejects(run(OPTIONS, fakeFetch(500, ""), "<svg>not ours</svg>"), error => error.code === "HTTP");
  await assert.rejects(run(OPTIONS, fakeFetch(500, ""), "garbage"), error => error.code === "HTTP");
});

test("embedded data cannot break out of the SVG", async () => {
  const hostile = { provider: "manual", file: require("node:path").join(__dirname, "hostile.json") };
  const fs = require("node:fs");
  fs.writeFileSync(hostile.file, JSON.stringify({ title: "</metadata><script>alert(1)</script>&", xp: 1 }));
  try {
    const { svg } = await generate(hostile, { now: NOW });
    assert.ok(isWellFormedSvg(svg));
    assert.doesNotMatch(svg, /<script/);
    const again = await generate(hostile, { now: NOW, previousSvg: svg });
    assert.equal(again.svg, svg);
  } finally {
    fs.unlinkSync(hostile.file);
  }
});

test("a configuration error is never hidden by old data", async () => {
  const first = await run(OPTIONS, fromFixture("duolingo-profile.json"));
  await assert.rejects(run({ ...OPTIONS, theme: "neon" }, fromFixture("duolingo-profile.json"), first.svg), ConfigError);
  await assert.rejects(run({ ...OPTIONS, lang: "xx" }, fromFixture("duolingo-profile.json"), first.svg), /unknown lang/);
  await assert.rejects(run({ ...OPTIONS, username: undefined }, fromFixture("duolingo-profile.json"), first.svg), ConfigError);
  await assert.rejects(run({ provider: "nope" }, fromFixture("duolingo-profile.json")), /unknown provider/);
});

test("a provider that crashes unexpectedly is treated as a source failure", async () => {
  const first = await run(OPTIONS, fromFixture("duolingo-profile.json"));
  const weird = async () => ({ ok: true, status: 200, text: async () => "null" });
  const stale = await run(OPTIONS, weird, first.svg, LATER);
  assert.equal(stale.status, "stale");
});

test("the title option and manual title appear in the header", async () => {
  const { svg } = await run({ ...OPTIONS, title: "Mon espagnol" }, fromFixture("duolingo-profile.json"));
  assert.match(svg, />MON ESPAGNOL</);
});
