"use strict";
// Manual provider: the numbers come from a JSON file you keep up to date.
// Works for any service without an API, and as a fallback when an unofficial
// source breaks. Everything on the card is exactly what the file says.

const fs = require("node:fs");
const { ConfigError } = require("../errors");

const ALLOWED = ["xp", "streakDays", "studyHours", "startedOn"];
const DEFAULT_COLUMNS = ["xp", "streakDays", "studyHours"];

function validate(config) {
  if (!config.file) throw new ConfigError("manual: `file` is required (path to your JSON data file)");
}

function readFile(path) {
  let text;
  try {
    text = fs.readFileSync(path, "utf8");
  } catch (error) {
    throw new ConfigError(`manual: cannot read "${path}" (${error.code ?? error.message})`);
  }
  try {
    const data = JSON.parse(text);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("not an object");
    return data;
  } catch (error) {
    throw new ConfigError(`manual: "${path}" is not valid JSON (${error.message})`);
  }
}

// Here a wrong value is the user's mistake, so it is reported precisely instead of being dropped.
function check(name, value) {
  if (value === undefined || value === null) return null;
  if (name === "startedOn") {
    if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) throw new ConfigError(`manual: \`${name}\` must look like "2025-01"`);
    return value;
  }
  if (name === "studyHours") {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) throw new ConfigError("manual: `studyHours` must be a number >= 0");
    return value;
  }
  if (!Number.isSafeInteger(value) || value < 0) throw new ConfigError(`manual: \`${name}\` must be a whole number >= 0`);
  return value;
}

async function collect(config) {
  const data = readFile(config.file);
  const layout = data.columns ?? DEFAULT_COLUMNS;
  if (!Array.isArray(layout) || layout.length !== 3 || layout.some(name => !ALLOWED.includes(name))) {
    throw new ConfigError(`manual: \`columns\` must list 3 of ${ALLOWED.join(", ")}`);
  }
  const values = Object.fromEntries(ALLOWED.map(name => [name, check(name, data[name])])); // every declared value is checked, shown or not
  const columns = layout.map(metric => ({ metric, value: values[metric] }));
  if (columns.every(col => col.value === null)) throw new ConfigError(`manual: "${config.file}" has none of ${ALLOWED.join(", ")}`);
  const account = typeof data.title === "string" && data.title.trim() ? data.title.trim().slice(0, 60) : "manual";
  return { account, columns, title: data.title ? account : undefined };
}

module.exports = { id: "manual", defaultTitle: "Learning", validate, collect };
