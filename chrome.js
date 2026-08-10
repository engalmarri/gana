/* ==========================================================
   SimSim v2 — shared chrome for non-store pages
   Handles: v2 header/drawer wiring, Lucide auto-icons,
   drawer labels + lang-toggle buttons on language change,
   header-height sync.
   NOTE: pages keep their own lang-toggle click handlers
   (they switch the language); this module only RE-RENDERS the
   chrome UI after the change (via MutationObserver on <html>).
   ========================================================== */
import { getLang, t } from "./i18n.js";

function refreshIcons(){
  if(window.lucide && window.lucide.createIcons){
    try{ window.lucide.createIcons(); }catch(e){}
  }
}
window.refreshIcons = refreshIcons;

function syncHeaderHeight(){
  const header = document.querySelector(".app-header");
  if(!header) return;
  const h = header.getBoundingClientRect().height;
  document.body.style.setProperty("--v2-header-h", Math.round(h) + "px");
}
window.syncHeaderHeight = syncHeaderHeight;

const LANG_TOGGLES = ["langToggle","loginOverlayLangToggle","loginModalLangToggle","invBlockLangToggle","adminLoginLangToggle"];

function renderLangToggle(id){
  const el = document.getElementById(id);
  if(!el) return;
  el.classList.add("icon-btn","icon-btn--label");
  el.innerHTML = `<i data-lucide="globe"></i><span>${getLang() === "en" ? "عربي" : "EN"}</span>`;
}

function applyChromeLang(){
  LANG_TOGGLES.forEach(renderLangToggle);

  const loginBtn = document.getElementById("loginBtn");
  if(loginBtn && loginBtn.style.display !== "none"){
    const s = loginBtn.querySelector("span");
    if(s) s.textContent = t("login");
  }

  document.querySelectorAll("#appDrawer [data-i18n-menu]").forEach(el => {
    const key = el.getAttribute("data-i18n-menu");
    if(!key) return;
    const label = el.querySelector(".drawer-label");
    if(label) label.textContent = t(key);
  });

  document.querySelectorAll("#profileDropdown [data-i18n]").forEach(el => {
    el.textContent = t(el.getAttribute("data-i18n"));
  });
  const setBtn = (id, key) => {
    const el = document.getElementById(id);
    if(!el) return;
    const s = el.querySelector("span");
    if(s) s.textContent = t(key);
  };
  setBtn("profileChangePinBtn", "changePin");
  setBtn("profileInvoicesBtn", "myInvoices");
  setBtn("profileLogoutBtn", "logout");
  setBtn("invBlockLogoutBtn", "logout");
  setBtn("invBlockGoInventory", "goInventory");
  const pp = document.getElementById("profileTogglePin");
  if(pp){
    const pinEl = document.getElementById("profilePin");
    const s = pp.querySelector("span");
    if(s) s.textContent = (pinEl && pinEl.textContent === "****") ? t("show") : t("hide");
  }

  refreshIcons();
  syncHeaderHeight();
}

/* ---------- Drawer ---------- */
function openDrawer(){
  syncHeaderHeight();
  const d = document.getElementById("appDrawer");
  const b = document.getElementById("appDrawerBackdrop");
  d?.classList.add("open");
  b?.classList.add("open");
  d?.setAttribute("aria-hidden","false");
}
function closeDrawer(){
  const d = document.getElementById("appDrawer");
  const b = document.getElementById("appDrawerBackdrop");
  d?.classList.remove("open");
  b?.classList.remove("open");
  d?.setAttribute("aria-hidden","true");
}
document.getElementById("menuBtn")?.addEventListener("click", openDrawer);
document.getElementById("appDrawerClose")?.addEventListener("click", closeDrawer);
document.getElementById("appDrawerBackdrop")?.addEventListener("click", closeDrawer);
document.getElementById("appDrawer")?.addEventListener("click", e => {
  const toggle = e.target.closest(".drawer-toggle");
  if(toggle){
    const group = toggle.closest(".drawer-group");
    group?.classList.toggle("open");
    return;
  }
  const link = e.target.closest("a");
  if(link){ setTimeout(closeDrawer, 120); }
});
document.addEventListener("keydown", e => { if(e.key === "Escape") closeDrawer(); });

/* Re-render chrome when page JS changes the language (sets <html lang/dir>) */
const langObserver = new MutationObserver(() => {
  applyChromeLang();
  closeDrawer();
});
langObserver.observe(document.documentElement, { attributes:true, attributeFilter:["lang","dir"] });

/* Auto-create Lucide icons whenever page JS injects markup with <i data-lucide>.
   Guard: only re-create when a non-svg marker element still needs converting.
   Lucide 1.x keeps `data-lucide` on the generated <svg>, so re-scanning svgs
   would otherwise feed an infinite mutation loop and freeze the page. */
const iconObserver = new MutationObserver(() => {
  if (document.querySelector("[data-lucide]:not(svg)")) refreshIcons();
});
iconObserver.observe(document.body, { childList:true, subtree:true });

applyChromeLang();
window.addEventListener("resize", syncHeaderHeight);
