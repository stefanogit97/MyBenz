
"use strict";

// ==========================================
// MY PIT - CONFIGURAZIONE
// ==========================================

const STORAGE_KEY = "mypit.records.v1";
const THEME_STORAGE_KEY = "mypit.theme.v1";

let records = [];
let storageHealthy = true;



// ==========================================
// ELEMENTI HTML
// ==========================================

const $ = (selector) => document.querySelector(selector);

// ==========================================
// FILTRO PERIODO
// ==========================================

const filterPeriod = $("#filter-period");
const filterMonth = $("#filter-month");
const filterYear = $("#filter-year");

const today = new Date();

filterMonth.value =
  `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

filterYear.value = today.getFullYear();

function getFilteredRecords() {
  const period = filterPeriod.value;

  if (period === "month") {
    return records.filter(record =>
      String(record.date || "").slice(0, 7) === filterMonth.value
    );
  }

  if (period === "year") {
    return records.filter(record =>
      String(record.date || "").slice(0, 4) === filterYear.value
    );
  }

  return records;
}

function updatePeriodFilter() {
  filterMonth.hidden = filterPeriod.value !== "month";
  filterYear.hidden = filterPeriod.value !== "year";

  renderSummary();
  renderCharts();
}

filterPeriod.addEventListener("change", updatePeriodFilter);
filterMonth.addEventListener("change", updatePeriodFilter);
filterYear.addEventListener("change", updatePeriodFilter);


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
  `${record.fuelType || "Carburante"} · ${record.liters || 0} L`;
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
  renderCharts();
});

// ==========================================
// CALCOLO STATISTICHE
// ==========================================


function renderSummary() {
  const periodRecords = getFilteredRecords();

  const fuelRecords = periodRecords.filter(
    record => record.type === "fuel"
  );

  const expenseRecords = periodRecords.filter(
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

  // Ordina tutti i rifornimenti per data
  const allFuel = records
    .filter(record => record.type === "fuel")
    .sort((a, b) =>
      String(a.date || "").localeCompare(String(b.date || ""))
    );

  const selectedRecords = new Set(fuelRecords);

  let totalKm = 0;
  let consumptionKm = 0;
  let consumptionLiters = 0;

  // Ogni rifornimento viene confrontato con il precedente
  for (let i = 1; i < allFuel.length; i++) {
    const previous = allFuel[i - 1];
    const current = allFuel[i];

    if (!selectedRecords.has(current)) continue;

    const km =
      Number(current.odometer) - Number(previous.odometer);

    const liters = Number(current.liters) || 0;

    if (Number.isFinite(km) && km > 0) {
      totalKm += km;

      if (liters > 0) {
        consumptionKm += km;
        consumptionLiters += liters;
      }
    }
  }

  const avgConsumption =
    consumptionLiters > 0
      ? consumptionKm / consumptionLiters
      : null;

  totalLitersElement.textContent = totalLiters.toFixed(1);
  fuelCostElement.textContent = formatEuro(fuelCost);
  expenseCostElement.textContent = formatEuro(expenseCost);

  $("#total-expenses").textContent =
    formatEuro(fuelCost + expenseCost);

  totalKmElement.textContent =
    totalKm.toLocaleString("it-IT");

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
  if (width <= 0) return;

  const height = 280;
  const ratio = window.devicePixelRatio || 1;

  canvas.width = width * ratio;
  canvas.height = height * ratio;
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  drawFunction(ctx, width, height);
}

function renderCharts() {
  const consumptionCanvas = $("#consumption-chart");
  const monthlyCanvas = $("#monthly-chart");
  const costCanvas = $("#cost-chart");

  const periodRecords = getFilteredRecords();
  const allFuel = records
    .filter(record => record.type === "fuel")
    .sort((a, b) =>
      String(a.date || "").localeCompare(String(b.date || ""))
    );

  const selectedFuel = new Set(
    periodRecords.filter(record => record.type === "fuel")
  );

  const styles = getComputedStyle(document.documentElement);
  const textColor = styles.getPropertyValue("--ink").trim() || "#222";
  const mutedColor = styles.getPropertyValue("--muted").trim() || "#888";
  const gridColor = styles.getPropertyValue("--line").trim() || "#ddd";
  const blue = "#1677ff";
  const orange = "#ff8a24";

  // Disegna assi, griglia e valori numerici
  function drawAxes(ctx, width, height, config) {
    const { max, steps, left, right, top, bottom, suffix } = config;
    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;

    ctx.font = "11px sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let i = 0; i <= steps; i++) {
      const value = max * i / steps;
      const y = height - bottom - chartHeight * i / steps;

      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(width - right, y);
      ctx.stroke();

      ctx.fillStyle = mutedColor;
      ctx.fillText(
        `${Number(value.toFixed(1)).toLocaleString("it-IT")}${suffix}`,
        left - 7,
        y
      );
    }

    ctx.strokeStyle = gridColor;
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left, height - bottom);
    ctx.lineTo(width - right, height - bottom);
    ctx.stroke();

    return { chartWidth, chartHeight };
  }

  // 1. CONSUMO A OGNI RIFORNIMENTO

  const consumptionPoints = [];

  for (let i = 1; i < allFuel.length; i++) {
    const previous = allFuel[i - 1];
    const current = allFuel[i];

    if (!selectedFuel.has(current)) continue;

    const km =
      Number(current.odometer) - Number(previous.odometer);
    const liters = Number(current.liters);

    if (
      Number.isFinite(km) &&
      km > 0 &&
      Number.isFinite(liters) &&
      liters > 0
    ) {
      consumptionPoints.push({
        date: current.date,
        value: km / liters
      });
    }
  }

  drawChart(consumptionCanvas, (ctx, width, height) => {
    const left = 52;
    const right = 14;
    const top = 25;
    const bottom = 48;

    if (!consumptionPoints.length) {
      ctx.fillStyle = mutedColor;
      ctx.textAlign = "center";
      ctx.font = "13px sans-serif";
      ctx.fillText(
        "Servono almeno due rifornimenti con km e litri validi",
        width / 2,
        height / 2
      );
      return;
    }

    const values = consumptionPoints.map(point => point.value);
    const max = Math.max(10, Math.ceil(Math.max(...values) / 5) * 5);

    const { chartWidth, chartHeight } = drawAxes(ctx, width, height, {
      max,
      steps: 5,
      left,
      right,
      top,
      bottom,
      suffix: ""
    });

    const xPosition = index =>
      left + (
        consumptionPoints.length === 1
          ? chartWidth / 2
          : index * chartWidth / (consumptionPoints.length - 1)
      );

    const yPosition = value =>
      height - bottom - (value / max) * chartHeight;

    // Linea
    ctx.strokeStyle = blue;
    ctx.lineWidth = 2.5;
    ctx.beginPath();

    values.forEach((value, index) => {
      const x = xPosition(index);
      const y = yPosition(value);

      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();

    // Punti e valori
    values.forEach((value, index) => {
      const x = xPosition(index);
      const y = yPosition(value);

      ctx.fillStyle = orange;
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = textColor;
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(value.toFixed(1), x, y - 12);
    });

    // Date sull'asse X
    ctx.fillStyle = mutedColor;
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";

    const labelCount = Math.min(6, consumptionPoints.length);

    for (let i = 0; i < labelCount; i++) {
      const index = labelCount === 1
        ? 0
        : Math.round(i * (consumptionPoints.length - 1) / (labelCount - 1));

      const date = consumptionPoints[index].date || "";
      ctx.fillText(date.slice(5), xPosition(index), height - 25);
    }

    ctx.fillStyle = textColor;
    ctx.textAlign = "left";
    ctx.font = "11px sans-serif";
    ctx.fillText("Consumo km/l", left, 13);
  });

  // 2. SPESE MENSILI

  const months = {};

  periodRecords.forEach(record => {
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

  const monthEntries = Object.entries(months)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6);

  drawChart(monthlyCanvas, (ctx, width, height) => {
    const left = 48;
    const right = 12;
    const top = 25;
    const bottom = 48;

    if (!monthEntries.length) {
      ctx.fillStyle = mutedColor;
      ctx.textAlign = "center";
      ctx.fillText("Nessuna spesa registrata", width / 2, height / 2);
      return;
    }

    const totals = monthEntries.map(
      ([, values]) => values.fuel + values.expense
    );

    const maxValue = Math.max(10, ...totals);
    const step = Math.pow(10, Math.floor(Math.log10(maxValue)));
    const max = Math.ceil(maxValue / step) * step;

    const { chartWidth, chartHeight } = drawAxes(ctx, width, height, {
      max,
      steps: 4,
      left,
      right,
      top,
      bottom,
      suffix: "€"
    });

    const slot = chartWidth / monthEntries.length;
    const barWidth = Math.min(38, slot * 0.6);

    monthEntries.forEach(([month, values], index) => {
      const x = left + index * slot + (slot - barWidth) / 2;
      const fuelHeight = values.fuel / max * chartHeight;
      const expenseHeight = values.expense / max * chartHeight;
      const baseY = height - bottom;

      ctx.fillStyle = blue;
      ctx.fillRect(x, baseY - fuelHeight, barWidth, fuelHeight);

      ctx.fillStyle = orange;
      ctx.fillRect(
        x,
        baseY - fuelHeight - expenseHeight,
        barWidth,
        expenseHeight
      );

      ctx.fillStyle = mutedColor;
      ctx.font = "10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(month.slice(5), x + barWidth / 2, height - 25);
    });

    // Legenda
    ctx.font = "10px sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = blue;
    ctx.fillText("■ Carburante", left, 13);
    ctx.fillStyle = orange;
    ctx.fillText("■ Altre spese", left + 100, 13);
  });

  // 3. DISTRIBUZIONE COSTI

  const fuelTotal = periodRecords
    .filter(record => record.type === "fuel")
    .reduce((sum, record) => sum + (Number(record.totalCost) || 0), 0);

  const expenseTotal = periodRecords
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
    const centerY = 112;
    const radius = 72;
    let startAngle = -Math.PI / 2;

    [
      { label: "Carburante", value: fuelTotal, color: blue },
      { label: "Altre spese", value: expenseTotal, color: orange }
    ].forEach(item => {
      const angle = item.value / total * Math.PI * 2;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(
        centerX,
        centerY,
        radius,
        startAngle,
        startAngle + angle
      );
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
    ctx.textAlign = "center";

    const fuelPercent = (fuelTotal / total * 100).toFixed(1);
    const expensePercent = (expenseTotal / total * 100).toFixed(1);

    ctx.fillStyle = blue;
    ctx.fillText(
      `Carburante: ${formatEuro(fuelTotal)} (${fuelPercent}%)`,
      centerX,
      215
    );

    ctx.fillStyle = orange;
    ctx.fillText(
      `Altre spese: ${formatEuro(expenseTotal)} (${expensePercent}%)`,
      centerX,
      235
    );
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

  if (tab === registerTab) {
    registerPanel.hidden = false;
  }

  if (tab === storicoTab) {
    storicoPanel.hidden = false;
  }

  if (tab === chartsTab) {
    chartsPanel.hidden = false;
    renderCharts();
  }
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

    record = {
      id: makeId(),
      type: "fuel",
      date: fuelDate.value,
      odometer,
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
  renderCharts();

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
renderCharts();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./service-worker.js")
    .catch(error => console.error("Service Worker:", error));
}
