"use strict";
// The last valid data lives inside the generated SVG itself (a <metadata>
// element), so there is a single file to commit and nothing else to host.
// Whatever is read back is validated again: the file is user-editable input.

const { validateCard } = require("./contract");

const ID = "learning-streak-card-data";
const PATTERN = new RegExp(`<metadata id="${ID}">([^<]*)</metadata>`);

function embed(card) {
  const json = JSON.stringify(card)
    .replace(/&/g, "\\u0026").replace(/</g, "\\u003c").replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  return `<metadata id="${ID}">${json}</metadata>`;
}

// Returns a validated card, or null when there is nothing usable.
function extract(svgText, now) {
  if (typeof svgText !== "string") return null;
  const match = PATTERN.exec(svgText);
  if (!match) return null;
  try {
    return validateCard(JSON.parse(match[1]), now);
  } catch {
    return null;
  }
}

module.exports = { embed, extract };
