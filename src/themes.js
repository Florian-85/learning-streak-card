"use strict";
// The four themes. Colors only; the layout is shared.

const THEMES = {
  dark: {
    bg: "#0D1117", bg2: "#0D1117", border: "#30363D", fg: "#C9D1D9", muted: "#8B949E",
    accent: "#58A6FF", gold: "#F2C200", flame: "#FF9A3C", warn: "#D29922",
  },
  light: {
    bg: "#FFFFFF", bg2: "#FFFFFF", border: "#D0D7DE", fg: "#1F2328", muted: "#656D76",
    accent: "#0969DA", gold: "#B38600", flame: "#E8590C", warn: "#9A6700",
  },
  "funky-dark": {
    bg: "#140B2E", bg2: "#2A0F4D", border: "#4B2FA0", fg: "#F3EAFF", muted: "#B9A6E8",
    accent: "#FF4FD8", gold: "#FFD166", flame: "#FF9A3C", warn: "#FFD166",
  },
  "funky-light": {
    bg: "#D2C6FF", bg2: "#FFC2E8", border: "#7B3FE4", fg: "#24105A", muted: "#5B3FB0",
    accent: "#D1128F", gold: "#8A5A00", flame: "#E8590C", warn: "#7A4A00",
  },
};

const THEME_NAMES = Object.keys(THEMES);

module.exports = { THEMES, THEME_NAMES };
