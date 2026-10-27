"use strict";
// Provider registry. A provider is { id, defaultTitle, validate(config), collect(config, ctx) };
// see docs/adding-a-provider.md.

const { ConfigError } = require("../errors");

const providers = [require("./duolingo"), require("./chesscom"), require("./manual")];
const byId = new Map(providers.map(p => [p.id, p]));

function getProvider(id) {
  const provider = byId.get(id);
  if (!provider) throw new ConfigError(`unknown provider "${id}" (available: ${[...byId.keys()].join(", ")})`);
  return provider;
}

module.exports = { getProvider, PROVIDER_IDS: [...byId.keys()] };
