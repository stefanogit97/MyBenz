"use strict";
const STORAGE_KEY = "mybenz.records.v1";
function loadRecords() {

  const raw =
    localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return [];
  }

  return JSON.parse(raw);
}

function saveRecords() {

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(records)
  );
}
let records = [];
const THEME_STORAGE_KEY = "mybenz.theme.v1";
const entryForm =
  document.querySelector("#entry-form");
const registerTab = document.querySelector("#tab-registro");
const storicoTab = document.querySelector("#tab-storico");
const chartsTab = document.querySelector("#tab-grafici");

const registerPanel = document.querySelector("#panel-registro");
const storicoPanel = document.querySelector("#panel-storico");
const chartsPanel = document.querySelector("#panel-grafici");

const themeToggle = document.querySelector("#theme-toggle");
const themeToggleIcon = document.querySelector("#theme-toggle-icon");
const themeToggleLabel = document.querySelector("#theme-toggle-label");
const recordType =
  document.querySelector("#record-type");

const fuelFields =
  document.querySelector("#fuel-fields");

const expenseFields =
  document.querySelector("#expense-fields");

recordType.addEventListener(
  "change",
  () => {

    const isFuel =
      recordType.value === "fuel";

    fuelFields.hidden = !isFuel;

    expenseFields.hidden = isFuel;

  }
);

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

records = loadRecords();
console.log(records);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register(
    "./service-worker.js"
  );
}
entryForm.addEventListener(
  "submit",
  (event) => {

    event.preventDefault();

    if (
      recordType.value === "fuel"
    ) {

      const record = {

        id: crypto.randomUUID(),

        type: "fuel",

        date:
          document.querySelector("#fuel-date").value,

        odometer:
          Number(
            document.querySelector("#fuel-odometer").value
          ),

        fuelType:
          document.querySelector("#fuel-type").value,

        liters:
          Number(
            document.querySelector("#fuel-liters").value
          ),

        totalCost:
          Number(
            document.querySelector("#fuel-cost").value
          ),

        station:
          document.querySelector("#fuel-station").value,

        note:
          document.querySelector("#fuel-note").value

      };

      records.push(record);

    } else {

      const record = {

        id: crypto.randomUUID(),

        type: "expense",

        date:
          document.querySelector("#expense-date").value,

        category:
          document.querySelector("#expense-category").value,

        totalCost:
          Number(
            document.querySelector("#expense-cost").value
          ),

        vendor:
          document.querySelector("#expense-vendor").value,

        note:
          document.querySelector("#expense-note").value

      };

      records.push(record);
    }

    saveRecords();

    console.log(records);

    alert("Movimento salvato");
  }
);
