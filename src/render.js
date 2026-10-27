"use strict";
// The SVG renderer. Pure: card data in, SVG string out. No network, no file, no
// dependency, and nothing here knows which provider produced the numbers.

const { THEMES } = require("./themes");
const { LANGS } = require("./i18n");

const WIDTH = 900;
const HEIGHT = 124;
const FONT = "'Segoe UI',Ubuntu,'Helvetica Neue',Sans-Serif";
const CENTERS = [150, 450, 750];

const esc = value => String(value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function formatCount(value, lang) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, lang === "fr" ? " " : ",");
}

function formatHours(value, lang) {
  const rounded = Math.round(value * 10) / 10;
  const [whole, decimals] = String(rounded).split(".");
  const text = formatCount(whole, lang);
  return decimals ? `${text}${lang === "fr" ? "," : "."}${decimals}` : text;
}

const monthIndex = month => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;

function formatDuration(month, now, lang) {
  const total = Math.max(0, now.getUTCFullYear() * 12 + now.getUTCMonth() - monthIndex(month));
  const u = LANGS[lang].unit;
  const years = Math.floor(total / 12);
  const months = total % 12;
  if (years === 0) return `${months} ${u.m}`;
  return `${years} ${years > 1 && u.ym ? u.ym : u.y} ${months} ${u.m}`;
}

function formatMonth(month, lang) {
  const date = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1));
  return new Intl.DateTimeFormat(lang, { month: "short", year: "numeric", timeZone: "UTC" }).format(date);
}

