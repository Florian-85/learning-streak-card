#!/usr/bin/env node
"use strict";
// Regenerates the example cards in examples/ from the offline fixtures, so the README
// pictures are real output of the renderer. The numbers are SAMPLE DATA, not a real account.

const fs = require("node:fs");
const path = require("node:path");
const { generate, THEME_NAMES, LANG_NAMES } = require("../src");
const { fromFixture, NOW } = require("../test/helpers");

process.chdir(path.join(__dirname, ".."));
const outDir = path.join(__dirname, "..", "examples");

async function write(name, options, fixtureName) {
  const { svg } = await generate(options, { fetchImpl: fromFixture(fixtureName), now: NOW });
  fs.writeFileSync(path.join(outDir, name), svg);
  console.log(`examples/${name}`);
}

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  for (const theme of THEME_NAMES) {
    for (const lang of LANG_NAMES) {
      await write(`duolingo-${theme}-${lang}.svg`, { provider: "duolingo", username: "sample-learner", language: "es", theme, lang }, "duolingo-profile.json");
    }
  }
  await write("chesscom-dark-en.svg", { provider: "chesscom", username: "sample-player", theme: "dark", lang: "en" }, "chesscom-stats.json");
  const manual = { provider: "manual", file: "examples/learning-streak.manual.json", theme: "light", lang: "en" };
  const { svg } = await generate(manual, { now: NOW });
  fs.writeFileSync(path.join(outDir, "manual-light-en.svg"), svg);
  console.log("examples/manual-light-en.svg");
})();
