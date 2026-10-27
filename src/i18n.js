"use strict";
// Labels. Dates and language names come from Intl, so only short words live here.
// Rule: a label never says more than the number means (account age is not study time).

const LANGS = {
  en: {
    metrics: {
      xp: "Experience points",
      streakDays: "Current streak",
      accountSince: "Account age",
      startedOn: "Learning for (declared)",
      studyHours: "Study time (declared)",
      rating: "Current rating",
      bestRating: "Best rating",
      games: "Games played",
    },
    allCourses: "all courses",
    days: ["day", "days"],
    since: "Since",
    notProvided: "not provided",
    unit: { y: "y", m: "m", h: "h" },
    modes: { rapid: "Rapid", blitz: "Blitz", bullet: "Bullet", daily: "Daily" },
    stale: "Source unreachable · values as of",
    ariaCard: "Learning streak card",
  },
  fr: {
    metrics: {
      xp: "Points d'expérience",
      streakDays: "Série en cours",
      accountSince: "Ancienneté du compte",
      startedOn: "Apprentissage depuis (déclaré)",
      studyHours: "Temps d'étude (déclaré)",
      rating: "Classement actuel",
      bestRating: "Meilleur classement",
      games: "Parties jouées",
    },
    allCourses: "tous les cours",
    days: ["jour", "jours"],
    since: "Depuis",
    notProvided: "non renseigné",
    unit: { y: "an", ym: "ans", m: "mois", h: "h" },
    modes: { rapid: "Rapide", blitz: "Blitz", bullet: "Bullet", daily: "Par correspondance" },
    stale: "Source injoignable · valeurs au",
    ariaCard: "Carte de série d'apprentissage",
  },
};

const LANG_NAMES = Object.keys(LANGS);

module.exports = { LANGS, LANG_NAMES };
