import { db } from "./firebase.js";
import { collection, getDocs, query, orderBy, where, doc, updateDoc } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getLang, setLang, t, catLabel, applyFullLang } from "./i18n.js";
import { generateInvoicePdf } from "./invoice-pdf.js";

const SESSION_KEY = "sallah_customer_session";
const CUSTOMERS_LOCAL_KEY = "sallah_customers_data";

const CATEGORY_PERMISSIONS = {
  "جرد مخزون": ["قسم المعمل","قسم السوبرماركت","قسم محلات الجملة","قسم المستودع","احتياجات المعمل"],
  "حساب فرع": ["قسم المعمل","قسم السوبرماركت","قسم محلات الجملة","قسم المستودع","احتياجات المعمل"]
};

const CAT_META_KEY="simsim_cat_meta";
function getCatMeta(){try{return JSON.parse(localStorage.getItem(CAT_META_KEY))||{};}catch(e){return{};}}
function getCatMetaObj(cat){const m=getCatMeta();return m[cat]||{nameEn:cat,desc:"",showDesc:true};}
async function loadCategoriesFromFirestore(){
  try{
    const snap=await getDocs(query(collection(db,"categories"),orderBy("order","asc")));
    if(snap.empty)return;
    const meta={};
    snap.forEach(d=>{const d2=d.data();meta[d2.nameAr]={nameEn:d2.nameEn||d2.nameAr,desc:d2.desc||"",showDesc:d2.showDesc!==false};});
    const existing=JSON.parse(localStorage.getItem("simsim_cat_meta"))||{};
    Object.keys(meta).forEach(k=>{if(existing[k]&&existing[k].showDesc!==undefined)meta[k].showDesc=existing[k].showDesc;});
    Object.assign(existing,meta);existing._catOrder=snap.docs.map(d=>d.data().nameAr);
    localStorage.setItem("simsim_cat_meta",JSON.stringify(existing));
  }catch(e){}
}

let allProducts = [];
let cart = JSON.parse(localStorage.getItem("cart")) || [];
let inventoryCart = JSON.parse(localStorage.getItem("inventoryCart")) || [];
let currentCustomer = null;
let currentCustomerPin = "";
let customersCache = [];
let productQuantities = {};
let currentCategory = null;

const PRODS_CACHE_KEY="sallah_products_cache";
function getCachedProducts(){
  try{const d=localStorage.getItem(PRODS_CACHE_KEY);if(d){const p=JSON.parse(d);if(Array.isArray(p))return p;}}catch(e){}return null;
}
function setCachedProducts(p){try{localStorage.setItem(PRODS_CACHE_KEY,JSON.stringify(p));}catch(e){}}

const productsDiv = document.getElementById("products");
const searchInput = document.getElementById("search");
const cartCount = document.getElementById("cartCount");
const cartIconLink = document.getElementById("cartIconLink");
const categoriesBar = document.getElementById("categoriesBar");
const productsMain = document.getElementById("productsMain");
const loginRequiredOverlay = document.getElementById("loginRequiredOverlay");
const loginRequiredBtn = document.getElementById("loginRequiredBtn");

