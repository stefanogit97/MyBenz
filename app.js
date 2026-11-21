"use strict";

// ==========================================
// MY PIT - CONFIGURAZIONE E ELEMENTI
// ==========================================
const STORAGE_KEY = "mypit.records.v1";
const THEME_STORAGE_KEY = "mypit.theme.v1";
let records = [];
let storageHealthy = true;
const $ = selector => document.querySelector(selector);

const filterPeriod = $("#filter-period");
const filterMonth = $("#filter-month");
const filterYear = $("#filter-year");
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

const today = new Date();
filterMonth.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
filterYear.value = today.getFullYear();

function parseNumber(value) {
  if (typeof value === "number") return value;
  const normalized = String(value ?? "").trim().replace(/\s/g, "").replace(",", ".");
  return normalized === "" ? NaN : Number(normalized);
}
function formatEuro(value) {
  return "€ " + (Number(value) || 0).toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}
function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("Archivio non valido");
    return parsed;
  } catch (error) {
    storageHealthy = false;
    alert("Attenzione: non riesco a leggere l'archivio. I dati originali non verranno sovrascritti.");
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    return true;
  } catch (error) {
    alert("Errore durante il salvataggio. Controlla lo spazio disponibile.");
    console.error(error);
    return false;
  }
}

function getFilteredRecords() {
  const period = filterPeriod.value;
  if (period === "month") return records.filter(r => String(r.date || "").slice(0, 7) === filterMonth.value);
  if (period === "year") return records.filter(r => String(r.date || "").slice(0, 4) === String(filterYear.value));
  return records;
}
function getPeriodLabel() {
  if (filterPeriod.value === "month" && filterMonth.value) {
    const [year, month] = filterMonth.value.split("-");
    const date = new Date(Number(year), Number(month) - 1, 1);
    return date.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  }
  if (filterPeriod.value === "year") return `Anno ${filterYear.value}`;
  return "Tutto lo storico";
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

// ==========================================
// STORICO
// ==========================================
function renderHistory() {
  historyList.replaceChildren();
  const sorted = [...records].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  for (const record of sorted) {
    const row = document.createElement("tr");
    const dateCell = document.createElement("td");
    dateCell.textContent = record.date || "—";
    const typeCell = document.createElement("td");
    typeCell.textContent = record.type === "fuel" ? "Rifornimento" : "Spesa";
    const detailCell = document.createElement("td");
    detailCell.textContent = record.type === "fuel"
      ? `${record.fuelType || "Carburante"} · ${Number(record.liters || 0).toLocaleString("it-IT")} L`
      : (record.category || "Spesa");
    const costCell = document.createElement("td");
    costCell.textContent = formatEuro(record.totalCost);
    const actionCell = document.createElement("td");
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.dataset.id = record.id;
    deleteButton.textContent = "Elimina";
    actionCell.append(deleteButton);
    row.append(dateCell, typeCell, detailCell, costCell, actionCell);
    historyList.append(row);
  }
}
historyList.addEventListener("click", event => {
  const button = event.target.closest(".delete-button");
  if (!button) return;
  if (!confirm("Vuoi eliminare questo movimento?")) return;
  const oldRecords = records;
  records = records.filter(record => record.id !== button.dataset.id);
  if (!saveRecords()) { records = oldRecords; return; }
  renderHistory(); renderSummary(); renderCharts();
});

// ==========================================
// RIEPILOGO E CONSUMI
// Ogni rifornimento usa i litri inseriti in quel movimento.
// ==========================================
function getFuelIntervals() {
  const allFuel = records.filter(r => r.type === "fuel")
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
  const selected = new Set(getFilteredRecords().filter(r => r.type === "fuel"));
  const intervals = [];
  for (let i = 1; i < allFuel.length; i++) {
    const previous = allFuel[i - 1], current = allFuel[i];
    if (!selected.has(current)) continue;
    const km = parseNumber(current.odometer) - parseNumber(previous.odometer);
    const liters = parseNumber(current.liters);
    if (Number.isFinite(km) && km > 0 && Number.isFinite(liters) && liters > 0) {
      intervals.push({ date: current.date, value: km / liters, km, liters });
    }
  }
  return intervals;
}
function renderSummary() {
  const periodRecords = getFilteredRecords();
  const fuelRecords = periodRecords.filter(r => r.type === "fuel");
  const expenseRecords = periodRecords.filter(r => r.type === "expense");
  const totalLiters = fuelRecords.reduce((s, r) => s + (parseNumber(r.liters) || 0), 0);
  const fuelCost = fuelRecords.reduce((s, r) => s + (parseNumber(r.totalCost) || 0), 0);
  const expenseCost = expenseRecords.reduce((s, r) => s + (parseNumber(r.totalCost) || 0), 0);
  const intervals = getFuelIntervals();
  const totalKm = intervals.reduce((s, item) => s + item.km, 0);
  const totalConsumptionKm = intervals.reduce((s, item) => s + item.km, 0);
  const totalConsumptionLiters = intervals.reduce((s, item) => s + item.liters, 0);
  const average = totalConsumptionLiters > 0 ? totalConsumptionKm / totalConsumptionLiters : null;

  totalLitersElement.textContent = totalLiters.toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  fuelCostElement.textContent = formatEuro(fuelCost);
  expenseCostElement.textContent = formatEuro(expenseCost);
  $("#total-expenses").textContent = formatEuro(fuelCost + expenseCost);
  totalKmElement.textContent = totalKm.toLocaleString("it-IT", { maximumFractionDigits: 0 });
  avgConsumptionElement.textContent = average === null ? "—" : `${average.toFixed(1)} km/l`;
}

// ==========================================
// GRAFICI
// ==========================================
function drawChart(canvas, drawFunction) {
  if (!canvas) return;
  const width = canvas.clientWidth;
  if (width <= 0) return;
  const height = 280, ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);
  drawFunction(ctx, width, height);
}
function niceStep(maxValue, targetTicks = 5) {
  const rough = maxValue / targetTicks;
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(rough, 1))));
  const normalized = rough / magnitude;
  const nice = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return nice * magnitude;
}
function renderCharts() {
  const consumptionCanvas = $("#consumption-chart");
  const monthlyCanvas = $("#monthly-chart");
  const costCanvas = $("#cost-chart");
  const periodRecords = getFilteredRecords();
  const periodLabel = getPeriodLabel();
  $("#consumption-period").textContent = periodLabel;
  $("#monthly-period").textContent = periodLabel;
  $("#cost-period").textContent = periodLabel;

  const styles = getComputedStyle(document.documentElement);
  const ink = styles.getPropertyValue("--ink").trim() || "#222";
  const muted = styles.getPropertyValue("--muted").trim() || "#888";
  const grid = styles.getPropertyValue("--line").trim() || "#ddd";
  const blue = "#1677ff", orange = "#ff8a24";

  function axes(ctx, width, height, max, step, suffix, left = 48, right = 12, top = 26, bottom = 48) {
    const plotW = width - left - right, plotH = height - top - bottom;
    ctx.font = "11px sans-serif"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
    const count = Math.ceil(max / step);
    for (let i = 0; i <= count; i++) {
      const value = i * step;
      const y = height - bottom - (value / max) * plotH;
      ctx.strokeStyle = grid; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(width - right, y); ctx.stroke();
      ctx.fillStyle = muted;
      ctx.fillText(`${Number(value.toFixed(2)).toLocaleString("it-IT")}${suffix}`, left - 6, y);
    }
    ctx.strokeStyle = grid;
    ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(left, height - bottom); ctx.lineTo(width - right, height - bottom); ctx.stroke();
    return { left, right, top, bottom, plotW, plotH };
  }
  function emptyMessage(ctx, width, height, message) {
    ctx.fillStyle = muted; ctx.font = "13px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(message, width / 2, height / 2);
  }

  // 1) CONSUMO: barre verticali, una per ogni intervallo/rifornimento selezionato.
  const consumption = getFuelIntervals();
  drawChart(consumptionCanvas, (ctx, width, height) => {
    if (!consumption.length) { emptyMessage(ctx, width, height, "Servono almeno due rifornimenti validi"); return; }
    const maxValue = Math.max(1, ...consumption.map(p => p.value));
    const step = niceStep(maxValue, 5), max = Math.ceil(maxValue / step) * step || step;
    const a = axes(ctx, width, height, max, step, "", 48, 12, 28, 54);
    const slot = a.plotW / consumption.length;
    const barW = Math.min(42, slot * 0.62);
    consumption.forEach((point, i) => {
      const barH = point.value / max * a.plotH;
      const x = a.left + i * slot + (slot - barW) / 2;
      const y = height - a.bottom - barH;
      ctx.fillStyle = blue; ctx.fillRect(x, y, barW, barH);
      ctx.fillStyle = ink; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center";
      ctx.fillText(point.value.toFixed(1), x + barW / 2, Math.max(12, y - 9));
      ctx.fillStyle = muted; ctx.font = "10px sans-serif";
      const label = point.date ? point.date.slice(5).replace("-", "/") : "";
      ctx.save(); ctx.translate(x + barW / 2, height - 12); ctx.rotate(-Math.PI / 5);
      ctx.textAlign = "right"; ctx.fillText(label, 0, 0); ctx.restore();
    });
    ctx.fillStyle = ink; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "left";
    ctx.fillText("Consumo (km/l)", 48, 13);
  });

  // 2) SPESE: mese = giorni del mese; anno/da sempre = mesi reali.
  const buckets = new Map();
  function addBucket(key, label) {
    if (!buckets.has(key)) buckets.set(key, { label, fuel: 0, expense: 0 });
    return buckets.get(key);
  }
  periodRecords.forEach(record => {
    if (!validDate(record.date)) return;
    const [y, m, d] = record.date.split("-");
    let key, label;
    if (filterPeriod.value === "month") { key = `${y}-${m}-${d}`; label = `${d}/${m}`; }
    else { key = `${y}-${m}`; label = `${m}/${y}`; }
    const bucket = addBucket(key, label);
    if (record.type === "fuel") bucket.fuel += parseNumber(record.totalCost) || 0;
    if (record.type === "expense") bucket.expense += parseNumber(record.totalCost) || 0;
  });
  const spendEntries = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  // Da sempre mostra tutti i mesi disponibili; per mese mostra i giorni,
  // per anno mostra tutti i mesi dell'anno selezionato.
  const visibleEntries = spendEntries;
  drawChart(monthlyCanvas, (ctx, width, height) => {
    if (!visibleEntries.length) { emptyMessage(ctx, width, height, "Nessuna spesa nel periodo selezionato"); return; }
    const totals = visibleEntries.map(([, v]) => v.fuel + v.expense);
    const maxValue = Math.max(10, ...totals);
    const step = Math.max(10, Math.ceil(niceStep(maxValue, 5) / 10) * 10);
    const max = Math.max(step, Math.ceil(maxValue / step) * step);
    const a = axes(ctx, width, height, max, step, " €", 54, 10, 32, 55);
    const slot = a.plotW / visibleEntries.length, barW = Math.min(38, slot * 0.65);
    visibleEntries.forEach(([key, values], i) => {
      const x = a.left + i * slot + (slot - barW) / 2;
      const base = height - a.bottom;
      const fuelH = values.fuel / max * a.plotH;
      const otherH = values.expense / max * a.plotH;
      ctx.fillStyle = blue; ctx.fillRect(x, base - fuelH, barW, fuelH);
      ctx.fillStyle = orange; ctx.fillRect(x, base - fuelH - otherH, barW, otherH);
      // Mantiene tutte le barre, ma dirada le etichette se il periodo è lungo.
      const labelEvery = Math.max(1, Math.ceil(visibleEntries.length / 8));
      if (i % labelEvery === 0 || i === visibleEntries.length - 1) {
        ctx.fillStyle = muted; ctx.font = "10px sans-serif"; ctx.textAlign = "center";
        const label = values.label;
        ctx.save();
        if (visibleEntries.length > 7) {
          ctx.translate(x + barW / 2, height - 10); ctx.rotate(-Math.PI / 4);
          ctx.textAlign = "right"; ctx.fillText(label, 0, 0);
        } else {
          ctx.fillText(label, x + barW / 2, height - 28);
        }
        ctx.restore();
      }
    });
    // Legenda in grassetto
    ctx.font = "bold 11px sans-serif"; ctx.textAlign = "left";
    ctx.fillStyle = blue; ctx.fillText("■ Carburante", 56, 15);
    ctx.fillStyle = orange; ctx.fillText("■ Altre spese", 158, 15);
  });

  // 3) DISTRIBUZIONE COSTI
  const fuelTotal = periodRecords.filter(r => r.type === "fuel").reduce((s, r) => s + (parseNumber(r.totalCost) || 0), 0);
  const expenseTotal = periodRecords.filter(r => r.type === "expense").reduce((s, r) => s + (parseNumber(r.totalCost) || 0), 0);
  drawChart(costCanvas, (ctx, width, height) => {
    const total = fuelTotal + expenseTotal;
    if (total <= 0) { emptyMessage(ctx, width, height, "Nessun costo nel periodo selezionato"); return; }
    const cx = width / 2, cy = 112, radius = 72;
    let angle = -Math.PI / 2;
    [{ label: "Carburante", value: fuelTotal, color: blue }, { label: "Altre spese", value: expenseTotal, color: orange }].forEach(item => {
      if (item.value <= 0) return;
      const slice = item.value / total * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, radius, angle, angle + slice); ctx.closePath();
      ctx.fillStyle = item.color; ctx.fill(); angle += slice;
    });
    ctx.fillStyle = ink; ctx.font = "bold 14px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(formatEuro(total), cx, cy + 5);
    ctx.font = "bold 11px sans-serif";
    ctx.fillStyle = blue;
    ctx.fillText(`Carburante: ${formatEuro(fuelTotal)} (${(fuelTotal / total * 100).toFixed(1)}%)`, cx, 215);
    ctx.fillStyle = orange;
    ctx.fillText(`Altre spese: ${formatEuro(expenseTotal)} (${(expenseTotal / total * 100).toFixed(1)}%)`, cx, 237);
  });
}

