"use strict";
// End-to-end tests of the CLI and of the commit script, offline (manual provider only,
// plus an unreachable provider through an invalid proxy-free localhost port).

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const CLI = path.join(ROOT, "bin", "cli.js");

function workdir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "lsc-cli-"));
}
const cli = (cwd, args, env = {}) => spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: "utf8", env: { ...process.env, GITHUB_ACTIONS: "", ...env } });

test("--help and --version work", () => {
  const dir = workdir();
  assert.match(cli(dir, ["--help"]).stdout, /Usage: learning-streak-card/);
  assert.match(cli(dir, ["--version"]).stdout, /^\d+\.\d+\.\d+/);
});

test("manual provider writes the documented default path, then reports no change", () => {
  const dir = workdir();
  fs.writeFileSync(path.join(dir, "learning.json"), JSON.stringify({ xp: 10, streakDays: 2, studyHours: 5 }));
  const first = cli(dir, ["--provider", "manual", "--file", "learning.json"]);
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /Wrote assets\/learning-streak\.svg \(fresh\)/);
  const svgPath = path.join(dir, "assets", "learning-streak.svg");
  const before = fs.readFileSync(svgPath, "utf8");
  assert.match(before, /^<svg /);
  const second = cli(dir, ["--provider", "manual", "--file", "learning.json"]);
  assert.match(second.stdout, /already up to date/);
  assert.equal(fs.readFileSync(svgPath, "utf8"), before);
});