function escapeHTML(value){
  return String(value ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");
}
function getItemQty(item){ const qty = parseInt(item.qty,10); return isNaN(qty) || qty < 1 ? 1 : qty; }
function getProductImage(p){ if(p.image && typeof p.image === "string" && p.image.trim() !== "") return p.image; return "images/noimg.jpg"; }
function getCartTotalQty(){ return cart.reduce((sum,item) => sum + getItemQty(item), 0); }

/* ========================
   LANGUAGE TOGGLE
   ======================== */
function refreshIcons(){ if(window.lucide && window.lucide.createIcons){ try{ window.lucide.createIcons(); }catch(e){} } }

function syncHeaderHeight(){
  const header = document.querySelector(".app-header");
  if(!header) return;
  const h = header.getBoundingClientRect().height;
  document.body.style.setProperty("--v2-header-h", Math.round(h)+"px");
}

function v2Text(id, key){
  const el = document.getElementById(id);
  if(!el) return;
  const t2 = el.querySelector(".btn-text") || el.querySelector("span");
  if(t2) t2.textContent = t(key); else el.textContent = t(key);
}
function v2LangLabel(id){
  const btn = document.getElementById(id);
  if(!btn) return;
  const span = btn.querySelector("span");
  if(span) span.textContent = getLang() === "en" ? "عربي" : "EN";
}
function applyV2DrawerLang(){
  document.querySelectorAll("#appDrawer [data-i18n-menu]").forEach(el => {
    const key = el.getAttribute("data-i18n-menu");
    if(!key) return;
    const label = el.querySelector(".drawer-label");
    if(label) label.textContent = t(key);
  });
}
function applyLang(){
  const lang = getLang();
  const isEn = lang === "en";
  document.documentElement.lang = lang;
  document.documentElement.dir = isEn ? "ltr" : "rtl";

  v2LangLabel("langToggle");
  v2LangLabel("loginOverlayLangToggle");

  const si = document.getElementById("search");
  if(si) si.placeholder = t("searchPlaceholder");

  const lb = document.getElementById("loginBtn");
  if(lb){ const s = lb.querySelector("span"); if(s) s.textContent = t("login"); }

  const ov = document.getElementById("loginRequiredOverlay");
  if(ov){
    const h2 = ov.querySelector("h2");
    const p = ov.querySelector("p");
    if(h2) h2.textContent = t("welcomeMsg");
    if(p) p.textContent = t("welcomeSub");
    v2Text("loginRequiredBtn", "loginBtnOverlay");
  }

  const lm = document.getElementById("loginModal");
  if(lm){
    const h2 = lm.querySelector("h2");
    const sub = lm.querySelector(".modal-subtitle");
    if(h2) h2.textContent = t("loginTitle");
    if(sub) sub.textContent = t("loginSubtitle");
    const sel = lm.querySelector("#loginAccountType");
    if(sel && sel.options.length >= 3){
      sel.options[0].textContent = t("accountType");
      sel.options[1].textContent = t("accountTypeLab");
      sel.options[2].textContent = t("accountTypeBranch");
    }
    const ns = lm.querySelector("#loginName");
    if(ns){ const d = ns.querySelector('option[value=""]'); if(d) d.textContent = t("selectName"); }
    const pin = lm.querySelector("#loginPin");
    if(pin) pin.placeholder = t("pinPlaceholder");
    v2Text("loginSubmit", "submit");
  }

  document.querySelectorAll("#profileDropdown [data-i18n]").forEach(el => { el.textContent = t(el.getAttribute("data-i18n")); });
  v2Text("profileChangePinBtn", "changePin");
  v2Text("profileInvoicesBtn", "myInvoices");
  v2Text("profileLogoutBtn", "logout");
  const pp = document.getElementById("profileTogglePin");
  if(pp){
    const s = pp.querySelector("span");
    const pinEl = document.getElementById("profilePin");
    if(s) s.textContent = (pinEl && pinEl.textContent === "****") ? t("show") : t("hide");
  }

  document.querySelectorAll(".cat-chip .cat-label[data-i18n-cat]").forEach(el => { el.textContent = catLabel(el.getAttribute("data-i18n-cat")); });
  document.querySelectorAll("[data-i18n]:not([data-i18n-cat])").forEach(el => { el.textContent = t(el.getAttribute("data-i18n")); });

  applyV2DrawerLang();
  refreshIcons();
}
document.getElementById("langToggle")?.addEventListener("click", () => {
  closeDrawer();
  setLang(getLang() === "ar" ? "en" : "ar");
  applyLang();
});
document.getElementById("loginOverlayLangToggle")?.addEventListener("click", () => {
  setLang(getLang() === "ar" ? "en" : "ar");
  applyLang();
});

/* ========================
   AUTH / SESSION
   ======================== */
function loadSession(){
  const stored = localStorage.getItem(SESSION_KEY);
  if(stored){
    try{
      const data = JSON.parse(stored);
      currentCustomer = { id:data.id, name:data.name, branch:data.branch||"", accountType:data.accountType||"", permissions:data.permissions||{} };
      currentCustomerPin = data.pin || "";
      updateAuthUI();
      showStore();
      updateInventoryCartCount();
    }catch(e){ currentCustomer = null; }
  }
}
function saveSession(customer, pin){
  currentCustomer = customer;
  currentCustomerPin = pin || "";
  const sessionData = { id:customer.id, name:customer.name, branch:customer.branch||"", pin:currentCustomerPin, accountType:customer.accountType||"", permissions:customer.permissions||{} };
  localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  updateAuthUI();
  showStore();
}
function clearSession(){
  currentCustomer = null;
  currentCustomerPin = "";
  localStorage.removeItem(SESSION_KEY);
  updateAuthUI();
  hideStore();
  updateInventoryCartCount();
}
function updateAuthUI(){
  const loginBtnEl = document.getElementById("loginBtn");
  const userProfileEl = document.getElementById("userProfile");
  if(currentCustomer){
    if(loginBtnEl) loginBtnEl.style.display = "none";
    if(userProfileEl) userProfileEl.style.display = "flex";
    document.getElementById("loggedInUser").textContent = currentCustomer.name;
    document.getElementById("profileName").textContent = currentCustomer.name;
    document.getElementById("profileType").textContent = currentCustomer.accountType || (getLang()==="en"?"Not set":"غير محدد");
    document.getElementById("profileAvatar").textContent = (currentCustomer.name || "?")[0];
    const cartBtn = document.getElementById("cartIconLink");
    if(cartBtn){
      if(currentCustomer.accountType === "حساب فرع"){
        cartBtn.href = "cart.html";
        cartBtn.style.display = "inline-flex";
        cartBtn.innerHTML = `<i data-lucide="shopping-cart"></i><span class="cart-badge" id="cartCount">0</span>`;
      } else if(currentCustomer.accountType === "جرد مخزون"){
        cartBtn.href = "inventory-cart.html";
        cartBtn.style.display = "inline-flex";
        cartBtn.innerHTML = `<i data-lucide="clipboard-list"></i><span class="cart-badge" id="cartCount">0</span>`;
      } else {
        cartBtn.style.display = "none";
      }
      refreshIcons();
      updateCartCount();
      updateInventoryCartCount();
    }
  }else{
    if(loginBtnEl) loginBtnEl.style.display = "inline-flex";
    if(userProfileEl) userProfileEl.style.display = "none";
    const cartBtn = document.getElementById("cartIconLink");
    if(cartBtn) cartBtn.style.display = "none";
  }
  refreshIcons();
}

/* ========================
   SHOW/HIDE STORE
   ======================== */
function showStore(){
  if(loginRequiredOverlay) loginRequiredOverlay.classList.add("hidden");
  if(categoriesBar) categoriesBar.style.display = "";
  if(productsMain) productsMain.style.display = "";
  if(searchInput) searchInput.disabled = false;
  applyPermissions();
  const allowed = getAllowedCategories();
  if(!currentCategory || !allowed.includes(currentCategory)){
    currentCategory = allowed.length ? allowed[0] : null;
  }
  setActiveCategory();
  renderProducts(getFilteredProducts());
}
function hideStore(){
  if(loginRequiredOverlay) loginRequiredOverlay.classList.remove("hidden");
  if(categoriesBar) categoriesBar.style.display = "none";
  if(productsMain) productsMain.style.display = "none";
  if(searchInput) searchInput.disabled = true;
}

/* ========================
   PERMISSIONS
   ======================== */
function getAllowedCategories(){
  if(!currentCustomer) return [];
  const perms = currentCustomer.permissions;
  if(perms && typeof perms === 'object' && Object.keys(perms).length > 0){
    const active = Object.keys(perms).filter(k => perms[k]);
    const productCats = new Set(allProducts.filter(p=>p.category).map(p=>p.category));
    const matched = active.filter(c => productCats.has(c));
    if(matched.length > 0) return matched;
  }
  const accType = currentCustomer.accountType || "";
  const storedMeta = (()=>{try{return JSON.parse(localStorage.getItem("simsim_cat_meta"))||{};}catch(e){return{};}})();
  const dynamicPerms = storedMeta._defaultPerms || CATEGORY_PERMISSIONS;
  const defaults = dynamicPerms[accType] || [];
  if(defaults.length > 0){
    const productCats = new Set(allProducts.filter(p=>p.category).map(p=>p.category));
    const matched = defaults.filter(d => productCats.has(d));
    if(matched.length > 0) return matched;
  }
  return [...new Set(allProducts.filter(p=>p.category).map(p=>p.category))];
}
function applyPermissions(){
  const allowed = getAllowedCategories();
  document.querySelectorAll(".cat-chip").forEach(card => {
    const cat = card.dataset.cat;
    if(allowed.includes(cat)){
      card.style.display = "";
      card.style.opacity = "1";
      card.style.pointerEvents = "auto";
    }else{
      card.style.display = "none";
      card.style.opacity = "0.3";
      card.style.pointerEvents = "none";
    }
  });
}
function setActiveCategory(){
  document.querySelectorAll(".cat-chip").forEach(c => {
    c.classList.toggle("active", c.dataset.cat === currentCategory);
  });
}

function buildCategoryCards(){
  const bar=document.getElementById("categoriesBar");if(!bar)return;
  const cats=[...new Set(allProducts.filter(p=>p.category).map(p=>p.category))];
  let html="";
  cats.forEach(cat=>{
    const count=allProducts.filter(p=>p.category===cat).length;
    const meta=getCatMetaObj(cat);
    html+=`<button type="button" class="cat-chip" data-cat="${escapeHTML(cat)}"><span class="cat-count" data-cat-count="${escapeHTML(cat)}" style="display:${count>0?"":"none"}">${count}</span><span class="cat-label" data-i18n-cat="${escapeHTML(cat)}">${catLabel(cat)}</span>${meta.showDesc!==false&&meta.desc?`<span class="cat-desc">${escapeHTML(meta.desc)}</span>`:""}</button>`;
  });
  bar.innerHTML=html;
  refreshIcons();
  bar.querySelectorAll(".cat-chip").forEach(card=>{
    card.addEventListener("click",()=>{
      currentCategory=card.dataset.cat;
      setActiveCategory();
      const value=searchInput?searchInput.value.trim().toLowerCase():"";
      let filtered=getFilteredProducts();
      if(value)filtered=filtered.filter(p=>{const t=`${p.name||""} ${p.description||""} ${p.code||""}`.toLowerCase();return t.includes(value);});
      renderProducts(filtered);
    });
  });
  applyPermissions();
  if(!currentCategory||!getAllowedCategories().includes(currentCategory)){
    const allowed=getAllowedCategories();
    currentCategory=allowed.length?allowed[0]:null;
  }
  setActiveCategory();
}

/* ========================
   PRODUCTS
   ======================== */
productsDiv.innerHTML = `<div class="state-empty"><i data-lucide="loader"></i><h3>${t("loading")}</h3></div>`;
refreshIcons();

async function loadProducts(){
  const cached=getCachedProducts();
  if(cached&&cached.length){
    allProducts=cached;
    buildCategoryCards();
    applyLang();
    if(currentCustomer) renderProducts(getFilteredProducts());
    updateCategoryBadges();
  }
  try{
    const querySnapshot = await getDocs(collection(db,"products"));
    allProducts = [];
    querySnapshot.forEach(doc => allProducts.push({id:doc.id,...doc.data()}));
    setCachedProducts(allProducts);
    buildCategoryCards();
    applyLang();
    if(currentCustomer) renderProducts(getFilteredProducts());
    updateCategoryBadges();
  }catch(e){console.error(e);}
}

function updateCategoryBadges(){
  const cats=[...new Set(allProducts.filter(p=>p.category).map(p=>p.category))];
  cats.forEach(cat => {
    const count = allProducts.filter(p => p.category === cat).length;
    document.querySelectorAll(`[data-cat-count="${cat}"]`).forEach(badge => {
      badge.textContent = count;
      badge.style.display = count > 0 ? "" : "none";
    });
  });
}

function getFilteredProducts(){
  let base = currentCategory
    ? allProducts.filter(p => (p.category || "") === currentCategory)
    : allProducts;
  if(currentCustomer && currentCustomer.accountType === "جرد مخزون"){
    base = base.filter(p => p.invVisible !== false);
  }
  return base;
}

function renderProducts(products){
  if(!productsDiv) return;
  if(products.length === 0){
    productsDiv.innerHTML = `<div class="state-empty"><i data-lucide="package-open"></i><h3>${t("noProducts")}</h3></div>`;
    refreshIcons();
    return;
  }
  const isInv = currentCustomer && currentCustomer.accountType === "جرد مخزون";
  const invLabel = getLang() === "en" ? "Count" : "جرد";
  let html="";
  for(let i=0;i<products.length;i++){
    const product=products[i];
    const pid = product.id;
    if(!productQuantities[pid]) productQuantities[pid] = 1;
    const qty = productQuantities[pid];
    html+=`<div class="product-card" style="animation-delay:${(i%12)*0.03}s">
      <div class="product-img-wrap">
        <img src="${escapeHTML(getProductImage(product))}" alt="${escapeHTML(product.name||"")}" loading="lazy" decoding="async" onerror="this.src='images/noimg.jpg'">
      </div>
      <div class="product-body">
        <h3>${escapeHTML(product.description||"")}</h3>
        <p class="product-name-ar">${escapeHTML(product.name||"")}</p>
        <p class="product-sku">SKU: ${escapeHTML(product.code||"")}</p>
        <div class="qty-stepper">
          <button type="button" data-action="dec" data-id="${escapeHTML(pid)}" aria-label="-"><i data-lucide="minus"></i></button>
          <input class="qty-val" id="qty-${escapeHTML(pid)}" value="${qty}" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
          <button type="button" data-action="inc" data-id="${escapeHTML(pid)}" aria-label="+"><i data-lucide="plus"></i></button>
        </div>
        ${isInv
          ? `<button class="btn-add inventory-btn" data-id="${escapeHTML(pid)}" type="button"><i data-lucide="clipboard-list"></i><span>${invLabel}</span></button>`
          : `<button class="btn-add" data-id="${escapeHTML(pid)}" type="button"><i data-lucide="cart-plus"></i><span data-i18n="addToCart">${t("addToCart")}</span></button>`}
      </div>
    </div>`;
  }
  productsDiv.innerHTML = html;
  refreshIcons();
}

if(productsDiv){
  productsDiv.addEventListener("input", event => {
    const input = event.target.closest(".qty-val");
    if(!input) return;
    const id = input.id.replace("qty-","");
    let val = parseInt(input.value, 10);
    if(isNaN(val) || val < 1) val = 1;
    input.value = val;
    productQuantities[id] = val;
  });

  productsDiv.addEventListener("click", event => {
    const incBtn = event.target.closest('[data-action="inc"]');
    const decBtn = event.target.closest('[data-action="dec"]');
    const cartBtn = event.target.closest(".btn-add");
    if(incBtn){
      const id = incBtn.dataset.id;
      productQuantities[id] = (productQuantities[id]||1)+1;
      const el = document.getElementById("qty-"+id);
      if(el) el.value = productQuantities[id];
      return;
    }
    if(decBtn){
      const id = decBtn.dataset.id;
      productQuantities[id] = Math.max(1,(productQuantities[id]||1)-1);
      const el = document.getElementById("qty-"+id);
      if(el) el.value = productQuantities[id];
      return;
    }
    if(cartBtn){
      const id = cartBtn.dataset.id;
      const qty = productQuantities[id] || 1;
      const isInventory = currentCustomer && currentCustomer.accountType === "جرد مخزون";
      if(isInventory){
        addToInventoryCart(id, qty);
        cartBtn.classList.add("is-added");
        const lbl = cartBtn.querySelector("span");
        if(lbl) lbl.textContent = "✓";
        setTimeout(() => { cartBtn.classList.remove("is-added"); if(lbl) lbl.textContent = getLang()==="en" ? "Count" : "جرد"; }, 1200);
      }else{
        addToCart(id, qty);
        cartBtn.classList.add("is-added");
        const lbl2 = cartBtn.querySelector("span");
        if(lbl2) lbl2.textContent = t("addedToCart");
        setTimeout(() => { cartBtn.classList.remove("is-added"); if(lbl2) lbl2.textContent = t("addToCart"); }, 1200);
      }
      return;
    }
  });
}

/* ========================
   CART
   ======================== */
function addToCart(id, quantity){
  const product = allProducts.find(p => String(p.id) === String(id));
  if(!product) return;
  const addQty = parseInt(quantity,10);
  const finalQty = isNaN(addQty) || addQty < 1 ? 1 : addQty;
  const existing = cart.find(item => String(item.id) === String(id));
  if(existing){ existing.qty = getItemQty(existing) + finalQty; }
  else{ cart.push({ id:product.id, name:product.name||"", description:product.description||"", code:product.code||"", category:product.category||"", image:product.image||"images/noimg.jpg", qty:finalQty }); }
  updateCartCount();
  if(cartIconLink){ cartIconLink.classList.add("bounce"); setTimeout(()=>cartIconLink.classList.remove("bounce"),400); }
}
function updateCartCount(){
  const el = document.getElementById("cartCount");
  if(el) el.textContent = getCartTotalQty();
  localStorage.setItem("cart",JSON.stringify(cart));
}
function addToInventoryCart(id, quantity){
  const product = allProducts.find(p => String(p.id) === String(id));
  if(!product) return;
  const addQty = parseInt(quantity,10);
  const finalQty = isNaN(addQty) || addQty < 1 ? 1 : addQty;
  const existing = inventoryCart.find(item => String(item.id) === String(id));
  if(existing){ existing.qty = getItemQty(existing) + finalQty; }
  else{ inventoryCart.push({ id:product.id, name:product.name||"", description:product.description||"", code:product.code||"", category:product.category||"", image:product.image||"images/noimg.jpg", qty:finalQty }); }
  updateInventoryCartCount();
}
function updateInventoryCartCount(){
  const count = inventoryCart.reduce((sum,item) => sum + getItemQty(item), 0);
  localStorage.setItem("inventoryCart", JSON.stringify(inventoryCart));
  if(currentCustomer && currentCustomer.accountType === "جرد مخزون"){
    const el = document.getElementById("cartCount");
    if(el) el.textContent = count;
  }
}

/* ========================
   CATEGORY FILTER
   ======================== */
/* Handlers attached dynamically in buildCategoryCards() */

/* ========================
   SEARCH
   ======================== */
if(searchInput){
  searchInput.addEventListener("input", () => {
    const value = searchInput.value.trim().toLowerCase();
    const filtered = getFilteredProducts().filter(p => {
      const productText = `${p.name||""} ${p.description||""} ${p.code||""} ${p.category||""}`.toLowerCase();
      return productText.includes(value);
    });
    renderProducts(filtered);
  });
}

/* ========================
   LOGIN MODAL (FIXED: fetches from Firestore)
   ======================== */
const loginModal = document.getElementById("loginModal");
const loginModalClose = document.getElementById("loginModalClose");
const loginAccountType = document.getElementById("loginAccountType");
const loginNameInput = document.getElementById("loginName");
const loginPinInput = document.getElementById("loginPin");
const loginSubmitBtn = document.getElementById("loginSubmit");
const loginError = document.getElementById("loginError");

function openLoginModal(){
  if(!loginModal) return;
  loginModal.hidden = false;
  loginModal.setAttribute("aria-hidden","false");
  if(loginAccountType) loginAccountType.value = "";
  if(loginNameInput){ loginNameInput.style.display = "none"; loginNameInput.value = ""; }
  if(loginPinInput){ loginPinInput.style.display = "none"; loginPinInput.value = ""; }
  if(loginSubmitBtn) loginSubmitBtn.style.display = "none";
  if(loginError) loginError.textContent = "";
  requestAnimationFrame(() => loginModal.classList.add("active"));
  loadCustomersFromFirestore();
}

function closeLoginModal(){
  if(!loginModal) return;
  loginModal.classList.remove("active");
  loginModal.setAttribute("aria-hidden","true");
  setTimeout(() => { loginModal.hidden = true; }, 200);
}

async function loadCustomersFromFirestore(){
  customersCache = getLocalCustomers();
  try{
    const snapshot = await getDocs(collection(db, "customers"));
    const firestoreCustomers = snapshot.docs.map(d => ({ id:d.id, ...d.data() }));
    const localIds = new Set(customersCache.map(c => c.id));
    const localNames = new Set(customersCache.map(c => String(c.name||"").trim().toLowerCase()));
    let changed = false;
    firestoreCustomers.forEach(fc => {
      const fcName = String(fc.name||"").trim().toLowerCase();
      const existingById = customersCache.find(c => c.id === fc.id);
      const existingByName = customersCache.find(c => String(c.name||"").trim().toLowerCase() === fcName);
      if(existingById){
        Object.assign(existingById, fc);
      }else if(existingByName){
        Object.assign(existingByName, fc);
      }else{
        customersCache.push(fc);
        changed = true;
      }
    });
    customersCache.forEach(c => {
      if(!c.accountType || c.accountType.trim() === ""){
        c.accountType = "جرد مخزون";
        if(c.id && !String(c.id).startsWith("local_")){
          import("https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js").then(({doc,updateDoc}) => {
            import("./firebase.js").then(({db:d}) => {
              updateDoc(doc(d,"customers",c.id),{accountType:"جرد مخزون"}).catch(()=>{});
            });
          });
        }
      }
    });
    saveLocalCustomers(customersCache);
  }catch(e){
    console.warn("Firestore sync failed:", e);
  }
}

function getLocalCustomers(){ try{ return JSON.parse(localStorage.getItem(CUSTOMERS_LOCAL_KEY)) || []; }catch(e){ return []; } }
function saveLocalCustomers(arr){ localStorage.setItem(CUSTOMERS_LOCAL_KEY, JSON.stringify(arr)); }

function populateCustomerDropdown(accountType){
  if(!loginNameInput) return;
  loginNameInput.innerHTML = '<option value="">-- اختر الاسم --</option>';
  let filtered = customersCache;
  if(accountType){
    filtered = customersCache.filter(c => {
      const t = (c.accountType || "").trim();
      return t === accountType || t === "";
    });
  }
  const sorted = [...filtered].sort((a,b) => String(a.name||"").localeCompare(String(b.name||""), "ar"));
  sorted.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c.name;
    opt.textContent = c.name;
    loginNameInput.appendChild(opt);
  });
}