// ==========================================
// MODULO, TEMA E NAVIGAZIONE
// ==========================================
function updateRecordFields() {
  const isFuel = recordType.value === "fuel";
  fuelFields.hidden = !isFuel;
  expenseFields.hidden = isFuel;
  fuelFields.querySelectorAll("input, select, textarea").forEach(field => { field.disabled = !isFuel; });
  expenseFields.querySelectorAll("input, select, textarea").forEach(field => { field.disabled = isFuel; });
}
recordType.addEventListener("change", updateRecordFields);

function applyTheme(theme) {
  const dark = theme === "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  themeToggleIcon.textContent = dark ? "☀" : "☾";
  themeToggleLabel.textContent = dark ? "Chiaro" : "Scuro";
  try { localStorage.setItem(THEME_STORAGE_KEY, theme); }
  catch (error) { console.warn("Impossibile salvare il tema", error); }
}
themeToggle.addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

function activateTab(tab) {
  registerPanel.hidden = true; storicoPanel.hidden = true; chartsPanel.hidden = true;
  registerTab.classList.remove("is-active"); storicoTab.classList.remove("is-active"); chartsTab.classList.remove("is-active");
  tab.classList.add("is-active");
  if (tab === registerTab) registerPanel.hidden = false;
  if (tab === storicoTab) storicoPanel.hidden = false;
  if (tab === chartsTab) { chartsPanel.hidden = false; renderCharts(); }
}
registerTab.addEventListener("click", () => activateTab(registerTab));
storicoTab.addEventListener("click", () => activateTab(storicoTab));
chartsTab.addEventListener("click", () => activateTab(chartsTab));

