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
  renderHistory();
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
  const sorted = [...getFilteredRecords()].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  for (const record of sorted) {
    const row = document.createElement("tr");
    const dateCell = document.createElement("td"); dateCell.textContent = record.date || "—";
    const typeCell = document.createElement("td"); typeCell.textContent = record.type === "fuel" ? "Rifornimento" : "Spesa";
    const detailCell = document.createElement("td");
    detailCell.textContent = record.type === "fuel" ? `${record.fuelType || "Carburante"} · ${Number(record.liters || 0).toLocaleString("it-IT")} L` : (record.category || "Spesa");
    const costCell = document.createElement("td"); costCell.textContent = formatEuro(record.totalCost);
    const actionCell = document.createElement("td");
    const deleteButton = document.createElement("button"); deleteButton.type = "button"; deleteButton.className = "delete-button"; deleteButton.dataset.id = record.id; deleteButton.textContent = "Elimina";
    actionCell.append(deleteButton); row.append(dateCell, typeCell, detailCell, costCell, actionCell); historyList.append(row);
  }
  if (!sorted.length) { const row = document.createElement("tr"); const cell = document.createElement("td"); cell.colSpan = 5; cell.textContent = "Nessun movimento nel periodo selezionato."; row.append(cell); historyList.append(row); }
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
  const periodRecords = getFilteredRecords();
  const periodLabel = getPeriodLabel();
  ["consumption-period", "trend-period", "monthly-period", "cost-period"].forEach(id => { const el = $("#" + id); if (el) el.textContent = periodLabel; });
  const styles = getComputedStyle(document.documentElement);
  const ink = styles.getPropertyValue("--ink").trim() || "#222";
  const muted = styles.getPropertyValue("--muted").trim() || "#888";
  const grid = styles.getPropertyValue("--line").trim() || "#ddd";
  const blue = "#1677ff", orange = "#ff8a24", green = "#18a66a", purple = "#8b5cf6";
  function canvasSetup(id, draw) {
    const canvas = $("#" + id); if (!canvas) return;
    const width = canvas.clientWidth; if (width <= 0) return;
    const height = 280, ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); canvas.style.height = height + "px";
    const ctx = canvas.getContext("2d"); ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.clearRect(0, 0, width, height);
    draw(ctx, width, height);
  }
  function empty(ctx, w, h, msg) { ctx.fillStyle = muted; ctx.font = "13px sans-serif"; ctx.textAlign = "center"; ctx.fillText(msg, w/2, h/2); }
  function axis(ctx,w,h,max,step,suffix="",left=48,bottom=62) {
    const top=25,right=12,pw=w-left-right,ph=h-top-bottom; ctx.font="11px sans-serif";ctx.textAlign="right";ctx.textBaseline="middle";
    for(let v=0;v<=max+step/2;v+=step){const y=h-bottom-(v/max)*ph;ctx.strokeStyle=grid;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke();ctx.fillStyle=muted;ctx.fillText(`${Number(v.toFixed(2)).toLocaleString("it-IT")}${suffix}`,left-6,y);}
    ctx.strokeStyle=grid;ctx.beginPath();ctx.moveTo(left,top);ctx.lineTo(left,h-bottom);ctx.lineTo(w-right,h-bottom);ctx.stroke();return {left,top,right,bottom,pw,ph};
  }
  function stepFor(max, target=5) { const raw=Math.max(max/target,0.1); const mag=Math.pow(10,Math.floor(Math.log10(raw))); const n=raw/mag; return (n<=1?1:n<=2?2:n<=5?5:10)*mag; }
  function bucketKey(date) { if(filterPeriod.value==="month") return String(date).slice(0,7); if(filterPeriod.value==="year") return String(date).slice(0,7); return String(date).slice(0,4); }
  function bucketLabel(key) { if(filterPeriod.value==="month") return periodLabel; if(filterPeriod.value==="year") { const [y,m]=key.split("-"); return new Date(+y,+m-1,1).toLocaleDateString("it-IT",{month:"short"}); } return key; }
  // Consumi aggregati per periodo: km totali / litri totali, non media semplice dei rifornimenti.
  const allFuel=records.filter(r=>r.type==="fuel").sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const selectedFuel=new Set(periodRecords.filter(r=>r.type==="fuel"));
  const consumptionBuckets=new Map();
  for(let i=1;i<allFuel.length;i++){
    const prev=allFuel[i-1],cur=allFuel[i]; if(!selectedFuel.has(cur)) continue;
    const km=parseNumber(cur.odometer)-parseNumber(prev.odometer), liters=parseNumber(cur.liters);
    if(!(km>0&&liters>0)) continue;
    const key=bucketKey(cur.date); if(!consumptionBuckets.has(key))consumptionBuckets.set(key,{km:0,liters:0});
    const b=consumptionBuckets.get(key);b.km+=km;b.liters+=liters;
  }
  let consumptionData=[...consumptionBuckets.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([key,v])=>({key,label:bucketLabel(key),value:v.km/v.liters,km:v.km,liters:v.liters}));
  if(filterPeriod.value==="month" && consumptionData.length){const total=consumptionData.reduce((a,x)=>({km:a.km+x.km,liters:a.liters+x.liters}),{km:0,liters:0});consumptionData=[{key:filterMonth.value,label:periodLabel,value:total.km/total.liters,...total}];}
  canvasSetup("consumption-chart",(ctx,w,h)=>{
    if(!consumptionData.length){empty(ctx,w,h,"Servono almeno due rifornimenti validi");return;}
    const val=consumptionData.length===1?consumptionData[0].value:consumptionData.reduce((a,x)=>a+x.km,0)/consumptionData.reduce((a,x)=>a+x.liters,0);
    const max=Math.max(1,Math.ceil(val/2)*2),step=Math.max(1,Math.ceil(max/5));const a=axis(ctx,w,h,max,step," km/l",50,58);
    const barW=Math.min(70,a.pw*.35),x=a.left+(a.pw-barW)/2,bh=val/max*a.ph,y=h-a.bottom-bh;ctx.fillStyle=blue;ctx.fillRect(x,y,barW,bh);
    ctx.fillStyle=ink;ctx.font="bold 13px sans-serif";ctx.textAlign="center";ctx.fillText(val.toFixed(2)+" km/l",w/2,Math.max(15,y-10));ctx.fillStyle=muted;ctx.font="11px sans-serif";ctx.fillText(periodLabel,w/2,h-23);
    ctx.font="bold 11px sans-serif";ctx.fillStyle=blue;ctx.fillText("■ Consumo medio",w/2,h-5);
  });
  // Andamento: una misura per mese (se anno selezionato), per anno (da sempre), o una sola per mese.
  canvasSetup("trend-chart",(ctx,w,h)=>{
    if(!consumptionData.length){empty(ctx,w,h,"Dati insufficienti per il periodo");return;}
    const max=Math.max(1,...consumptionData.map(x=>x.value));const top=25,bottom=58,left=48,right=12,pw=w-left-right,ph=h-top-bottom,step=stepFor(max,5);
    const cap=Math.ceil(max/step)*step;ctx.font="11px sans-serif";ctx.textAlign="right";ctx.textBaseline="middle";
    for(let v=0;v<=cap+step/2;v+=step){const y=h-bottom-v/cap*ph;ctx.strokeStyle=grid;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke();ctx.fillStyle=muted;ctx.fillText(v.toFixed(1),left-6,y);}
    const pts=consumptionData.map((d,i)=>({x:consumptionData.length===1?left+pw/2:left+i*pw/(consumptionData.length-1),y:h-bottom-d.value/cap*ph,d}));
    ctx.strokeStyle=green;ctx.lineWidth=3;ctx.beginPath();pts.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
    pts.forEach(p=>{ctx.fillStyle=green;ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fill();ctx.fillStyle=ink;ctx.font="bold 10px sans-serif";ctx.textAlign="center";ctx.fillText(p.d.value.toFixed(1),p.x,p.y-12);ctx.fillStyle=muted;ctx.font="10px sans-serif";ctx.fillText(p.d.label,p.x,h-25);});
    ctx.fillStyle=green;ctx.font="bold 11px sans-serif";ctx.textAlign="center";ctx.fillText("— Consumo medio (km/l)",w/2,h-5);
  });
  // Spese aggregate: mese = una barra; anno = barre mensili; da sempre = barre annuali.
  const spendBuckets=new Map();
  periodRecords.forEach(r=>{if(!validDate(r.date))return;const key=bucketKey(r.date);if(!spendBuckets.has(key))spendBuckets.set(key,{fuel:0,other:0,label:bucketLabel(key)});const b=spendBuckets.get(key);if(r.type==="fuel")b.fuel+=parseNumber(r.totalCost)||0;else b.other+=parseNumber(r.totalCost)||0;});
  const spendData=[...spendBuckets.entries()].sort((a,b)=>a[0].localeCompare(b[0]));
  canvasSetup("monthly-chart",(ctx,w,h)=>{
    if(!spendData.length){empty(ctx,w,h,"Nessuna spesa nel periodo selezionato");return;}
    const maxVal=Math.max(10,...spendData.map(([,v])=>v.fuel+v.other));const step=Math.max(10,Math.ceil(stepFor(maxVal,5)/10)*10),max=Math.ceil(maxVal/step)*step;const a=axis(ctx,w,h,max,step," €",55,70);const slot=a.pw/spendData.length,bw=Math.min(46,slot*.55);
    spendData.forEach(([key,v],i)=>{const x=a.left+i*slot+(slot-bw)/2,base=h-a.bottom,fh=v.fuel/max*a.ph,oh=v.other/max*a.ph;ctx.fillStyle=blue;ctx.fillRect(x,base-fh,bw,fh);ctx.fillStyle=orange;ctx.fillRect(x,base-fh-oh,bw,oh);ctx.fillStyle=muted;ctx.font="10px sans-serif";ctx.textAlign="center";ctx.fillText(v.label,x+bw/2,h-48);ctx.fillStyle=ink;ctx.font="bold 10px sans-serif";ctx.fillText(formatEuro(v.fuel+v.other),x+bw/2,Math.max(14,base-fh-oh-8));});
    ctx.font="bold 11px sans-serif";ctx.textAlign="center";ctx.fillStyle=blue;ctx.fillText("■ Carburante",w/2-58,h-12);ctx.fillStyle=orange;ctx.fillText("■ Altre spese",w/2+65,h-12);
  });
  // Distribuzione spese: carburante + categorie effettive delle altre spese.
  const categories=new Map();
  periodRecords.forEach(r=>{const amount=parseNumber(r.totalCost)||0;if(amount<=0)return;const name=r.type==="fuel"?"Carburante":(r.category||"Altre spese");categories.set(name,(categories.get(name)||0)+amount);});
  const palette=[blue,orange,green,purple,"#d946ef","#0891b2","#ca8a04","#64748b"];
  canvasSetup("cost-chart",(ctx,w,h)=>{
    const items=[...categories.entries()].sort((a,b)=>b[1]-a[1]);const total=items.reduce((a,x)=>a+x[1],0);if(total<=0){empty(ctx,w,h,"Nessun costo nel periodo selezionato");return;}
    const cx=w/2,cy=105,r=68;let angle=-Math.PI/2;items.forEach(([name,value],i)=>{const slice=value/total*Math.PI*2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,angle,angle+slice);ctx.closePath();ctx.fillStyle=palette[i%palette.length];ctx.fill();angle+=slice;});
    ctx.fillStyle=ink;ctx.font="bold 14px sans-serif";ctx.textAlign="center";ctx.fillText(formatEuro(total),cx,cy+5);
    let y=195;items.slice(0,5).forEach(([name,value],i)=>{ctx.fillStyle=palette[i%palette.length];ctx.fillRect(18,y-9,10,10);ctx.fillStyle=ink;ctx.font="bold 10px sans-serif";ctx.textAlign="left";const pct=(value/total*100).toFixed(1);ctx.fillText(`${name}: ${formatEuro(value)} (${pct}%)`,34,y);y+=17;});
    if(items.length>5){ctx.fillStyle=muted;ctx.font="10px sans-serif";ctx.fillText(`+ ${items.length-5} altre categorie`,34,y);}
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
  const filterControl = $("#period-filter-control");
  const targetSlot = tab === registerTab ? $("#period-filter-slot-registro") : tab === storicoTab ? $("#period-filter-slot-storico") : $("#period-filter-slot-grafici");
  if (filterControl && targetSlot) targetSlot.append(filterControl);
  registerPanel.hidden = true; storicoPanel.hidden = true; chartsPanel.hidden = true;
  registerTab.classList.remove("is-active"); storicoTab.classList.remove("is-active"); chartsTab.classList.remove("is-active");
  tab.classList.add("is-active");
  if (tab === registerTab) registerPanel.hidden = false;
  if (tab === storicoTab) { storicoPanel.hidden = false; renderHistory(); }
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
window.addEventListener("resize", () => { if (!chartsPanel.hidden) renderCharts(); });

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