loginAccountType?.addEventListener("change", function(){
  const val = this.value;
  if(val){
    populateCustomerDropdown(val);
    if(loginNameInput) loginNameInput.style.display = "block";
    if(loginPinInput) loginPinInput.style.display = "none";
    if(loginSubmitBtn) loginSubmitBtn.style.display = "none";
  }else{
    if(loginNameInput) loginNameInput.style.display = "none";
    if(loginPinInput) loginPinInput.style.display = "none";
    if(loginSubmitBtn) loginSubmitBtn.style.display = "none";
  }
});

loginNameInput?.addEventListener("change", function(){
  if(this.value){
    if(loginPinInput) loginPinInput.style.display = "block";
    if(loginSubmitBtn) loginSubmitBtn.style.display = "block";
  }else{
    if(loginPinInput) loginPinInput.style.display = "none";
    if(loginSubmitBtn) loginSubmitBtn.style.display = "none";
  }
});

loginPinInput?.addEventListener("keydown", e => { if(e.key === "Enter") loginSubmitBtn?.click(); });

loginSubmitBtn?.addEventListener("click", () => {
  if(loginError) loginError.textContent = "";
  const name = loginNameInput ? loginNameInput.value.trim() : "";
  const pin = loginPinInput ? loginPinInput.value.trim() : "";
  const accountType = loginAccountType ? loginAccountType.value : "";
  if(!accountType){ loginError.textContent = t("selectAccountType"); return; }
  if(!name){ loginError.textContent = t("selectNameErr"); return; }
  if(!pin){ loginError.textContent = t("enterPin"); return; }
  const trimmedName = name.trim().toLowerCase();
  const match = customersCache.find(c => String(c.name||"").trim().toLowerCase() === trimmedName);
  if(!match){ loginError.textContent = t("accountNotFound"); return; }
  if(String(match.pin) === pin){
    saveSession({ id:match.id, name:match.name, branch:match.branch||"", accountType:match.accountType || accountType, permissions:match.permissions||{} }, pin);
    closeLoginModal();
  }else{
    loginError.textContent = t("wrongPassword");
  }
});

