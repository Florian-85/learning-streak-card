"use strict";
// Offline test helpers: a fake fetch that answers from fixtures. Nothing here touches the network.

const fs = require("node:fs");
const path = require("node:path");

const fixture = name => fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8");

// Answers every request with the given status/body and records the calls.
function fakeFetch(status, body) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    const text = typeof body === "string" ? body : JSON.stringify(body);
    return { ok: status >= 200 && status < 300, status, text: async () => text };
  };
  impl.calls = calls;
  return impl;
}

const fromFixture = (name, status = 200) => fakeFetch(status, fixture(name));

const failingFetch = error => async () => { throw error; };

const NOW = new Date("2026-10-27T10:00:00Z");

module.exports = { fixture, fakeFetch, fromFixture, failingFetch, NOW, FAST: { retryDelayMs: 0, timeoutMs: 1000 } };

// Minimal well-formedness check for the generated SVG: one svg root, balanced tags, no stray "<" or "&".
function isWellFormedSvg(source) {
  if (!/^<svg\b[^>]*>/.test(source) || !source.trimEnd().endsWith("</svg>")) return false;
  const stack = [];
  const tag = /<(\/?)([A-Za-z][\w:-]*)([^>]*?)(\/?)>/g;
  let match;
  while ((match = tag.exec(source))) {
    const [, closing, name, , selfClosing] = match;
    if (selfClosing) continue;
    if (closing) {
      if (stack.pop() !== name) return false;
    } else stack.push(name);
  }
  const text = source.replace(/<[^>]*>/g, "");
  return stack.length === 0 && !/<|&(?!(amp|lt|gt|quot|#39);)/.test(text);
}

module.exports.isWellFormedSvg = isWellFormedSvg;
