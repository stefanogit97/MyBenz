
"use strict";

// ==========================================
// MY BENZ - CONFIGURAZIONE
// ==========================================

const STORAGE_KEY = "mybenz.records.v1";
const THEME_STORAGE_KEY = "mybenz.theme.v1";

let records = [];
let storageHealthy = true;

// ==========================================
// ELEMENTI HTML
// ==========================================

const $ = (selector) => document.querySelector(selector);

const totalLitersElement = $("#total-liters");
const fuelCostElement = $("#fuel-cost");
const expenseCostElement = $("#expense-cost");
const totalKmElement = $("#total-km");
const avgConsumptionElement = $("#avg-consumption");

const entryForm = $("#entry-form");
const recordType = $("#record-type");

const fuelFields = $("#fuel-fields");
const expenseFields = $("#expense-fields");

const fuelDate = $("#fuel-date");
const fuelOdometer = $("#fuel-odometer");
const fuelFillType = $("#fuel-fill-type");
const fuelType = $("#fuel-type");
const fuelLiters = $("#fuel-liters");
const fuelCostInput = $("#fuel-cost-input");
const fuelStation = $("#fuel-station");
const fuelNote = $("#fuel-note");

const expenseDate = $("#expense-date");
const expenseCategory = $("#expense-category");
const expenseCostInput = $("#expense-cost-input");
const expenseVendor = $("#expense-vendor");
const expenseNote = $("#expense-note");

const historyList = $("#history-list");

const registerTab = $("#tab-registro");
const storicoTab = $("#tab-storico");
const chartsTab = $("#tab-grafici");

const registerPanel = $("#panel-registro");
const storicoPanel = $("#panel-storico");
const chartsPanel = $("#panel-grafici");

const themeToggle = $("#theme-toggle");
const themeToggleIcon = $("#theme-toggle-icon");
const themeToggleLabel = $("#theme-toggle-label");

// ==========================================
// ARCHIVIO DATI
// ==========================================

function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      throw new Error("Archivio non valido");
    }

    return parsed;
  } catch (error) {
    storageHealthy = false;
    alert(
      "Attenzione: non riesco a leggere l'archivio. " +
      "I dati originali non verranno sovrascritti."
    );
    console.error(error);
    return [];
  }
}

function saveRecords() {
  if (!storageHealthy) {
    alert("Salvataggio bloccato per proteggere i dati esistenti.");
    return false;
  }

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(records)
    );
    return true;
  } catch (error) {
    alert("Errore durante il salvataggio. Controlla lo spazio disponibile.");
    console.error(error);
    return false;
  }
}

// ==========================================
// UTILITÀ
// ==========================================