document.getElementById("loginBtn")?.addEventListener("click", openLoginModal);
loginRequiredBtn?.addEventListener("click", openLoginModal);
loginModalClose?.addEventListener("click", closeLoginModal);
loginModal?.addEventListener("click", e => { if(e.target === loginModal) closeLoginModal(); });

/* ========================
   PROFILE
   ======================== */
const profileToggle = document.getElementById("profileToggle");
const profileDropdown = document.getElementById("profileDropdown");

profileToggle?.addEventListener("click", e => { e.stopPropagation(); profileDropdown?.classList.toggle("show"); });
document.addEventListener("click", e => { if(profileDropdown?.classList.contains("show") && !profileDropdown.contains(e.target) && e.target !== profileToggle) profileDropdown.classList.remove("show"); });

document.getElementById("profileLogoutBtn")?.addEventListener("click", () => {
  profileDropdown?.classList.remove("show");
  if(confirm(t("logoutConfirm"))) clearSession();
});
document.getElementById("profileTogglePin")?.addEventListener("click", () => {
  const el = document.getElementById("profilePin");
  if(!el) return;
  const btn = document.getElementById("profileTogglePin");
  const span = btn?.querySelector("span");
  if(el.textContent === "****"){
    el.textContent = currentCustomerPin || "N/A";
    if(span) span.textContent = t("hide");
  }else{
    el.textContent = "****";
    if(span) span.textContent = t("show");
  }
});
document.getElementById("profileChangePinBtn")?.addEventListener("click", async () => {
  profileDropdown?.classList.remove("show");
  const newPin = prompt(t("changePinPrompt"));
  if(!newPin){ alert(t("enterPin")); return; }
  currentCustomerPin = newPin;
  const stored = JSON.parse(localStorage.getItem(SESSION_KEY) || "{}");
  stored.pin = newPin;
  localStorage.setItem(SESSION_KEY, JSON.stringify(stored));
  // Update pin in Firestore
  try{ await updateDoc(doc(db,"customers",currentCustomer.id),{pin:newPin}); }catch(e){ console.warn("Pin update failed:",e); }
  // Also update customersCache so re-login works immediately
  const cached = customersCache.find(c => c.id === currentCustomer.id);
  if(cached) cached.pin = newPin;
  saveLocalCustomers(customersCache);
  alert(t("pinChanged"));
});
document.getElementById("profileInvoicesBtn")?.addEventListener("click", () => {
  profileDropdown?.classList.remove("show");
  openInvoicesModal();
});