// ==========================================
// SALVATAGGIO MOVIMENTI
// ==========================================
entryForm.addEventListener("submit", event => {
  event.preventDefault();
  if (!storageHealthy) { alert("Archivio non disponibile: impossibile salvare."); return; }
  let record;
  if (recordType.value === "fuel") {
    const liters = parseNumber(fuelLiters.value);
    const cost = parseNumber(fuelCostInput.value);
    const odometer = parseNumber(fuelOdometer.value);
    if (!validDate(fuelDate.value)) { alert("Inserisci una data valida."); return; }
    if (!Number.isFinite(odometer) || odometer < 0) { alert("Inserisci un chilometraggio valido."); return; }
    if (!Number.isFinite(liters) || liters <= 0) { alert("Inserisci una quantità di litri valida."); return; }
    if (!Number.isFinite(cost) || cost <= 0) { alert("Inserisci un costo valido."); return; }
    record = {
      id: makeId(), type: "fuel", date: fuelDate.value, odometer,
      fuelType: fuelType.value, liters, totalCost: cost,
      station: fuelStation.value.trim(), note: fuelNote.value.trim()
    };
  } else {
    const cost = parseNumber(expenseCostInput.value);
    if (!validDate(expenseDate.value)) { alert("Inserisci una data valida."); return; }
    if (!Number.isFinite(cost) || cost <= 0) { alert("Inserisci un costo valido."); return; }
    record = {
      id: makeId(), type: "expense", date: expenseDate.value,
      category: expenseCategory.value, totalCost: cost,
      vendor: expenseVendor.value.trim(), note: expenseNote.value.trim()
    };
  }
  records.push(record);
  if (!saveRecords()) { records.pop(); return; }
  renderHistory(); renderSummary(); renderCharts();
  entryForm.reset(); updateRecordFields();
  alert("Movimento salvato correttamente!");
});

// ==========================================
// AVVIO APP
// ==========================================
try {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  applyTheme(savedTheme === "dark" ? "dark" : "light");
} catch (error) { applyTheme("light"); }

records = loadRecords();
activateTab(registerTab);
updateRecordFields();
renderHistory();
renderSummary();
renderCharts();

if ("serviceWorker" in navigator) {
  let refreshing = false;
  navigator.serviceWorker.register("./service-worker.js")
    .then(registration => {
      registration.update();
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") registration.update();
      });
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!refreshing) { refreshing = true; window.location.reload(); }
      });
    })
    .catch(error => console.error("Errore aggiornamento MyPit:", error));
}
