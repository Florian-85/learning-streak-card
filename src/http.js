"use strict";
// One small HTTP helper for all providers: timeout, one retry on transient
// failures, size limit, and every failure turned into a ProviderError.

const { ProviderError } = require("./errors");

const USER_AGENT = "learning-streak-card/0.1 (+https://github.com/Florian-85/learning-streak-card)";
const MAX_BYTES = 1024 * 1024;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function attempt(fetchImpl, url, options, timeoutMs) {
  let response;
  try {
    response = await fetchImpl(url, {
      method: options.method ?? "GET",
      headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...options.headers },
      body: options.body,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") throw new ProviderError("TIMEOUT", `no answer within ${timeoutMs / 1000}s`);
    throw new ProviderError("NETWORK", `network error (${error?.cause?.code ?? error?.message ?? "unknown"})`);
  }
  if (response.status === 404 || response.status === 410) throw new ProviderError("NOT_FOUND", "the account was not found");
  if (response.status === 429) throw new ProviderError("RATE_LIMITED", "the service is rate limiting this IP address");
  if (!response.ok) throw new ProviderError("HTTP", `HTTP ${response.status}`);
  let text;
  try {
    text = await response.text();
  } catch (error) {
    throw new ProviderError("NETWORK", `could not read the response (${error?.message})`);
  }
  if (text.length > MAX_BYTES) throw new ProviderError("BAD_RESPONSE", "response is too large");
  try {
    return JSON.parse(text);
  } catch {
    throw new ProviderError("BAD_RESPONSE", "the response is not valid JSON");
  }
}

// Retries once, only when a second try can help (timeout, network, 5xx).
async function fetchJson(url, { fetchImpl = fetch, timeoutMs = 10000, retryDelayMs = 1500, ...options } = {}) {
  try {
    return await attempt(fetchImpl, url, options, timeoutMs);
  } catch (error) {
    const transient = error instanceof ProviderError &&
      (error.code === "TIMEOUT" || error.code === "NETWORK" || (error.code === "HTTP" && /HTTP 5\d\d/.test(error.message)));
    if (!transient) throw error;
    await sleep(retryDelayMs);
    return attempt(fetchImpl, url, options, timeoutMs);
  }
}

module.exports = { fetchJson, USER_AGENT };