/* ========================
   INVOICES MODAL
   ======================== */
function openInvoicesModal(){
  const m = document.getElementById("invoicesModal");
  if(!m) return;
  m.hidden = false;
  m.setAttribute("aria-hidden","false");
  document.getElementById("invoicesList").innerHTML = `<div class="loading-text">${t("loadingInvoices")}</div>`;
  document.getElementById("invoicesSubtitle").textContent = `${t("customer")}: ${currentCustomer?.name||""}`;
  requestAnimationFrame(() => m.classList.add("active"));
  loadCustomerInvoices();
}
function closeInvoicesModal(){
  const m = document.getElementById("invoicesModal");
  if(!m) return;
  m.classList.remove("active");
  m.setAttribute("aria-hidden","true");
  setTimeout(() => { m.hidden = true; }, 200);
}

async function loadCustomerInvoices(){
  if(!currentCustomer) return;
  const list = document.getElementById("invoicesList");
  try{
    const {collection:col,query:q,where,orderBy,getDocs:gd} = await import("https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js");
    const {db:d} = await import("./firebase.js");
    let snapshot;
    try{ snapshot = await gd(q(col(d,"invoices"),where("customerId","==",currentCustomer.id),orderBy("createdAt","desc"))); }
    catch(e){ snapshot = await gd(q(col(d,"invoices"),where("customerId","==",currentCustomer.id))); }
    if(snapshot.empty){ list.innerHTML = `<div class="empty-text">${t("noInvoices")}</div>`; return; }
    list.innerHTML = "";
    snapshot.forEach(doc => {
      const inv = doc.data();
      const div = document.createElement("div");
      div.className = "invoice-card";
      div.innerHTML = `
        <div class="invoice-card__top">
          <strong class="invoice-card__no">${escapeHTML(inv.branchName||inv.invoiceNo||"")}</strong>
          <span class="invoice-card__date">${inv.date||""}</span>
        </div>
        <div class="invoice-card__items">${escapeHTML((inv.items||[]).slice(0,3).map(i=>(i.description||i.name)).join("، "))}</div>
        <div class="invoice-card__footer">
          <span>${t("products")}: ${inv.totalItems||0} | ${t("qty")}: ${inv.totalQty||0}</span>
          <button class="inv-pdf-btn" type="button"><i data-lucide="download"></i><span>PDF</span></button>
        </div>
      `;
      div.querySelector(".inv-pdf-btn")?.addEventListener("click", e => { e.stopPropagation(); generateInvoicePdf(inv); });
      div.addEventListener("click", () => openInvoiceDetail(inv));
      list.appendChild(div);
    });
    refreshIcons();
  }catch(e){ list.innerHTML = '<div class="error-text">حدث خطأ</div>'; }
}