test("options can come from a config file; the command line wins", () => {
  const dir = workdir();
  fs.writeFileSync(path.join(dir, "learning.json"), JSON.stringify({ xp: 10 }));
  fs.writeFileSync(path.join(dir, "cfg.json"), JSON.stringify({ provider: "manual", file: "learning.json", theme: "light", out: "card.svg" }));
  assert.equal(cli(dir, ["--config", "cfg.json", "--theme", "funky-dark"]).status, 0);
  assert.match(fs.readFileSync(path.join(dir, "card.svg"), "utf8"), /#140B2E/);
});

test("configuration mistakes exit 2 with a readable message and write nothing", () => {
  const dir = workdir();
  const cases = [
    [[], /--provider is required/],
    [["--provider", "nope"], /unknown provider/],
    [["--provider", "manual"], /`file` is required/],
    [["--provider", "manual", "--file", "missing.json"], /cannot read/],
    [["--provider", "duolingo"], /`username` is required/],
    [["--provider", "manual", "--file", "x.json", "--theme", "neon"], /unknown theme/],
    [["--provider", "manual", "--file", "x.json", "--out", "../escape.svg"], /inside the current directory/],
    [["--provider", "manual", "--file", "x.json", "--out", "card.png"], /\.svg/],
    [["--bogus"], /unknown option/],
    [["--provider"], /needs a value/],
  ];
  for (const [args, pattern] of cases) {
    const result = cli(dir, args);
    assert.equal(result.status, 2, args.join(" "));
    assert.match(result.stderr, pattern);
  }
  assert.equal(fs.existsSync(path.join(dir, "assets")), false);
});

test("empty values (unset GitHub inputs) mean 'not given'", () => {
  const dir = workdir();
  fs.writeFileSync(path.join(dir, "l.json"), JSON.stringify({ xp: 1 }));
  const result = cli(dir, ["--provider", "manual", "--file", "l.json", "--username", "", "--language", "", "--mode", "", "--title", "", "--theme", "dark", "--lang", "en", "--out", "assets/learning-streak.svg"]);
  assert.equal(result.status, 0, result.stderr);
});

test("inside GitHub Actions, errors become workflow annotations", () => {
  const dir = workdir();
  const result = cli(dir, ["--provider", "manual", "--file", "missing.json"], { GITHUB_ACTIONS: "true" });
  assert.equal(result.status, 2);
  assert.match(result.stdout, /^::error title=Learning Streak Card::Configuration problem/);
});

test("source unreachable: first run exits 1 without a file; later runs keep the card and warn", () => {
  const dir = workdir();
  // Port 9 on localhost is closed: the connection is refused immediately. Chess.com is reached through a
  // preload that redirects fetch, so no real network is used.
  const preload = path.join(dir, "offline.js");
  fs.writeFileSync(preload, "globalThis.fetch = async () => { throw new TypeError('fetch failed'); };");
  const env = { NODE_OPTIONS: `--require ${JSON.stringify(preload)}` };
  const first = cli(dir, ["--provider", "chesscom", "--username", "sample-player"], env);
  assert.equal(first.status, 1);
  assert.match(first.stderr, /No previous card exists/);
  assert.equal(fs.existsSync(path.join(dir, "assets", "learning-streak.svg")), false);

  // Seed a valid previous card through the library, then break the network.
  const { generate } = require("../src");
  const { fromFixture, NOW } = require("./helpers");
  return generate({ provider: "chesscom", username: "sample-player" }, { fetchImpl: fromFixture("chesscom-stats.json"), now: NOW }).then(({ svg }) => {
    fs.mkdirSync(path.join(dir, "assets"));
    fs.writeFileSync(path.join(dir, "assets", "learning-streak.svg"), svg);
    const stale = cli(dir, ["--provider", "chesscom", "--username", "sample-player"], env);
    assert.equal(stale.status, 0, stale.stderr);
    assert.match(stale.stderr, /warning: .*Kept the last valid values/);
    assert.match(fs.readFileSync(path.join(dir, "assets", "learning-streak.svg"), "utf8"), /Source unreachable/);
    const strict = cli(dir, ["--provider", "chesscom", "--username", "sample-player", "--strict"], env);
    assert.equal(strict.status, 1);
  });
});

// ---------- commit script, against a throw-away "consumer repository" ----------
const bash = spawnSync("bash", ["--version"]);
const hasBash = !bash.error && bash.status === 0;
const sh = (cwd, command) => spawnSync("bash", ["-c", command], { cwd, encoding: "utf8" });
const git = (cwd, args) => spawnSync("git", args, { cwd, encoding: "utf8" });

test("commit script: commits once, then does nothing until the file changes", { skip: !hasBash }, () => {
  const origin = workdir();
  git(origin, ["init", "--bare", "-b", "main"]);
  const repo = workdir();
  git(repo, ["clone", origin, "."]);
  git(repo, ["config", "user.email", "t@example.com"]);
  git(repo, ["config", "user.name", "t"]);
  git(repo, ["checkout", "-b", "main"]);
  fs.writeFileSync(path.join(repo, "README.md"), "# consumer\n");
  git(repo, ["add", "."]);
  git(repo, ["commit", "-m", "init"]);
  git(repo, ["push", "-u", "origin", "main"]);
  const script = path.join(ROOT, "scripts", "commit-if-changed.sh").replace(/\\/g, "/");

  fs.writeFileSync(path.join(repo, "learning.json"), JSON.stringify({ xp: 10 }));
  assert.equal(cli(repo, ["--provider", "manual", "--file", "learning.json"]).status, 0);
  const first = sh(repo, `bash "${script}" assets/learning-streak.svg`);
  assert.equal(first.status, 0, first.stderr);
  assert.match(first.stdout, /Committed and pushed/);
  const count = () => Number(git(repo, ["rev-list", "--count", "HEAD"]).stdout);
  assert.equal(count(), 2);
  assert.match(git(repo, ["log", "-1", "--format=%an"]).stdout, /github-actions\[bot\]/);

  assert.equal(cli(repo, ["--provider", "manual", "--file", "learning.json"]).status, 0);
  const second = sh(repo, `bash "${script}" assets/learning-streak.svg`);
  assert.match(second.stdout, /nothing to commit/);
  assert.equal(count(), 2);

  fs.writeFileSync(path.join(repo, "learning.json"), JSON.stringify({ xp: 11 }));
  cli(repo, ["--provider", "manual", "--file", "learning.json"]);
  assert.match(sh(repo, `bash "${script}" assets/learning-streak.svg`).stdout, /Committed/);
  assert.equal(count(), 3);
  assert.equal(git(origin, ["rev-list", "--count", "main"]).stdout.trim(), "3");

  // Only the SVG is ever committed: unrelated local changes stay out.
  fs.writeFileSync(path.join(repo, "other.txt"), "x");
  git(repo, ["add", "other.txt"]);
  fs.writeFileSync(path.join(repo, "learning.json"), JSON.stringify({ xp: 12 }));
  cli(repo, ["--provider", "manual", "--file", "learning.json"]);
  sh(repo, `bash "${script}" assets/learning-streak.svg`);
  assert.doesNotMatch(git(repo, ["show", "--name-only", "--format=", "HEAD"]).stdout, /other\.txt/);
});

test("commit script fails loudly when the file is missing", { skip: !hasBash }, () => {
  const repo = workdir();
  git(repo, ["init", "-b", "main"]);
  const script = path.join(ROOT, "scripts", "commit-if-changed.sh").replace(/\\/g, "/");
  const result = sh(repo, `bash "${script}" assets/missing.svg`);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /does not exist/);
});
