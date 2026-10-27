"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { renderCard, THEME_NAMES, LANG_NAMES, validateCard } = require("../src");
const { NOW, isWellFormedSvg } = require("./helpers");

const card = (columns, extra = {}) => validateCard({ v: 1, key: "k", provider: "duolingo", account: "alice", asOf: "2026-10-20", columns, ...extra }, NOW);
const full = () => card([
  { metric: "xp", value: 13223, language: "es" },
  { metric: "streakDays", value: 42 },
  { metric: "accountSince", value: "2020-05" },
]);

test("every theme in every language renders a well-formed 900x124 SVG", () => {
  for (const theme of THEME_NAMES) {
    for (const lang of LANG_NAMES) {
      const svg = renderCard(full(), { theme, lang, now: NOW });
      assert.ok(isWellFormedSvg(svg), `${theme}/${lang}`);
      assert.match(svg, /width="900" height="124" viewBox="0 0 900 124"/);
    }
  }
});

test("English and French labels and number formats", () => {
  const en = renderCard(full(), { lang: "en", now: NOW });
  assert.match(en, />13,223 XP</);
  assert.match(en, />Experience points</);
  assert.match(en, />Spanish</);
  assert.match(en, />6 y 5 m</);
  const fr = renderCard(full(), { lang: "fr", now: NOW });
  assert.match(fr, />13 223 XP</);
  assert.match(fr, />Points d&#39;expérience</);
  assert.match(fr, />espagnol</);
  assert.match(fr, />6 ans 5 mois</);
});

test("account age is labelled as account age, never as study time", () => {
  const svg = renderCard(full(), { now: NOW });
  assert.match(svg, />Account age</);
  assert.doesNotMatch(svg, /study|learning for|time spent/i);
});

test("a missing metric is an explicit dash with a reason, never a zero", () => {
  const svg = renderCard(card([
    { metric: "xp", value: 500, scope: "all" },
    { metric: "streakDays", value: null },
    { metric: "accountSince", value: null },
  ]), { now: NOW });
  assert.equal((svg.match(/>—</g) ?? []).length, 2);
  assert.match(svg, />not provided</);
  assert.doesNotMatch(svg, />0</);
  assert.match(svg, />all courses</);
});

test("a real streak of zero is shown as 0", () => {
  const svg = renderCard(card([{ metric: "xp", value: 1 }, { metric: "streakDays", value: 0 }, { metric: "accountSince", value: null }]), { now: NOW });
  assert.match(svg, />0</);
});

test("unusual values: huge numbers shrink to fit, singular day, account created this month", () => {
  const big = renderCard(card([{ metric: "xp", value: 999999999999 }, { metric: "streakDays", value: 1 }, { metric: "accountSince", value: "2026-10" }]), { now: NOW });
  assert.match(big, />999,999,999,999 XP</);
  const size = Number(/font-size="(\d+)"[^>]*>999,999/.exec(big)[1]);
  assert.ok(size <= 24 && size >= 12);
  assert.match(big, />day</);
  assert.match(big, />0 m</);
});

test("the stale notice appears only when asked, with the date of the data", () => {
  assert.doesNotMatch(renderCard(full(), { now: NOW }), /unreachable/);
  const stale = renderCard(full(), { now: NOW, stale: true, lang: "en" });
  assert.match(stale, /Source unreachable · values as of Oct 20, 2026/);
  assert.match(renderCard(full(), { now: NOW, stale: true, lang: "fr" }), /Source injoignable · valeurs au 20 oct\. 2026/);
});

test("hostile text is escaped everywhere", () => {
  const evil = card([{ metric: "xp", value: 1 }, { metric: "streakDays", value: 1 }, { metric: "accountSince", value: null }], { account: '"><script>alert(1)</script>' });
  const svg = renderCard(evil, { title: '<img onerror=x> & "q"', now: NOW });
  assert.ok(isWellFormedSvg(svg));
  assert.doesNotMatch(svg, /<script|<img/);
});

test("animation can be switched off", () => {
  assert.match(renderCard(full(), { now: NOW }), /<animate/);
  assert.doesNotMatch(renderCard(full(), { now: NOW, animate: false }), /<animate/);
});

test("rendering is deterministic", () => {
  assert.equal(renderCard(full(), { now: NOW }), renderCard(full(), { now: NOW }));
});

test("the contract rejects invented or malformed values", () => {
  const base = { v: 1, key: "k", provider: "p", account: "a", asOf: "2026-10-20" };
  const col = value => [{ metric: "xp", value }, { metric: "streakDays", value: null }, { metric: "accountSince", value: null }];
  for (const value of [-1, 1.5, NaN, Infinity, "12", 1e13]) assert.throws(() => validateCard({ ...base, columns: col(value) }, NOW), /xp/, String(value));
  assert.throws(() => validateCard({ ...base, columns: [{ metric: "xp", value: null }, { metric: "streakDays", value: null }, { metric: "accountSince", value: null }] }, NOW), /no usable metric/);
  assert.throws(() => validateCard({ ...base, columns: [{ metric: "mana", value: 1 }, ...col(1).slice(1)] }, NOW), /unknown metric/);
  assert.throws(() => validateCard({ ...base, columns: [{ metric: "xp", value: 1 }, { metric: "streakDays", value: null }, { metric: "accountSince", value: "2030-01" }] }, NOW), /future/);
  assert.throws(() => validateCard({ ...base, columns: col(1).slice(0, 2) }, NOW), /3 columns/);
  assert.throws(() => validateCard({ ...base, asOf: "yesterday", columns: col(1) }, NOW), /asOf/);
});