function formatEuro(value) {
  const amount = Number(value) || 0;

  return "€ " + amount.toLocaleString("it-IT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function makeId() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value));
}

// ==========================================
// STORICO
// ==========================================

function renderHistory() {
  historyList.replaceChildren();

  const sorted = [...records].sort((a, b) =>
    String(b.date || "").localeCompare(String(a.date || ""))
  );

  for (const record of sorted) {
    const row = document.createElement("tr");

    const dateCell = document.createElement("td");
    dateCell.textContent = record.date || "—";

    const typeCell = document.createElement("td");
    typeCell.textContent =
      record.type === "fuel" ? "Pieno" : "Spesa";

    const detailCell = document.createElement("td");

    if (record.type === "fuel") {
      detailCell.textContent =
        `${record.fuelType || "Carburante"} · ${record.liters || 0} L` +
        (record.fillType === "full" ? " · Completo" :
          record.fillType === "partial" ? " · Parziale" : "");
    } else {
      detailCell.textContent = record.category || "Spesa";
    }

    const costCell = document.createElement("td");
    costCell.textContent = formatEuro(record.totalCost);

    const actionCell = document.createElement("td");
    const deleteButton = document.createElement("button");

    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.dataset.id = record.id;
    deleteButton.textContent = "Elimina";

    actionCell.append(deleteButton);

    row.append(
      dateCell,
      typeCell,
      detailCell,
      costCell,
      actionCell
    );

    historyList.append(row);
  }
}

historyList.addEventListener("click", (event) => {
  const button = event.target.closest(".delete-button");

  if (!button) return;

  const id = button.dataset.id;

  if (!confirm("Vuoi eliminare questo movimento?")) return;

  const previousRecords = records;
  records = records.filter(record => record.id !== id);

  if (!saveRecords()) {
    records = previousRecords;
    return;
  }

  renderHistory();
  renderSummary();
});

// ==========================================
// CALCOLO STATISTICHE
// ==========================================

function renderSummary() {
  const fuelRecords = records.filter(
    record => record.type === "fuel"
  );

  const expenseRecords = records.filter(
    record => record.type === "expense"
  );

  const totalLiters = fuelRecords.reduce(
    (sum, record) => sum + (Number(record.liters) || 0),
    0
  );

  const fuelCost = fuelRecords.reduce(
    (sum, record) => sum + (Number(record.totalCost) || 0),
    0
  );

  const expenseCost = expenseRecords.reduce(
    (sum, record) => sum + (Number(record.totalCost) || 0),
    0
  );

  const ordered = [...fuelRecords].sort(
    (a, b) => String(a.date || "").localeCompare(String(b.date || ""))
  );

  let totalKm = 0;

  for (let i = 1; i < ordered.length; i++) {
    const previousKm = Number(ordered[i - 1].odometer);
    const currentKm = Number(ordered[i].odometer);

    if (
      Number.isFinite(previousKm) &&
      Number.isFinite(currentKm) &&
      currentKm > previousKm
    ) {
      totalKm += currentKm - previousKm;
    }
  }

  // Calcolo pieno-pieno.
  // I vecchi rifornimenti senza fillType non vengono
  // considerati automaticamente pieni completi.

  let lastFull = null;
  let litersSinceFull = 0;
  let segmentHasUnknown = false;
  let consumptionKm = 0;
  let consumptionLiters = 0;

  for (const record of ordered) {
    if (!record.fillType) {
      if (lastFull) segmentHasUnknown = true;
      continue;
    }

    if (record.fillType === "full") {
      if (lastFull && !segmentHasUnknown) {
        const distance =
          Number(record.odometer) - Number(lastFull.odometer);

        if (
          Number.isFinite(distance) &&
          distance > 0 &&
          litersSinceFull > 0
        ) {
          consumptionKm += distance;
          consumptionLiters += litersSinceFull;
        }
      }

      lastFull = record;
      litersSinceFull = 0;
      segmentHasUnknown = false;

    } else if (record.fillType === "partial" && lastFull) {
      litersSinceFull += Number(record.liters) || 0;
    }
  }

  const avgConsumption =
    consumptionLiters > 0
      ? consumptionKm / consumptionLiters
      : null;

  totalLitersElement.textContent = totalLiters.toFixed(1);
  fuelCostElement.textContent = formatEuro(fuelCost);
  expenseCostElement.textContent = formatEuro(expenseCost);
  totalKmElement.textContent = totalKm.toLocaleString("it-IT");

  avgConsumptionElement.textContent =
    avgConsumption === null
      ? "—"
      : `${avgConsumption.toFixed(1)} km/l`;
}

// ==========================================
// GRAFICI
// ==========================================

function drawChart(canvas, drawFunction) {
  if (!canvas) return;

  const width = canvas.clientWidth;
  const height = 240;
  const ratio = window.devicePixelRatio || 1;

  canvas.width = width * ratio;
  canvas.height = height * ratio;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  ctx.clearRect(0, 0, width, height);

  drawFunction(ctx, width, height);
}

function renderCharts() {
  const consumptionCanvas = $("#consumption-chart");
  const monthlyCanvas = $("#monthly-chart");
  const costCanvas = $("#cost-chart");

  const styles = getComputedStyle(document.documentElement);
  const blue = "#1677ff";
  const orange = "#ff8a24";
  const textColor = styles.color || "#222222";
  const mutedColor = "#888888";

  // 1. CONSUMO MEDIO PIENO-PIENO

  const fuelRecords = records
    .filter(record => record.type === "fuel")
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));

  const consumptionPoints = [];
  let lastFull = null;
  let litersSinceFull = 0;
  let segmentHasUnknown = false;

  for (const record of fuelRecords) {
    if (!record.fillType) {
      if (lastFull) segmentHasUnknown = true;
      continue;
    }

    if (record.fillType === "full") {
      if (lastFull && !segmentHasUnknown) {
        const km = Number(record.odometer) - Number(lastFull.odometer);

        if (km > 0 && litersSinceFull > 0) {
          consumptionPoints.push({
            date: record.date,
            value: km / litersSinceFull
          });
        }
      }

      lastFull = record;
      litersSinceFull = 0;
      segmentHasUnknown = false;

    } else if (record.fillType === "partial" && lastFull) {
      litersSinceFull += Number(record.liters) || 0;
    }
  }

  drawChart(consumptionCanvas, (ctx, width, height) => {
    if (!consumptionPoints.length) {
      ctx.fillStyle = mutedColor;
      ctx.textAlign = "center";
      ctx.fillText("Servono almeno due pieni completi", width / 2, height / 2);
      return;
    }

    const values = consumptionPoints.map(point => point.value);
    const max = Math.max(...values) * 1.15;
    const min = Math.min(0, Math.min(...values) * 0.85);
    const left = 42;
    const right = 12;
    const top = 20;
    const bottom = 35;

    ctx.strokeStyle = "#dddddd";
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, height - bottom);
    ctx.lineTo(width - right, height - bottom);
    ctx.stroke();

    ctx.strokeStyle = blue;
    ctx.lineWidth = 3;
    ctx.beginPath();

    values.forEach((value, index) => {
      const x = left + index * (width - left - right) /
        Math.max(1, values.length - 1);
      const y = height - bottom -
        ((value - min) / (max - min || 1)) * (height - top - bottom);

      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();

    values.forEach((value, index) => {
      const x = left + index * (width - left - right) /
        Math.max(1, values.length - 1);
      const y = height - bottom -
        ((value - min) / (max - min || 1)) * (height - top - bottom);

      ctx.fillStyle = orange;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.fillStyle = textColor;
    ctx.textAlign = "left";
    ctx.fillText(`${values[values.length - 1].toFixed(1)} km/l`, left, 13);
  });

  // 2. SPESE MENSILI

  const months = {};

  records.forEach(record => {
    const month = String(record.date || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) return;

    if (!months[month]) {
      months[month] = { fuel: 0, expense: 0 };
    }

    if (record.type === "fuel") {
      months[month].fuel += Number(record.totalCost) || 0;
    } else if (record.type === "expense") {
      months[month].expense += Number(record.totalCost) || 0;
    }
  });

  const monthEntries = Object.entries(months).sort(
    (a, b) => a[0].localeCompare(b[0])
  ).slice(-6);

  drawChart(monthlyCanvas, (ctx, width, height) => {
    if (!monthEntries.length) {
      ctx.fillStyle = mutedColor;
      ctx.textAlign = "center";
      ctx.fillText("Nessuna spesa registrata", width / 2, height / 2);
      return;
    }

    const max = Math.max(
      1,
      ...monthEntries.map(([, values]) => values.fuel + values.expense)
    );

    const chartHeight = height - 55;
    const slot = (width - 30) / monthEntries.length;
    const barWidth = Math.min(34, slot * 0.65);

    monthEntries.forEach(([month, values], index) => {
      const x = 15 + index * slot + (slot - barWidth) / 2;
      const fuelHeight = values.fuel / max * chartHeight;
      const expenseHeight = values.expense / max * chartHeight;

      ctx.fillStyle = blue;
      ctx.fillRect(x, height - 35 - fuelHeight, barWidth, fuelHeight);

      ctx.fillStyle = orange;
      ctx.fillRect(
        x,
        height - 35 - fuelHeight - expenseHeight,
        barWidth,
        expenseHeight
      );

      ctx.fillStyle = textColor;
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(month.slice(5), x + barWidth / 2, height - 15);
    });
  });

  // 3. DISTRIBUZIONE DEI COSTI

  const fuelTotal = records
    .filter(record => record.type === "fuel")
    .reduce((sum, record) => sum + (Number(record.totalCost) || 0), 0);

  const expenseTotal = records
    .filter(record => record.type === "expense")
    .reduce((sum, record) => sum + (Number(record.totalCost) || 0), 0);

  drawChart(costCanvas, (ctx, width, height) => {
    const total = fuelTotal + expenseTotal;

    if (total <= 0) {
      ctx.fillStyle = mutedColor;
      ctx.textAlign = "center";
      ctx.fillText("Nessun costo registrato", width / 2, height / 2);
      return;
    }

    const centerX = width / 2;
    const centerY = 105;
    const radius = 75;
    let startAngle = -Math.PI / 2;

    [
      { value: fuelTotal, color: blue },
      { value: expenseTotal, color: orange }
    ].forEach(item => {
      const angle = item.value / total * Math.PI * 2;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + angle);
      ctx.closePath();
      ctx.fillStyle = item.color;
      ctx.fill();

      startAngle += angle;
    });

    ctx.fillStyle = textColor;
    ctx.textAlign = "center";
    ctx.font = "bold 15px sans-serif";
    ctx.fillText(formatEuro(total), centerX, centerY + 5);

    ctx.font = "12px sans-serif";
    ctx.fillStyle = blue;
    ctx.fillText(`● Carburante: ${formatEuro(fuelTotal)}`, centerX, 205);

    ctx.fillStyle = orange;
    ctx.fillText(`● Altre spese: ${formatEuro(expenseTotal)}`, centerX, 225);
  });
}

// ==========================================
// TIPO MOVIMENTO
// ==========================================


function updateRecordFields() {
  const isFuel = recordType.value === "fuel";

  fuelFields.hidden = !isFuel;
  expenseFields.hidden = isFuel;

  // Disabilita i campi nascosti:
  // evita che i campi obbligatori blocchino il modulo.
  fuelFields.querySelectorAll("input, select, textarea")
    .forEach(field => {
      field.disabled = !isFuel;
    });

  expenseFields.querySelectorAll("input, select, textarea")
    .forEach(field => {
      field.disabled = isFuel;
    });
}

recordType.addEventListener("change", updateRecordFields);

// ==========================================
// TEMA CHIARO / SCURO
// ==========================================

function applyTheme(theme) {
  const isDark = theme === "dark";

  document.documentElement.dataset.theme =
    isDark ? "dark" : "light";

  themeToggleIcon.textContent = isDark ? "☀" : "☾";
  themeToggleLabel.textContent = isDark ? "Chiaro" : "Scuro";

  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    console.warn("Impossibile salvare il tema", error);
  }
}