function formatDay(day, lang) {
  return new Intl.DateTimeFormat(lang, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`));
}

function languageName(code, lang) {
  try {
    return new Intl.DisplayNames([lang], { type: "language" }).of(code) || code;
  } catch {
    return code;
  }
}

// What a column prints: a big value, a label, a small line under it.
function describe(col, lang, now) {
  const L = LANGS[lang];
  const label = L.metrics[col.metric];
  const modeName = col.mode ? L.modes[col.mode] : "";
  if (col.value === null) return { big: "—", label, sub: L.notProvided };
  switch (col.metric) {
    case "xp":
      return { big: `${formatCount(col.value, lang)} XP`, label, sub: col.language ? languageName(col.language, lang) : col.scope === "all" ? L.allCourses : "" };
    case "streakDays":
      return { big: String(col.value), label, sub: L.days[col.value === 1 ? 0 : 1] };
    case "accountSince":
    case "startedOn":
      return { big: formatDuration(col.value, now, lang), label, sub: `${L.since} ${formatMonth(col.value, lang)}` };
    case "studyHours":
      return { big: `${formatHours(col.value, lang)} ${L.unit.h}`, label, sub: "" };
    default:
      return { big: formatCount(col.value, lang), label, sub: modeName };
  }
}

function icon(metric, cx, T) {
  const a = `fill="none" stroke="${T.accent}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`;
  switch (metric) {
    case "xp":
      return `<g transform="translate(${cx},50)"><path d="M3,-16 L-9,3 H-1 L-4,16 L10,-5 H1 Z" fill="${T.gold}"/></g>`;
    case "accountSince":
    case "startedOn":
    case "studyHours":
      return `<g transform="translate(${cx},50)"><rect x="-13" y="-10" width="26" height="22" rx="4" ${a}/><line x1="-13" y1="-3" x2="13" y2="-3" ${a}/>` +
        `<line x1="-6" y1="-14" x2="-6" y2="-7" ${a}/><line x1="6" y1="-14" x2="6" y2="-7" ${a}/></g>`;
    case "games":
      return `<g transform="translate(${cx},50)"><rect x="-12" y="-12" width="10" height="10" ${a}/><rect x="2" y="-12" width="10" height="10" ${a}/>` +
        `<rect x="-12" y="2" width="10" height="10" ${a}/><rect x="2" y="2" width="10" height="10" ${a}/></g>`;
    default: // rating, bestRating, streakDays outside the middle column
      return `<g transform="translate(${cx},50)"><path d="M0,-14 L4.2,-4.6 L14,-4.6 L6.2,1.8 L9,12 L0,6.2 L-9,12 L-6.2,1.8 L-14,-4.6 L-4.2,-4.6 Z" fill="${T.gold}"/></g>`;
  }
}

function fitSize(text, base, maxWidth) {
  return Math.max(12, Math.min(base, Math.floor(maxWidth / (Math.max(text.length, 1) * 0.6))));
}

function column(col, index, lang, T, now, animate) {
  const cx = CENTERS[index];
  const d = describe(col, lang, now);
  const dim = col.value === null ? ' opacity="0.7"' : "";
  const parts = [];
  if (index === 1 && col.metric === "streakDays" && col.value !== null) {
    const flame = T.flame;
    const pulse = animate ? '<animate attributeName="opacity" values="1;.6;1" dur="1.3s" repeatCount="indefinite"/>' : "";
    parts.push(`<circle cx="${cx}" cy="60" r="34" fill="none" stroke="${flame}" stroke-width="5" opacity=".25"/>` +
      `<circle cx="${cx}" cy="60" r="34" fill="none" stroke="${flame}" stroke-width="5" stroke-linecap="round" stroke-dasharray="213.6" stroke-dashoffset="32" transform="rotate(-90 ${cx} 60)"/>` +
      `<path d="M450,36 C455,43 460,47 460,54 C460,60 456,64 450,64 C444,64 440,60 440,54 C440,49 443,47 445,42 C447,45 448,47 450,36 Z" fill="${flame}">${pulse}</path>` +
      `<text x="${cx}" y="86" text-anchor="middle" font-size="${fitSize(d.big, 20, 56)}" font-weight="800" fill="${T.fg}">${esc(d.big)}</text>`);
  } else {
    parts.push(icon(col.metric, cx, T) +
      `<text x="${cx}" y="86" text-anchor="middle" font-size="${fitSize(d.big, 24, 270)}" font-weight="700" fill="${T.fg}">${esc(d.big)}</text>`);
  }
  parts.push(`<text x="${cx}" y="104" text-anchor="middle" font-size="12" fill="${T.accent}">${esc(d.label)}</text>`);
  if (d.sub) parts.push(`<text x="${cx}" y="118" text-anchor="middle" font-size="11" fill="${T.muted}">${esc(d.sub)}</text>`);
  return `<g${dim}>${parts.join("")}</g>`;
}

/**
 * @param {object} card   a validated card (see contract.js)
 * @param {object} opts   { theme, lang, title, stale, animate, now, extra }
 *                        extra: raw markup appended before </svg> (used for the embedded data)
 */
function renderCard(card, opts = {}) {
  const T = THEMES[opts.theme ?? "dark"];
  const lang = opts.lang ?? "en";
  const L = LANGS[lang];
  const now = opts.now ?? new Date();
  const animate = opts.animate !== false;
  const title = opts.title ?? card.provider;
  const aria = [L.ariaCard, title, card.account === title ? "" : card.account].filter(Boolean).join(" · ");
  const gradient = T.bg === T.bg2 ? "" : `<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${T.bg}"/><stop offset="1" stop-color="${T.bg2}"/></linearGradient></defs>`;
  const fill = gradient ? "url(#bg)" : T.bg;
  const stale = opts.stale
    ? `<text x="${WIDTH - 24}" y="26" text-anchor="end" font-size="11" font-weight="600" fill="${T.warn}">! ${esc(L.stale)} ${esc(formatDay(card.asOf, lang))}</text>`
    : "";
  return [
    `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg" font-family="${FONT}" role="img" aria-label="${esc(aria)}">`,
    `<title>${esc(aria)}</title>`,
    gradient,
    `<rect x="0.5" y="0.5" width="${WIDTH - 1}" height="${HEIGHT - 1}" rx="10" fill="${fill}" stroke="${T.border}"/>`,
    `<circle cx="31" cy="21" r="5" fill="${T.accent}"/>`,
    `<text x="44" y="26" font-size="11" letter-spacing="1.5" font-weight="700" fill="${T.accent}">${esc(String(title).toUpperCase())}</text>`,
    stale,
    `<line x1="300" y1="40" x2="300" y2="108" stroke="${T.border}"/><line x1="600" y1="40" x2="600" y2="108" stroke="${T.border}"/>`,
    ...card.columns.map((col, i) => column(col, i, lang, T, now, animate)),
    opts.extra ?? "",
    "</svg>",
  ].filter(Boolean).join("\n") + "\n";
}

module.exports = { renderCard, esc, formatCount, formatDuration, WIDTH, HEIGHT };
