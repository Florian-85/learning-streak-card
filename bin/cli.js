#!/usr/bin/env node
"use strict";
// learning-streak-card CLI. Exit codes: 0 ok (fresh, or stale with a warning),
// 1 the data source failed and nothing could be kept (or --strict), 2 bad configuration.

const fs = require("node:fs");
const path = require("node:path");
const { generate, ConfigError, PROVIDER_IDS, THEME_NAMES, LANG_NAMES } = require("../src");

const VALUE_FLAGS = ["provider", "username", "language", "mode", "file", "theme", "lang", "title", "out", "config"];
const DEFAULT_OUT = "assets/learning-streak.svg";

const HELP = `learning-streak-card — generate a learning streak card as an SVG file

Usage: learning-streak-card --provider <${PROVIDER_IDS.join("|")}> [options]

  --provider   ${PROVIDER_IDS.join(", ")}
  --username   public account name (duolingo, chesscom)
  --language   duolingo only: course language code, e.g. es (default: all courses)
  --mode       chesscom only: rapid | blitz | bullet | daily (default: rapid)
  --file       manual only: path of your JSON data file
  --theme      ${THEME_NAMES.join(" | ")} (default: dark)
  --lang       ${LANG_NAMES.join(" | ")} (default: en)
  --title      text in the card header (default: the provider name)
  --out        output file (default: ${DEFAULT_OUT})
  --config     JSON file with the same options (command line wins)
  --no-animation   draw a static card
  --strict     exit 1 instead of keeping old values when the source fails
  --help, --version`;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (!flag.startsWith("--")) throw new ConfigError(`unexpected argument "${flag}" (see --help)`);
    const name = flag.slice(2);
    if (["help", "version", "strict"].includes(name)) args[name] = true;
    else if (name === "no-animation") args.animate = false;
    else if (VALUE_FLAGS.includes(name)) {
      if (i + 1 >= argv.length) throw new ConfigError(`--${name} needs a value`);
      const value = argv[++i];
      if (value !== "") args[name] = value; // an empty value (unset GitHub input) means "not given"
    } else throw new ConfigError(`unknown option --${name} (see --help)`);
  }
  return args;
}

function loadConfigFile(file) {
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("not an object");
    const unknown = Object.keys(data).filter(key => ![...VALUE_FLAGS, "animate", "strict"].includes(key));
    if (unknown.length) throw new Error(`unknown key(s): ${unknown.join(", ")}`);
    return data;
  } catch (error) {
    throw new ConfigError(`cannot use config file "${file}" (${error.message})`);
  }
}

function resolveOutput(out) {
  const cwd = process.cwd();
  const target = path.resolve(cwd, out);
  if (path.extname(target).toLowerCase() !== ".svg") throw new ConfigError(`--out must be a .svg file (got "${out}")`);
  if (target !== cwd && !target.startsWith(cwd + path.sep)) throw new ConfigError(`--out must stay inside the current directory (got "${out}")`);
  return target;
}

const inActions = Boolean(process.env.GITHUB_ACTIONS);
const annotate = (level, message) => (inActions ? console.log(`::${level} title=Learning Streak Card::${message.replace(/\r?\n/g, " ")}`) : console.error(`${level}: ${message}`));
function summary(line) {
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
}

async function main(argv) {
  const args = parseArgs(argv);
  if (args.help) return console.log(HELP);
  if (args.version) return console.log(require("../package.json").version);
  const options = { ...(args.config ? loadConfigFile(args.config) : {}), ...args };
  if (!options.provider) throw new ConfigError(`--provider is required (${PROVIDER_IDS.join(", ")}). See --help`);
  const target = resolveOutput(options.out ?? DEFAULT_OUT);
  const rel = path.relative(process.cwd(), target).split(path.sep).join("/");

  const previousSvg = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : undefined;
  const { svg, status, warning } = await generate(options, { previousSvg });

  if (status === "stale") {
    annotate("warning", warning);
    summary(`### Learning Streak Card\n:warning: ${warning}`);
    if (options.strict) return 1;
  }
  if (svg === previousSvg) {
    console.log(`${rel} is already up to date.`);
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, svg);
    console.log(`Wrote ${rel} (${status}).`);
  }
  if (status === "fresh") summary(`### Learning Streak Card\nGenerated \`${rel}\`.`);
  return 0;
}

main(process.argv.slice(2)).then(
  code => { process.exitCode = code ?? 0; },
  error => {
    if (error instanceof ConfigError) {
      annotate("error", `Configuration problem: ${error.message}`);
      process.exitCode = 2;
    } else if (error.name === "ProviderError") {
      annotate("error", `${error.message} [${error.code}]`);
      process.exitCode = 1;
    } else {
      annotate("error", `Unexpected error: ${error.stack ?? error}`);
      process.exitCode = 1;
    }
  },
);
