"use strict";
// Guards against publishing a secret or a private value, and against the code asking for credentials.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const SKIP_DIRS = new Set([".git", "node_modules"]);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const SECRET_PATTERNS = [
  /gh[pousr]_[A-Za-z0-9]{30,}/,
  /github_pat_[A-Za-z0-9_]{30,}/,
  /AKIA[0-9A-Z]{16}/,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /xox[baprs]-[A-Za-z0-9-]{10,}/,
  /sk-[A-Za-z0-9]{32,}/,
  /AIza[0-9A-Za-z_-]{35}/,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/, // JWT
];

test("no secret-looking value in any file of the repository", () => {
  for (const file of walk(ROOT)) {
    if (file === __filename) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const pattern of SECRET_PATTERNS) assert.doesNotMatch(text, pattern, `${path.relative(ROOT, file)} matches ${pattern}`);
  }
});

test("no secret-looking value in the Git history", () => {
  const log = spawnSync("git", ["log", "--all", "-p", "--no-color"], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (log.error || log.status !== 0) return; // no git available: the file scan above still ran
  for (const pattern of SECRET_PATTERNS) {
    const lines = log.stdout.split("\n").filter(line => line.startsWith("+") && pattern.test(line) && !line.includes("SECRET_PATTERNS") && !/^\+\s*\/.*\/,?$/.test(line));
    assert.deepEqual(lines, [], `history matches ${pattern}`);
  }
});

test("no environment or key file is committed", () => {
  const forbidden = [/^\.env/, /\.pem$/, /\.key$/, /id_rsa/, /credentials/i];
  for (const file of walk(ROOT)) {
    const name = path.basename(file);
    for (const pattern of forbidden) assert.doesNotMatch(name, pattern, name);
  }
});

test("the code never sends credentials, cookies or tokens, and only talks to the documented hosts", () => {
  const sources = [...walk(path.join(ROOT, "src")), ...walk(path.join(ROOT, "bin"))].filter(f => f.endsWith(".js"));
  const hosts = new Set();
  for (const file of sources) {
    const text = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(line => !/^\s*\/\//.test(line)).join("\n"); // comments may say "no cookie"
    assert.doesNotMatch(text, /\bcookie\b|set-cookie|authorization|bearer|\bpassword\b|process\.env\.(?!GITHUB_)/i, `${path.relative(ROOT, file)} handles credentials`);
    for (const match of text.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) hosts.add(match[1].toLowerCase());
  }
  const allowed = new Set(["www.duolingo.com", "api.chess.com", "github.com", "www.w3.org"]);
  for (const host of hosts) assert.ok(allowed.has(host), `unexpected host ${host}`);
});

test("the workflow template asks for the minimum permissions and no secret", () => {
  const template = fs.readFileSync(path.join(ROOT, "examples", "workflow.yml"), "utf8");
  assert.match(template, /permissions:\s*\n\s+contents: write/);
  assert.doesNotMatch(template, /secrets\.|\$\{\{ *github\.token|token:/i);
  const permissions = template.match(/permissions:\s*\n((?:[ \t]+[a-z-]+: \w+[^\n]*\r?\n)+)/)[1].trim().split("\n");
  assert.equal(permissions.length, 1);
});