function openInvoiceDetail(inv){
  const m = document.getElementById("invoiceDetailModal");
  const c = document.getElementById("invoiceDetailContent");
  if(!m||!c) return;
  const lang = getLang();
  let html = `<div style="text-align:center;margin-bottom:14px;"><img src="images/logo.png" style="width:72px;height:auto;margin:0 auto 6px;" onerror="this.style.display='none'"><h2 style="font-size:20px;">${t("invoiceDetails")}</h2></div>`;
  html += `<div class="invoice-detail-meta"><div><span>${t("invoiceNum")}</span><strong>${escapeHTML((inv.invoiceNo||"").replace("INV-",""))}</strong></div><div><span>${t("customer")}</span><strong>${escapeHTML(inv.customerName||"")}</strong></div><div><span>${t("date")}</span><strong>${escapeHTML(inv.date||"")}</strong></div></div>`;
  html += `<table class="inv-detail-table"><thead><tr><th>#</th><th>${lang==="en"?"Item":"المنتج"}</th><th>KOD</th><th>${lang==="en"?"Qty":"الكمية"}</th></tr></thead><tbody>`;
  (inv.items||[]).forEach((item,i) => { const desc=item.description||"";const ar=item.name||""; html += `<tr><td>${i+1}</td><td>${escapeHTML(desc)}${ar?`<br><span style="font-size:12px;color:var(--v2-text-subtle);font-weight:600;">${escapeHTML(ar)}</span>`:""}</td><td>${escapeHTML(item.code||"")}</td><td>${getItemQty(item)}</td></tr>`; });
  html += '</tbody></table>';
  html += `<div class="invoice-detail-summary"><span>${t("products")}: ${inv.totalItems||0}</span><span>${t("qty")}: ${inv.totalQty||0}</span></div>`;
  html += `<div style="text-align:center;margin-top:14px;"><button id="invDetailCloseBtn" class="btn-subtle" type="button"><i data-lucide="x"></i><span class="btn-text">${t("close")}</span></button></div>`;
  c.innerHTML = html;
  document.getElementById("invDetailCloseBtn")?.addEventListener("click", () => { m.classList.remove("active"); m.setAttribute("aria-hidden","true"); setTimeout(()=>{ m.hidden=true; },200); });
  m.hidden = false;
  m.setAttribute("aria-hidden","false");
  requestAnimationFrame(() => m.classList.add("active"));
  refreshIcons();
}

