import { db } from "./firebase.js";
import { getLang, setLang, t, catLabel, setLabel } from "./i18n.js";
import {
  collection, getDocs, query, orderBy, where
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";

const AUTH_KEY = "sallah_admin_unlocked";
const VERIFIED_KEY = "sallah_admin_verified";
const ADMIN_SESSION_KEY = "sallah_admin_session";
const LOCAL_ADMIN_KEY = "sallah_local_admin";

let allInvoices = [];
let branchInvoices = [];
let productImageById = {};
let productImageByName = {};
let selectedPeriod = "week";
let selectedBranch = "";
let customFrom = "";
let customTo = "";

function escapeHTML(v){ return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
function getItemQty(item){ const q = parseInt(item.qty,10); return isNaN(q)||q<1 ? 1 : q; }

async function loadProductImages(){
  productImageById = {};
  productImageByName = {};
  try{
    const snap = await getDocs(collection(db,"products"));
    snap.forEach(d=>{
      const p = d.data();
      const img = (p.image && String(p.image).trim()!=="") ? p.image : "";
      if(img){
        productImageById[String(d.id)] = img;
        const key = (p.description||p.name||"").trim().toLowerCase();
        if(key) productImageByName[key] = img;
      }
    });
  }catch(e){ console.error("Error loading product images:", e); }
}

async function loadCategoriesMeta(){
  try{
    const snap = await getDocs(query(collection(db,"categories"), orderBy("order","asc")));
    if(snap.empty) return;
    const existing = JSON.parse(localStorage.getItem("simsim_cat_meta"))||{};
    snap.forEach(d=>{
      const d2 = d.data();
      existing[d2.nameAr] = { nameEn: d2.nameEn||d2.nameAr, desc: d2.desc||"", showDesc: d2.showDesc!==false };
    });
    existing._catOrder = snap.docs.map(d=>d.data().nameAr);
    localStorage.setItem("simsim_cat_meta", JSON.stringify(existing));
  }catch(e){ console.error("Error loading categories:", e); }
}

function resolveProductImage(it){
  if(it.image && String(it.image).trim()!=="" && !/noimg/i.test(it.image)) return it.image;
  const byId = productImageById[String(it.id)];
  if(byId) return byId;
  const key = (it.description||it.name||"").trim().toLowerCase();
  if(key && productImageByName[key]) return productImageByName[key];
  return "";
}

// Verify admin (fallback Firestore check mirroring admin.js processLoginInternal)
async function verifyAdmin(){
  if(sessionStorage.getItem(VERIFIED_KEY)==="true") return true;
  const la = sessionStorage.getItem("admin_login_attempt");
  if(!la) return false;
  try{
    const {username, password} = JSON.parse(la);
    sessionStorage.removeItem("admin_login_attempt");
    const snap = await getDocs(query(collection(db,"admins"), where("username","==",username)));
    if(!snap.empty){
      const a = snap.docs[0].data();
      if(a.password === password){
        sessionStorage.setItem(VERIFIED_KEY,"true");
        sessionStorage.setItem(ADMIN_SESSION_KEY,username);
        try{localStorage.setItem(LOCAL_ADMIN_KEY,JSON.stringify({username:a.username||username,password:a.password||password}));}catch(e){}
        return true;
      }
    }
  }catch(e){ console.error(e); }
  return false;
}

async function loadInvoices(){
  const ref = collection(db,"invoices");
  let snapshot;
  try{ snapshot = await getDocs(query(ref, orderBy("createdAt","desc"))); }
  catch(e){ snapshot = await getDocs(ref); }
  allInvoices = [];
  snapshot.forEach(d => allInvoices.push({ id:d.id, ...d.data() }));
  // infer accountType for invoices missing it
  try{
    const custSnap = await getDocs(collection(db,"customers"));
    const typeMap = {};
    custSnap.forEach(d=>{ const dt=d.data(); if(dt.name && dt.accountType) typeMap[dt.name]=dt.accountType; });
    allInvoices.forEach(inv=>{ if(!inv.accountType && inv.customerName && typeMap[inv.customerName]) inv.accountType = typeMap[inv.customerName]; });
  }catch(e){}
  // keep only branch invoices (not inventory-count invoices)
  branchInvoices = allInvoices.filter(inv => inv.accountType !== "جرد مخزون");
}

function parseInvoiceDate(inv){
  if(inv.date){ const d = new Date(inv.date); if(!isNaN(d)) return d; }
  if(inv.createdAt){
    if(typeof inv.createdAt.toDate === "function") return inv.createdAt.toDate();
    const d = new Date(inv.createdAt); if(!isNaN(d)) return d;
  }
  return null;
}

function getPeriodRange(){
  const now = new Date();
  const end = new Date(now); end.setHours(23,59,59,999);
  let start = new Date(now);
  if(selectedPeriod === "week"){
    start.setDate(now.getDate()-6); start.setHours(0,0,0,0);
  } else if(selectedPeriod === "month"){
    start = new Date(now.getFullYear(), now.getMonth(), 1, 0,0,0,0);
  } else if(selectedPeriod === "3months"){
    start = new Date(now); start.setMonth(now.getMonth()-3); start.setHours(0,0,0,0);
  } else if(selectedPeriod === "year"){
    start = new Date(now.getFullYear(), 0, 1, 0,0,0,0);
  } else if(selectedPeriod === "custom"){
    if(customFrom){ start = new Date(customFrom); start.setHours(0,0,0,0); } else { start = new Date(0); }
    let e2 = end;
    if(customTo){ e2 = new Date(customTo); e2.setHours(23,59,59,999); }
    return { start, end: e2 };
  }
  return { start, end };
}

function getFiltered(){
  const { start, end } = getPeriodRange();
  return branchInvoices.filter(inv => {
    if(selectedBranch && (inv.branchName||"") !== selectedBranch) return false;
    const d = parseInvoiceDate(inv);
    if(!d) return false;
    return d >= start && d <= end;
  });
}

function aggregateProducts(list){
  const map = new Map();
  list.forEach(inv => {
    const items = Array.isArray(inv.items) ? inv.items : [];
    const seen = new Set();
    items.forEach(it => {
      const key = String(it.id ?? (it.description||it.name||""));
      if(!key) return;
      if(!map.has(key)){
        map.set(key, { description: it.description||"", name: it.name||"", category: it.category||"", image: resolveProductImage(it), totalQty:0, times:0 });
      } else {
        const rec0 = map.get(key);
        if(!rec0.image){ rec0.image = resolveProductImage(it); }
      }
      const rec = map.get(key);
      rec.totalQty += getItemQty(it);
      if(!seen.has(key)){ rec.times += 1; seen.add(key); }
    });
  });
  return Array.from(map.values()).sort((a,b)=> b.totalQty - a.totalQty);
}

function renderBranchChips(){
  const container = document.getElementById("branchChips");
  if(!container) return;
  const branches = [...new Set(branchInvoices.map(i=>i.branchName||"").filter(Boolean))].sort();
  let html = `<div class="stats-chip${selectedBranch===""?" active":""}" data-branch="">${escapeHTML(t("statsAllBranches"))}</div>`;
  branches.forEach(b=>{ html += `<div class="stats-chip${selectedBranch===b?" active":""}" data-branch="${escapeHTML(b)}">${escapeHTML(b)}</div>`; });
  container.innerHTML = html;
  container.querySelectorAll(".stats-chip").forEach(chip=>{
    chip.addEventListener("click",()=>{
      selectedBranch = chip.dataset.branch;
      container.querySelectorAll(".stats-chip").forEach(c=>c.classList.remove("active"));
      chip.classList.add("active");
      render();
    });
  });
}

function applyLang(){
  const lang = getLang();
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "en" ? "ltr" : "rtl";
  document.getElementById("statsTitle").textContent = t("statsTitle");
  document.getElementById("cardInvoicesLabel").textContent = t("statsTotalInvoices");
  document.getElementById("cardQtyLabel").textContent = t("statsTotalQty");
  document.getElementById("cardProductsLabel").textContent = t("statsDistinctProducts");
  document.getElementById("thProduct").textContent = t("statsProduct");
  document.getElementById("thArabic").textContent = t("statsArabicName");
  document.getElementById("thCategory").textContent = t("statsCategory");
  document.getElementById("thQty").textContent = t("statsTotalQtyCol");
  document.getElementById("thTimes").textContent = t("statsTimesOrdered");
  document.querySelectorAll("#periodChips [data-i18n]").forEach(el=>{ el.textContent = t(el.getAttribute("data-i18n")); });
  document.querySelectorAll("#customRange [data-i18n]").forEach(el=>{ el.textContent = t(el.getAttribute("data-i18n")); });
  const lt = document.getElementById("statsLangToggle");
  if(lt) setLabel(lt, lang === "en" ? "عربي" : "EN");
  const pb = document.getElementById("statsPrintBtn");
  if(pb) setLabel(pb, t("statsPrintBtn") || "طباعة PDF");
  renderBranchChips();
  render();
}

function render(){
  const list = getFiltered();
  const products = aggregateProducts(list);
  const totalQty = products.reduce((s,p)=> s+p.totalQty, 0);
  document.getElementById("cardInvoices").textContent = list.length;
  document.getElementById("cardQty").textContent = totalQty;
  document.getElementById("cardProducts").textContent = products.length;
  const tbody = document.getElementById("statsBody");
  if(!tbody) return;
  if(products.length === 0){
    tbody.innerHTML = `<tr><td colspan="6"><div class="stats-empty">${escapeHTML(t("statsNoData"))}</div></td></tr>`;
    return;
  }
  let html = "";
  products.forEach((p,i)=>{
    const img = p.image && p.image.trim() !== "" ? p.image : "images/noimg.jpg";
    html += `<tr>
      <td>${i+1}</td>
      <td class="stats-name"><div class="stats-prod-cell"><img class="stats-prod-img" src="${escapeHTML(img)}" alt="" loading="lazy" onerror="this.src='images/noimg.jpg'"><span>${escapeHTML(p.description||"-")}</span></div></td>
      <td class="stats-ar">${escapeHTML(p.name||"-")}</td>
      <td>${escapeHTML(p.category?catLabel(p.category):"-")}</td>
      <td class="stats-num">${p.totalQty}</td>
      <td>${p.times}</td>
    </tr>`;
  });
  tbody.innerHTML = html;
}

function init(){
  // period chips
  document.getElementById("periodChips")?.addEventListener("click",e=>{
    const chip = e.target.closest(".stats-chip");
    if(!chip) return;
    document.querySelectorAll("#periodChips .stats-chip").forEach(c=>c.classList.remove("active"));
    chip.classList.add("active");
    selectedPeriod = chip.dataset.period;
    const cr = document.getElementById("customRange");
    if(cr) cr.classList.toggle("show", selectedPeriod==="custom");
    if(selectedPeriod !== "custom") render();
  });
  document.getElementById("applyRange")?.addEventListener("click",()=>{
    customFrom = document.getElementById("dateFrom")?.value || "";
    customTo = document.getElementById("dateTo")?.value || "";
    render();
  });
  document.getElementById("statsLangToggle")?.addEventListener("click",()=>{
    setLang(getLang()==="ar"?"en":"ar");
    applyLang();
  });
  document.getElementById("statsPrintBtn")?.addEventListener("click",printStatsPdf);
}

function getPeriodLabel(){
  if(selectedPeriod === "custom" && (customFrom || customTo)){
    return `${t("statsFrom")}: ${customFrom||"-"}  |  ${t("statsTo")}: ${customTo||"-"}`;
  }
  const map = { week:"statsWeek", month:"statsMonth", "3months":"stats3Months", year:"statsYear", custom:"statsCustom" };
  return t(map[selectedPeriod] || "statsWeek");
}

function waitForImages(c){return Promise.all(Array.from(c.querySelectorAll("img")).map(i=>new Promise(r=>{if(i.complete){r();return;}i.onload=()=>r();i.onerror=()=>r();setTimeout(r,2000);})));}

async function printStatsPdf(){
  const list = getFiltered();
  const products = aggregateProducts(list);
  if(products.length === 0){ alert(t("statsNoData")); return; }
  const totalQty = products.reduce((s,p)=> s+p.totalQty, 0);

  const tpl = document.getElementById("statsPrintTemplate");
  if(!tpl) return;
  document.getElementById("printTitle").textContent = t("statsTitle");
  const brLabel = selectedBranch ? ` | ${selectedBranch}` : ` | ${t("statsAllBranches")}`;
  document.getElementById("printPeriod").textContent = t("statsPeriod") + ": " + getPeriodLabel() + brLabel;
  document.getElementById("printCardInvoices").textContent = list.length;
  document.getElementById("printCardQty").textContent = totalQty;
  document.getElementById("printCardProducts").textContent = products.length;
  document.getElementById("printCardInvoicesLabel").textContent = t("statsTotalInvoices");
  document.getElementById("printCardQtyLabel").textContent = t("statsTotalQty");
  document.getElementById("printCardProductsLabel").textContent = t("statsDistinctProducts");
  document.getElementById("printThImg").textContent = t("statsProduct");
  document.getElementById("printThProduct").textContent = t("statsProduct");
  document.getElementById("printThArabic").textContent = t("statsArabicName");
  document.getElementById("printThCategory").textContent = t("statsCategory");
  document.getElementById("printThQty").textContent = t("statsTotalQtyCol");
  document.getElementById("printThTimes").textContent = t("statsTimesOrdered");

  const ROWS_PER_PAGE = 18;
  const A4_W = 210, A4_H = 297;
  const bodyRows = [];
  products.forEach((p,i)=>{
    const img = p.image && p.image.trim() !== "" ? p.image : "images/noimg.jpg";
    bodyRows.push(`<tr>
      <td style="border:1px solid #222;padding:5px;text-align:center;">${i+1}</td>
      <td style="border:1px solid #222;padding:4px;text-align:center;"><img src="${escapeHTML(img)}" style="width:40px;height:40px;object-fit:cover;border-radius:4px;" onerror="this.src='images/noimg.jpg'"></td>
      <td style="border:1px solid #222;padding:5px;text-align:right;font-weight:700;">${escapeHTML(p.description||"-")}</td>
      <td style="border:1px solid #222;padding:5px;text-align:right;color:#555;">${escapeHTML(p.name||"-")}</td>
      <td style="border:1px solid #222;padding:5px;text-align:center;">${escapeHTML(p.category?catLabel(p.category):"-")}</td>
      <td style="border:1px solid #222;padding:5px;text-align:center;font-weight:800;">${p.totalQty}</td>
      <td style="border:1px solid #222;padding:5px;text-align:center;">${p.times}</td>
    </tr>`);
  });

  const printBody = document.getElementById("printBody");
  tpl.offsetHeight;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("P","mm","A4");
  let start = 0, pageIdx = 0;
  while(start < bodyRows.length){
    const chunk = bodyRows.slice(start, start + ROWS_PER_PAGE);
    printBody.innerHTML = chunk.join("");
    await waitForImages(tpl);
    const canvas = await html2canvas(tpl, { scale:2, useCORS:true, backgroundColor:"#ffffff", windowWidth: tpl.scrollWidth, windowHeight: tpl.scrollHeight });
    const imgD = canvas.toDataURL("image/png");
    const imgH = Math.min((canvas.height * A4_W) / canvas.width, A4_H);
    if(pageIdx > 0) doc.addPage();
    doc.addImage(imgD, "PNG", 0, 0, A4_W, imgH);
    start += ROWS_PER_PAGE;
    pageIdx++;
  }
  printBody.innerHTML = "";
  doc.save(`statistics-${new Date().toISOString().slice(0,10)}.pdf`);
}

(async function(){
  const ok = await verifyAdmin();
  if(!ok){
    const body = document.getElementById("statsBody");
    if(body) body.innerHTML = `<tr><td colspan="6"><div class="stats-empty">Unauthorized</div></td></tr>`;
    return;
  }
  init();
  const tbody = document.getElementById("statsBody");
  if(tbody) tbody.innerHTML = `<tr><td colspan="6"><div class="stats-loading">${escapeHTML(t("statsLoading"))}</div></td></tr>`;
  await Promise.all([loadCategoriesMeta(), loadProductImages()]);
  applyLang();
  await loadInvoices();
  renderBranchChips();
  render();
})();
