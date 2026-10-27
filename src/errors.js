"use strict";
// Every expected failure is one of these two classes, so callers can tell a bad
// configuration (never retried, never masked by old data) from a source problem.

class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigError";
  }
}

// code: NOT_FOUND | NO_DATA | RATE_LIMITED | TIMEOUT | NETWORK | HTTP | BAD_RESPONSE
class ProviderError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "ProviderError";
    this.code = code;
  }
}

module.exports = { ConfigError, ProviderError };
