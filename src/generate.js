"use strict";
// generate(options, deps) -> { svg, status: "fresh" | "stale", warning }
//
// - fresh: the provider answered, the card shows the new numbers.
// - stale: the provider failed but a previous valid card exists for the same
//   source: it is redrawn with a visible "source unreachable" notice and the
//   warning is returned (never swallowed).
// - first run with a failing source: the error is thrown, nothing is invented.
// A ConfigError is never masked by old data.

const { ConfigError, ProviderError } = require("./errors");
const { getProvider } = require("./providers");
const { validateCard } = require("./contract");
const { THEME_NAMES } = require("./themes");
const { LANG_NAMES } = require("./i18n");
const { renderCard } = require("./render");
const { embed, extract } = require("./state");

function normalize(options) {
  const theme = options.theme || "dark";
  const lang = options.lang || "en";
  if (!THEME_NAMES.includes(theme)) throw new ConfigError(`unknown theme "${theme}" (available: ${THEME_NAMES.join(", ")})`);
  if (!LANG_NAMES.includes(lang)) throw new ConfigError(`unknown lang "${lang}" (available: ${LANG_NAMES.join(", ")})`);
  const title = options.title ? String(options.title).slice(0, 40) : undefined;
  return { ...options, theme, lang, title };
}

// Old data is only reused for the exact same source configuration.
function sourceKey(o) {
  return [o.provider, o.username?.toLowerCase(), o.language, o.mode, o.file].map(part => part ?? "").join("|");
}

const sameColumns = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function generate(rawOptions, deps = {}) {
  const now = deps.now ?? new Date();
  const options = normalize(rawOptions);
  const provider = getProvider(options.provider);
  provider.validate(options);
  const key = sourceKey(options);
  const previous = extract(deps.previousSvg, now);
  const reusable = previous && previous.key === key ? previous : null;
  const render = (card, stale, title) => renderCard(card, {
    theme: options.theme, lang: options.lang, animate: options.animate, now, stale,
    title: options.title ?? title ?? provider.defaultTitle,
    extra: embed(card),
  });

  let result;
  try {
    result = await provider.collect(options, { fetchImpl: deps.fetchImpl ?? fetch, timeoutMs: deps.timeoutMs, retryDelayMs: deps.retryDelayMs });
    const asOf = now.toISOString().slice(0, 10);
    const card = validateCard({ v: 1, key, provider: provider.id, account: result.account, asOf, columns: result.columns }, now);
    if (reusable && sameColumns(reusable.columns, card.columns)) card.asOf = reusable.asOf;
    return { svg: render(card, false, result.title), status: "fresh" };
  } catch (error) {
    if (error instanceof ConfigError) throw error;
    const failure = error instanceof ProviderError ? error : new ProviderError("BAD_RESPONSE", `unexpected failure (${error?.message})`);
    if (!reusable) {
      failure.message = `${failure.message}. No previous card exists, so nothing was generated.`;
      throw failure;
    }
    return {
      svg: render(reusable, true, undefined),
      status: "stale",
      warning: `${provider.id}: ${failure.message}. Kept the last valid values (as of ${reusable.asOf}).`,
    };
  }
}

module.exports = { generate };