document.getElementById("invoicesModalClose")?.addEventListener("click", closeInvoicesModal);
document.getElementById("invoicesCloseBtn")?.addEventListener("click", closeInvoicesModal);
document.getElementById("invoicesModal")?.addEventListener("click", e => { if(e.target.id === "invoicesModal") closeInvoicesModal(); });
document.getElementById("invoiceDetailClose")?.addEventListener("click", () => { const m=document.getElementById("invoiceDetailModal"); if(m){m.classList.remove("active");m.setAttribute("aria-hidden","true");setTimeout(()=>{m.hidden=true;},200);} });
document.getElementById("invoiceDetailModal")?.addEventListener("click", e => { if(e.target.id==="invoiceDetailModal"){const m=e.target;m.classList.remove("active");m.setAttribute("aria-hidden","true");setTimeout(()=>{m.hidden=true;},200);} });

document.addEventListener("keydown", e => {
  if(e.key === "Escape"){ closeLoginModal(); closeInvoicesModal(); closeDrawer(); const m=document.getElementById("invoiceDetailModal"); if(m?.classList.contains("active")){m.classList.remove("active");m.setAttribute("aria-hidden","true");setTimeout(()=>{m.hidden=true;},200);} }
});

/* ========================
   DRAWER
   ======================== */
