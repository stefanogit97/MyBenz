"use strict";
const STORAGE_KEY="mypit.records.v1", THEME_STORAGE_KEY="mypit.theme.v1";
let records=[], storageHealthy=true;
const $=s=>document.querySelector(s);
const filterPeriod=$("#filter-period"),filterMonth=$("#filter-month"),filterYear=$("#filter-year");
const today=new Date(); filterMonth.value=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`;filterYear.value=today.getFullYear();
const parseNumber=v=>{if(typeof v==="number")return v;const n=String(v??"").trim().replace(/\s/g,"").replace(",",".");return n===""?NaN:Number(n)};
const euro=v=>"€ "+(Number(v)||0).toLocaleString("it-IT",{minimumFractionDigits:2,maximumFractionDigits:2});
const id=()=>crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`;
const validDate=v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v));
function load(){try{const v=JSON.parse(localStorage.getItem(STORAGE_KEY)||"[]");if(!Array.isArray(v))throw Error("Archivio non valido");return v}catch(e){storageHealthy=false;alert("Non riesco a leggere l'archivio: i dati originali non verranno sovrascritti.");return[]}}
function save(){if(!storageHealthy){alert("Salvataggio bloccato per proteggere i dati.");return false}try{localStorage.setItem(STORAGE_KEY,JSON.stringify(records));return true}catch(e){alert("Errore di salvataggio: controlla lo spazio disponibile.");return false}}
function filtered(){if(filterPeriod.value==="month")return records.filter(r=>String(r.date||"").slice(0,7)===filterMonth.value);if(filterPeriod.value==="year")return records.filter(r=>String(r.date||"").slice(0,4)===String(filterYear.value));return records}
function periodLabel(){if(filterPeriod.value==="month"&&filterMonth.value){const[y,m]=filterMonth.value.split("-");return new Date(+y,+m-1,1).toLocaleDateString("it-IT",{month:"long",year:"numeric"})}return filterPeriod.value==="year"?`Anno ${filterYear.value}`:"Tutto lo storico"}
function intervals(){const all=records.filter(r=>r.type==="fuel").sort((a,b)=>String(a.date).localeCompare(String(b.date)));const chosen=new Set(filtered().filter(r=>r.type==="fuel"));const out=[];for(let i=1;i<all.length;i++){const p=all[i-1],c=all[i];if(!chosen.has(c))continue;const km=parseNumber(c.odometer)-parseNumber(p.odometer),lit=parseNumber(c.liters);if(km>0&&lit>0)out.push({date:c.date,km,liters:lit,value:km/lit})}return out}
function summary(){const rs=filtered(),fu=rs.filter(r=>r.type==="fuel"),ex=rs.filter(r=>r.type==="expense"),its=intervals();const liters=fu.reduce((s,r)=>s+(parseNumber(r.liters)||0),0),fc=fu.reduce((s,r)=>s+(parseNumber(r.totalCost)||0),0),ec=ex.reduce((s,r)=>s+(parseNumber(r.totalCost)||0),0),km=its.reduce((s,x)=>s+x.km,0),il=its.reduce((s,x)=>s+x.liters,0);$("#total-liters").textContent=liters.toLocaleString("it-IT",{minimumFractionDigits:1,maximumFractionDigits:1});$("#total-km").textContent=km.toLocaleString("it-IT",{maximumFractionDigits:0});$("#avg-consumption").textContent=il?`${(km/il).toFixed(1)} km/l`:"—";$("#fuel-cost").textContent=euro(fc);$("#expense-cost").textContent=euro(ec);$("#total-expenses").textContent=euro(fc+ec)}
function history(){const body=$("#history-list");body.replaceChildren();const rs=[...filtered()].sort((a,b)=>String(b.date).localeCompare(String(a.date)));for(const r of rs){const tr=document.createElement("tr");const vals=[r.date||"—",r.type==="fuel"?"Rifornimento":"Spesa",r.type==="fuel"?`${r.fuelType||"Carburante"} · ${Number(r.liters||0).toLocaleString("it-IT")} L${r.station?" · "+r.station:""}`:(r.category||"Spesa"),euro(r.totalCost)];vals.forEach(v=>{const td=document.createElement("td");td.textContent=v;tr.append(td)});const td=document.createElement("td"),b=document.createElement("button");b.className="delete-button";b.textContent="Elimina";b.dataset.id=r.id;td.append(b);tr.append(td);body.append(tr)}if(!rs.length){const tr=document.createElement("tr"),td=document.createElement("td");td.colSpan=5;td.textContent="Nessun movimento nel periodo selezionato.";tr.append(td);body.append(tr)}}
function chart(canvas,draw){const c=$("#"+canvas),w=c.clientWidth;if(!w)return;const h=280,d=window.devicePixelRatio||1;c.width=w*d;c.height=h*d;c.style.height=h+"px";const x=c.getContext("2d");x.setTransform(d,0,0,d,0,0);x.clearRect(0,0,w,h);draw(x,w,h)}
function charts(){const rs=filtered(),its=intervals(),label=periodLabel();["consumption-period","trend-period","monthly-period","cost-period"].forEach(k=>$("#"+k).textContent=label);const css=getComputedStyle(document.documentElement),ink=css.getPropertyValue("--ink").trim(),muted=css.getPropertyValue("--muted").trim(),grid=css.getPropertyValue("--line").trim(),blue="#1677ff",orange="#ff8a24",green="#18a66a",purple="#8b5cf6";
const bucket=d=>filterPeriod.value==="all"?String(d).slice(0,4):filterPeriod.value==="year"?String(d).slice(0,7):String(d).slice(0,7);
const labelFor=k=>filterPeriod.value==="all"?k:filterPeriod.value==="year"?new Date(+k.slice(0,4),+k.slice(5,7)-1,1).toLocaleDateString("it-IT",{month:"short"}):label;
const cons=new Map();its.forEach(x=>{const k=bucket(x.date),v=cons.get(k)||{km:0,l:0};v.km+=x.km;v.l+=x.liters;cons.set(k,v)});const cd=[...cons].sort((a,b)=>a[0].localeCompare(b[0])).map(([k,v])=>({label:labelFor(k),value:v.km/v.l,km:v.km,l:v.l}));
function empty(ctx,w,h,msg){ctx.fillStyle=muted;ctx.textAlign="center";ctx.font="13px sans-serif";ctx.fillText(msg,w/2,h/2)}
function axis(ctx,w,h,max,step,suffix=""){const L=48,R=12,T=20,B=52,pw=w-L-R,ph=h-T-B;ctx.font="11px sans-serif";ctx.textAlign="right";for(let v=0;v<=max+step/2;v+=step){const y=h-B-v/max*ph;ctx.strokeStyle=grid;ctx.beginPath();ctx.moveTo(L,y);ctx.lineTo(w-R,y);ctx.stroke();ctx.fillStyle=muted;ctx.fillText(`${v.toLocaleString("it-IT")}${suffix}`,L-6,y)}return{L,R,T,B,pw,ph}}
chart("consumption-chart",(c,w,h)=>{if(!cd.length){empty(c,w,h,"Servono almeno due rifornimenti validi");return}const km=cd.reduce((s,x)=>s+x.km,0),l=cd.reduce((s,x)=>s+x.l,0),v=km/l,max=Math.max(5,Math.ceil(v/5)*5),st=Math.max(1,Math.ceil(max/5)),a=axis(c,w,h,max,st," km/l"),bw=Math.min(76,a.pw*.4),bh=v/max*a.ph,x=a.L+(a.pw-bw)/2,y=h-a.B-bh;c.fillStyle=blue;c.fillRect(x,y,bw,bh);c.fillStyle=ink;c.font="bold 14px sans-serif";c.textAlign="center";c.fillText(v.toFixed(2)+" km/l",w/2,Math.max(14,y-9));c.fillStyle=muted;c.font="11px sans-serif";c.fillText(label,w/2,h-25);c.fillStyle=blue;c.font="bold 11px sans-serif";c.fillText("■ Consumo medio",w/2,h-6)});
chart("trend-chart",(c,w,h)=>{if(!cd.length){empty(c,w,h,"Dati insufficienti nel periodo");return}const max=Math.max(5,Math.ceil(Math.max(...cd.map(x=>x.value))/5)*5),st=Math.max(1,Math.ceil(max/5)),a=axis(c,w,h,max,st," km/l"),pts=cd.map((v,i)=>({x:cd.length===1?a.L+a.pw/2:a.L+i*a.pw/(cd.length-1),y:h-a.B-v.value/max*a.ph,v}));c.strokeStyle=green;c.lineWidth=3;c.beginPath();pts.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.stroke();pts.forEach(p=>{c.fillStyle=green;c.beginPath();c.arc(p.x,p.y,4,0,Math.PI*2);c.fill();c.fillStyle=ink;c.font="bold 10px sans-serif";c.textAlign="center";c.fillText(p.v.value.toFixed(1),p.x,p.y-11);c.fillStyle=muted;c.fillText(p.v.label,p.x,h-25)})});
const spend=new Map();rs.forEach(r=>{if(!validDate(r.date))return;const k=bucket(r.date),v=spend.get(k)||{fuel:0,other:0,label:labelFor(k)};if(r.type==="fuel")v.fuel+=parseNumber(r.totalCost)||0;else v.other+=parseNumber(r.totalCost)||0;spend.set(k,v)});const sd=[...spend].sort((a,b)=>a[0].localeCompare(b[0]));
chart("monthly-chart",(c,w,h)=>{if(!sd.length){empty(c,w,h,"Nessuna spesa nel periodo");return}const maxv=Math.max(10,...sd.map(([,v])=>v.fuel+v.other)),step=Math.max(10,Math.ceil(maxv/5/10)*10),max=Math.ceil(maxv/step)*step,a=axis(c,w,h,max,step," €"),slot=a.pw/sd.length,bw=Math.min(48,slot*.55);sd.forEach(([k,v],i)=>{const x=a.L+i*slot+(slot-bw)/2,base=h-a.B,fh=v.fuel/max*a.ph,oh=v.other/max*a.ph;c.fillStyle=blue;c.fillRect(x,base-fh,bw,fh);c.fillStyle=orange;c.fillRect(x,base-fh-oh,bw,oh);c.fillStyle=muted;c.font="10px sans-serif";c.textAlign="center";c.fillText(v.label,x+bw/2,h-29)});c.font="bold 11px sans-serif";c.textAlign="center";c.fillStyle=blue;c.fillText("■ Carburante",w/2-60,h-7);c.fillStyle=orange;c.fillText("■ Altre spese",w/2+65,h-7)});
const cats=new Map();rs.forEach(r=>{const n=r.type==="fuel"?"Carburante":r.category||"Altre spese",v=parseNumber(r.totalCost)||0;if(v>0)cats.set(n,(cats.get(n)||0)+v)});const palette=[blue,orange,green,purple,"#d946ef","#0891b2","#ca8a04","#64748b"];
chart("cost-chart",(c,w,h)=>{const items=[...cats].sort((a,b)=>b[1]-a[1]),total=items.reduce((s,x)=>s+x[1],0);if(!total){empty(c,w,h,"Nessuna spesa nel periodo");return}const cx=w/2,cy=105,r=66;let a=-Math.PI/2;items.forEach(([n,v],i)=>{const sl=v/total*Math.PI*2;c.beginPath();c.moveTo(cx,cy);c.arc(cx,cy,r,a,a+sl);c.closePath();c.fillStyle=palette[i%palette.length];c.fill();a+=sl});c.fillStyle=ink;c.font="bold 14px sans-serif";c.textAlign="center";c.fillText(euro(total),cx,cy+5);let y=190;items.slice(0,5).forEach(([n,v],i)=>{c.fillStyle=palette[i%palette.length];c.fillRect(15,y-9,10,10);c.fillStyle=ink;c.font="bold 10px sans-serif";c.textAlign="left";c.fillText(`${n}: ${euro(v)} (${(v/total*100).toFixed(1)}%)`,30,y);y+=17});if(items.length>5){c.fillStyle=muted;c.fillText(`+ ${items.length-5} altre categorie`,30,y)}})}
function refresh(){filterMonth.hidden=filterPeriod.value!=="month";filterYear.hidden=filterPeriod.value!=="year";summary();history();charts()}
[filterPeriod,filterMonth,filterYear].forEach(el=>el.addEventListener("change",refresh));
$("#history-list").addEventListener("click",e=>{const b=e.target.closest(".delete-button");if(!b||!confirm("Vuoi eliminare questo movimento?"))return;const old=records;records=records.filter(r=>r.id!==b.dataset.id);if(!save())records=old;refresh()});
const form=$("#entry-form"),type=$("#record-type");
function updateFields(){const fuel=type.value==="fuel";$("#fuel-fields").hidden=!fuel;$("#expense-fields").hidden=fuel;$("#fuel-fields").querySelectorAll("input,select").forEach(x=>x.disabled=!fuel);$("#expense-fields").querySelectorAll("input,select").forEach(x=>x.disabled=fuel)}
type.addEventListener("change",updateFields);
form.addEventListener("submit",e=>{e.preventDefault();if(!storageHealthy)return alert("Archivio non disponibile.");let r;if(type.value==="fuel"){const liters=parseNumber($("#fuel-liters").value),cost=parseNumber($("#fuel-cost-input").value),odo=parseNumber($("#fuel-odometer").value),date=$("#fuel-date").value;if(!validDate(date)||!Number.isFinite(odo)||odo<0||!Number.isFinite(liters)||liters<=0||!Number.isFinite(cost)||cost<=0)return alert("Controlla data, chilometraggio, litri e costo.");r={id:id(),type:"fuel",date,odometer:odo,fuelType:$("#fuel-type").value,liters,totalCost:cost,station:$("#fuel-station").value.trim(),note:$("#fuel-note").value.trim()}}else{const date=$("#expense-date").value,cost=parseNumber($("#expense-cost-input").value);if(!validDate(date)||!Number.isFinite(cost)||cost<=0)return alert("Controlla data e costo.");r={id:id(),type:"expense",date,category:$("#expense-category").value,totalCost:cost,vendor:$("#expense-vendor").value.trim(),note:$("#expense-note").value.trim()}}records.push(r);if(!save()){records.pop();return}form.reset();updateFields();refresh();alert("Movimento salvato correttamente!")});
function download(name,blob){const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function csvCell(v){return '"'+String(v??"").replace(/"/g,'""')+'"'}
$("#export-csv").addEventListener("click",()=>{const rows=[["Data","Tipo","Dettaglio","Chilometraggio km","Litri","Costo euro","Distributore/Fornitore","Note"],...filtered().map(r=>[r.date,r.type==="fuel"?"Rifornimento":"Spesa",r.type==="fuel"?r.fuelType:r.category,r.odometer??"",r.liters??"",r.totalCost,r.station||r.vendor||"",r.note||""])];download("mypit-movimenti.csv",new Blob(["\\ufeff"+rows.map(row=>row.map(csvCell).join(";")).join("\\r\\n")],{type:"text/csv;charset=utf-8"}))});
$("#export-pdf").addEventListener("click", () => {

  const { jsPDF } = window.jspdf;

  const pdf = new jsPDF();

  const rows = filtered()
    .slice()
    .sort((a, b) =>
      String(a.date).localeCompare(String(b.date))
    );

  pdf.setFontSize(18);
  pdf.text("MyPit - Pieni e Spese", 14, 18);

  pdf.setFontSize(11);
  pdf.text(
    `Periodo: ${periodLabel()}`,
    14,
    26
  );

  pdf.autoTable({
    startY: 34,

    head: [[
      "Data",
      "Tipo",
      "Dettaglio",
      "Km",
      "Litri",
      "Costo"
    ]],

    body: rows.map(r => [

      r.date || "",

      r.type === "fuel"
        ? "Rifornimento"
        : "Spesa",

      r.type === "fuel"
        ? r.fuelType || ""
        : r.category || "",

      r.odometer ?? "",

      r.liters ?? "",

      euro(r.totalCost)

    ])
  });

  const blob = pdf.output("blob");
const url = URL.createObjectURL(blob);

window.open(url, "_blank");

setTimeout(() => {
  URL.revokeObjectURL(url);
}, 60000);

});
$("#export-backup").addEventListener("click",()=>download(`mypit-backup-${new Date().toISOString().slice(0,10)}.json`,new Blob([JSON.stringify({app:"MyPit",version:1,exportedAt:new Date().toISOString(),records},null,2)],{type:"application/json"})));
$("#import-backup").addEventListener("click",()=>$("#backup-file").click());
$("#backup-file").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{const data=JSON.parse(await file.text()),incoming=Array.isArray(data)?data:data.records;if(!Array.isArray(incoming))throw Error("Formato backup non riconosciuto");if(!incoming.every(r=>r&&typeof r==="object"&&(r.type==="fuel"||r.type==="expense")&&validDate(r.date)))throw Error("Il backup contiene movimenti non validi");if(!confirm(`Importare ${incoming.length} movimenti? I dati attuali saranno mantenuti; i duplicati con lo stesso ID saranno saltati.`))return;const ids=new Set(records.map(r=>r.id));const add=incoming.filter(r=>!r.id||!ids.has(r.id)).map(r=>({...r,id:r.id||id()}));records.push(...add);if(!save())return;refresh();alert(`Importazione completata: ${add.length} nuovi movimenti aggiunti.`)}catch(err){alert("Backup non importato: "+err.message)}finally{e.target.value=""}});
const regTab=$("#tab-registro"),histTab=$("#tab-storico"),chartTab=$("#tab-grafici"),regPanel=$("#panel-registro"),histPanel=$("#panel-storico"),chartPanel=$("#panel-grafici"),filterControl=$("#period-filter-control");
function activate(tab){const slot=tab===regTab?regPanel.querySelector(".summary-section"):tab===histTab?$("#period-filter-slot-storico"):$("#period-filter-slot-grafici");if(tab===regTab)slot.insertBefore(filterControl,slot.firstChild);else slot.append(filterControl);[regPanel,histPanel,chartPanel].forEach(p=>p.hidden=true);[regTab,histTab,chartTab].forEach(t=>t.classList.toggle("is-active",t===tab));(tab===regTab?regPanel:tab===histTab?histPanel:chartPanel).hidden=false;if(tab!==regTab)refresh();else summary()}
regTab.addEventListener("click",()=>activate(regTab));histTab.addEventListener("click",()=>activate(histTab));chartTab.addEventListener("click",()=>activate(chartTab));
function theme(t){document.documentElement.dataset.theme=t;$("#theme-toggle-icon").textContent=t==="dark"?"☀":"☾";$("#theme-toggle-label").textContent=t==="dark"?"Chiaro":"Scuro";try{localStorage.setItem(THEME_STORAGE_KEY,t)}catch(e){}}
$("#theme-toggle").addEventListener("click",()=>theme(document.documentElement.dataset.theme==="dark"?"light":"dark"));
try{theme(localStorage.getItem(THEME_STORAGE_KEY)==="dark"?"dark":"light")}catch(e){theme("light")}
records=load();activate(regTab);updateFields();refresh();window.addEventListener("resize",()=>{if(!chartPanel.hidden)charts()});
if("serviceWorker"in navigator){let refreshing=false;navigator.serviceWorker.register("./service-worker.js").then(reg=>{reg.update();document.addEventListener("visibilitychange",()=>{if(document.visibilityState==="visible")reg.update()});navigator.serviceWorker.addEventListener("controllerchange",()=>{if(!refreshing){refreshing=true;location.reload()}})}).catch(console.error)}
