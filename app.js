"use strict";

const THEME_STORAGE_KEY = "mybenz.theme.v1";

const registerTab = document.querySelector("#tab-registro");
const storicoTab = document.querySelector("#tab-storico");
const chartsTab = document.querySelector("#tab-grafici");

const registerPanel = document.querySelector("#panel-registro");
const storicoPanel = document.querySelector("#panel-storico");
const chartsPanel = document.querySelector("#panel-grafici");

const themeToggle = document.querySelector("#theme-toggle");
const themeToggleIcon = document.querySelector("#theme-toggle-icon");
const themeToggleLabel = document.querySelector("#theme-toggle-label");

function applyTheme(theme) {
  const isDark = theme === "dark";

  document.documentElement.dataset.theme =
    isDark ? "dark" : "light";

  themeToggleIcon.textContent =
    isDark ? "☀" : "☾";

  themeToggleLabel.textContent =
    isDark ? "Chiaro" : "Scuro";

  localStorage.setItem(
    THEME_STORAGE_KEY,
    theme
  );
}

function activateTab(tab) {

  registerPanel.hidden = true;
  storicoPanel.hidden = true;
  chartsPanel.hidden = true;

  registerTab.classList.remove("is-active");
  storicoTab.classList.remove("is-active");
  chartsTab.classList.remove("is-active");

  tab.classList.add("is-active");

  if (tab === registerTab) {
    registerPanel.hidden = false;
  }

  if (tab === storicoTab) {
    storicoPanel.hidden = false;
  }

  if (tab === chartsTab) {
    chartsPanel.hidden = false;
  }
}

registerTab.addEventListener("click", () => {
  activateTab(registerTab);
});

storicoTab.addEventListener("click", () => {
  activateTab(storicoTab);
});

chartsTab.addEventListener("click", () => {
  activateTab(chartsTab);
});

themeToggle.addEventListener("click", () => {

  const nextTheme =
    document.documentElement.dataset.theme === "dark"
      ? "light"
      : "dark";

  applyTheme(nextTheme);
});

applyTheme(
  localStorage.getItem(THEME_STORAGE_KEY) === "dark"
    ? "dark"
    : "light"
);

activateTab(registerTab);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register(
    "./service-worker.js"
  );
}