const appDrawer = document.getElementById("appDrawer");
const appDrawerBackdrop = document.getElementById("appDrawerBackdrop");
function openDrawer(){ syncHeaderHeight(); appDrawer?.classList.add("open"); appDrawerBackdrop?.classList.add("open"); appDrawer?.setAttribute("aria-hidden","false"); }
function closeDrawer(){ appDrawer?.classList.remove("open"); appDrawerBackdrop?.classList.remove("open"); appDrawer?.setAttribute("aria-hidden","true"); }
document.getElementById("menuBtn")?.addEventListener("click", openDrawer);
document.getElementById("appDrawerClose")?.addEventListener("click", closeDrawer);
appDrawerBackdrop?.addEventListener("click", closeDrawer);
appDrawer?.addEventListener("click", e => {
  const toggle = e.target.closest(".drawer-toggle");
  if(toggle){
    const group = toggle.closest(".drawer-group");
    group?.classList.toggle("open");
    return;
  }
  const link = e.target.closest("a");
  if(link){ setTimeout(closeDrawer, 120); }
});

/* ========================
   INIT
   ======================== */
applyLang();
updateCartCount();
updateInventoryCartCount();
loadSession();
syncHeaderHeight();
window.addEventListener("resize", syncHeaderHeight);
(async function(){ await loadCategoriesFromFirestore(); loadProducts(); })();