themeToggle.addEventListener("click", () => {
  const nextTheme =
    document.documentElement.dataset.theme === "dark"
      ? "light"
      : "dark";

  applyTheme(nextTheme);
});

// ==========================================
// NAVIGAZIONE
// ==========================================

function activateTab(tab) {
  registerPanel.hidden = true;
  storicoPanel.hidden = true;
  chartsPanel.hidden = true;

  registerTab.classList.remove("is-active");
  storicoTab.classList.remove("is-active");
  chartsTab.classList.remove("is-active");

  tab.classList.add("is-active");

  if (tab === registerTab) registerPanel.hidden = false;
  if (tab === storicoTab) storicoPanel.hidden = false;
  if (tab === chartsTab) chartsPanel.hidden = false;
}

registerTab.addEventListener("click", () => activateTab(registerTab));
storicoTab.addEventListener("click", () => activateTab(storicoTab));
chartsTab.addEventListener("click", () => activateTab(chartsTab));

// ==========================================
// SALVATAGGIO MOVIMENTI
// ==========================================

entryForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!storageHealthy) {
    alert("Archivio non disponibile: impossibile salvare.");
    return;
  }

  let record;

  if (recordType.value === "fuel") {
    const liters = Number(fuelLiters.value);
    const cost = Number(fuelCostInput.value);
    const odometer = Number(fuelOdometer.value);

    if (!validDate(fuelDate.value)) {
      alert("Inserisci una data valida.");
      return;
    }

    if (!Number.isFinite(odometer) || odometer < 0) {
      alert("Inserisci un chilometraggio valido.");
      return;
    }

    if (!Number.isFinite(liters) || liters <= 0) {
      alert("Inserisci una quantità di litri valida.");
      return;
    }

    if (!Number.isFinite(cost) || cost <= 0) {
      alert("Inserisci un costo valido.");
      return;
    }

    if (!["full", "partial"].includes(fuelFillType.value)) {
      alert("Seleziona il tipo di rifornimento.");
      return;
    }

    record = {
      id: makeId(),
      type: "fuel",
      date: fuelDate.value,
      odometer,
      fillType: fuelFillType.value,
      fuelType: fuelType.value,
      liters,
      totalCost: cost,
      station: fuelStation.value.trim(),
      note: fuelNote.value.trim()
    };

  } else {
    const cost = Number(expenseCostInput.value);

    if (!validDate(expenseDate.value)) {
      alert("Inserisci una data valida.");
      return;
    }

    if (!Number.isFinite(cost) || cost <= 0) {
      alert("Inserisci un costo valido.");
      return;
    }

    record = {
      id: makeId(),
      type: "expense",
      date: expenseDate.value,
      category: expenseCategory.value,
      totalCost: cost,
      vendor: expenseVendor.value.trim(),
      note: expenseNote.value.trim()
    };
  }

  records.push(record);

  if (!saveRecords()) {
    records.pop();
    return;
  }

  renderHistory();
  renderSummary();

  entryForm.reset();
  updateRecordFields();

  alert("Movimento salvato correttamente!");
});

// ==========================================
// AVVIO APP
// ==========================================

try {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  applyTheme(savedTheme === "dark" ? "dark" : "light");
} catch (error) {
  applyTheme("light");
}

activateTab(registerTab);
updateRecordFields();

records = loadRecords();

renderHistory();
renderSummary();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js")
    .catch(error => console.error("Service Worker:", error));
}
