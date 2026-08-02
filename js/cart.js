import { db } from "./firebase.js";
import { generateInvoicePdf } from "./invoice-pdf.js";
import {
  collection, addDoc, getDoc, getDocs, updateDoc, doc,
  query, where, orderBy, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getLang, setLang, t, catLabel, applyFullLang, applyCartLang } from "./i18n.js";

const SESSION_KEY = "sallah_customer_session";
const CUSTOMERS_LOCAL_KEY = "sallah_customers_data";
const INV_COUNTER_KEY = "sallah_invoice_counter";
const COLUMNS_PER_INVOICE_ROW = 3;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const ARABIC_DAYS = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const ARABIC_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const CAT_EN_NAMES = {
  "قسم المعمل": "Almamal",
  "قسم السوبرماركت": "AlsuperNarket",
  "قسم محلات الجملة": "Aljumllah",
  "قسم المستودع": "Almstudaa",
  "احتياجات المعمل": "AhtyagatAlmamal"
};
const CAT_ORDER = ["قسم المعمل","قسم السوبرماركت","قسم محلات الجملة","قسم المستودع","احتياجات المعمل"];
const CAT_META_KEY="simsim_cat_meta";
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
function getCatMeta(){try{return JSON.parse(localStorage.getItem(CAT_META_KEY))||{};}catch(e){return{};}}
function getCatMetaObj(cat){const m=getCatMeta();return m[cat]||{nameEn:cat,desc:"",showDesc:false};}

let cart = JSON.parse(localStorage.getItem("cart")) || [];
let currentCustomer = null;
let currentCustomerPin = "";
let customersCache = [];
let cartCategory = "all";

const cartItems = document.getElementById("cartItems");
const cartTotal = document.getElementById("cartTotal");
const cartSearch = document.getElementById("cartSearch");
const invoiceTemplate = document.getElementById("invoiceTemplate");
const createInvoiceButton = document.getElementById("createInvoice");
const clearCartButton = document.getElementById("clearCartBtn");
const clearCartModal = document.getElementById("clearCartConfirmModal");
const confirmClearInput = document.getElementById("confirmClearInput");
const cancelClearCartButton = document.getElementById("cancelClearCart");
const confirmClearCartButton = document.getElementById("confirmClearCart");
const loginBtn = document.getElementById("loginBtn");
const userProfile = document.getElementById("userProfile");
const loginModal = document.getElementById("loginModal");
const loginAccountType = document.getElementById("loginAccountType");
const loginNameInput = document.getElementById("loginName");
const loginPinInput = document.getElementById("loginPin");
const loginSubmitBtn = document.getElementById("loginSubmit");
const loginError = document.getElementById("loginError");
const invoicesModal = document.getElementById("invoicesModal");
const invoicesList = document.getElementById("invoicesList");
const invoiceDetailModal = document.getElementById("invoiceDetailModal");
const invoiceDetailContent = document.getElementById("invoiceDetailContent");
const cartMain = document.getElementById("cartMain");
const loginRequiredOverlay = document.getElementById("loginRequiredOverlay");
const cartCategoryFilter = document.getElementById("cartCategoryFilter");
const invoiceProducts = document.getElementById("invoiceProducts");

function escapeHTML(v){ return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"); }
function getItemQty(item){ const q=parseInt(item.qty,10); return isNaN(q)||q<1?1:q; }
function getProductImage(item){ if(item.image&&typeof item.image==="string"&&item.image.trim()!=="") return item.image; return "images/noimg.jpg"; }
function saveCart(){ localStorage.setItem("cart",JSON.stringify(cart)); }
function getCartTotalQty(){ return cart.reduce((s,i)=>s+getItemQty(i),0); }
function formatArabicDate(date){ const d=date instanceof Timestamp?date.toDate():(date?.toDate?date.toDate():new Date(date)); return `${ARABIC_DAYS[d.getDay()]} ${ARABIC_MONTHS[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`; }
function getLocalCustomers(){ try{return JSON.parse(localStorage.getItem(CUSTOMERS_LOCAL_KEY))||[];}catch(e){return [];} }
function saveLocalCustomers(a){ localStorage.setItem(CUSTOMERS_LOCAL_KEY,JSON.stringify(a)); }

/* LANG */
function applyLang(){
  document.documentElement.lang = getLang();
  document.documentElement.dir = getLang() === "en" ? "ltr" : "rtl";
  const btn = document.getElementById("langToggle");
  if(btn) btn.textContent = getLang() === "en" ? "عربي" : "EN";
  const modalBtn = document.getElementById("loginModalLangToggle");
  if(modalBtn) modalBtn.textContent = getLang() === "en" ? "🌐 عربي" : "🌐 EN";
  const overlayBtn = document.getElementById("loginOverlayLangToggle");
  if(overlayBtn) overlayBtn.textContent = getLang() === "en" ? "🌐 عربي" : "🌐 EN";
  const invBlockBtn = document.getElementById("invBlockLangToggle");
  if(invBlockBtn) invBlockBtn.textContent = getLang() === "en" ? "🌐 عربي" : "🌐 EN";
  applyCartLang();
}
document.getElementById("langToggle")?.addEventListener("click",()=>{
  setLang(getLang()==="ar"?"en":"ar");
  applyLang();
  renderCart();
});
document.getElementById("loginModalLangToggle")?.addEventListener("click",()=>{
  setLang(getLang()==="ar"?"en":"ar");
  applyLang();
  renderCart();
});
document.getElementById("loginOverlayLangToggle")?.addEventListener("click",()=>{
  setLang(getLang()==="ar"?"en":"ar");
  applyLang();
  renderCart();
});
document.getElementById("invBlockLangToggle")?.addEventListener("click",()=>{
  setLang(getLang()==="ar"?"en":"ar");
  applyLang();
});

/* AUTH */
function loadSession(){
  const s=localStorage.getItem(SESSION_KEY);
  if(s){try{const d=JSON.parse(s);currentCustomer={id:d.id,name:d.name,branch:d.branch||"",accountType:d.accountType||"",permissions:d.permissions||{}};currentCustomerPin=d.pin||"";updateAuthUI();if(currentCustomer.accountType!=="جرد مخزون")showCart();}catch(e){currentCustomer=null;}}
}
function saveSession(c,p){
  currentCustomer=c;currentCustomerPin=p||"";
  localStorage.setItem(SESSION_KEY,JSON.stringify({id:c.id,name:c.name,branch:c.branch||"",pin:currentCustomerPin,accountType:c.accountType||"",permissions:c.permissions||{}}));
  updateAuthUI();if(currentCustomer.accountType!=="جرد مخزون")showCart();
}
function clearSession(){ currentCustomer=null;currentCustomerPin="";localStorage.removeItem(SESSION_KEY);updateAuthUI();hideCart(); }
async function refreshCustomerFromFirestore(){
  if(!currentCustomer||!currentCustomer.id)return;
  try{
    const snap=await getDoc(doc(db,"customers",currentCustomer.id));
    if(snap.exists()){
      const d=snap.data();
      currentCustomer.branch=d.branch||"";
      currentCustomer.accountType=d.accountType||"";
      currentCustomer.permissions=d.permissions||{};
      localStorage.setItem(SESSION_KEY,JSON.stringify({id:currentCustomer.id,name:currentCustomer.name,branch:currentCustomer.branch,pin:currentCustomerPin,accountType:currentCustomer.accountType,permissions:currentCustomer.permissions}));
      updateAuthUI();
    }
  }catch(e){console.warn("Customer refresh failed:",e);}
}
function updateAuthUI(){
  const blockOverlay=document.getElementById("inventoryBlockOverlay");
  if(currentCustomer){
    if(loginBtn)loginBtn.style.display="none";
    if(userProfile)userProfile.style.display="inline-flex";
    document.getElementById("loggedInUser").textContent=currentCustomer.name;
    document.getElementById("profileName").textContent=currentCustomer.name;
    document.getElementById("profileType").textContent=currentCustomer.accountType||"غير محدد";
    document.getElementById("profileAvatar").textContent=(currentCustomer.name||"?")[0];
    if(currentCustomer.accountType==="جرد مخزون"){
      if(blockOverlay)blockOverlay.style.display="";
      if(loginRequiredOverlay)loginRequiredOverlay.classList.add("hidden");
      if(cartMain)cartMain.style.display="none";
      if(cartCategoryFilter)cartCategoryFilter.style.display="none";
    }else{
      if(blockOverlay)blockOverlay.style.display="none";
    }
  }else{
    if(loginBtn)loginBtn.style.display="inline-flex";
    if(userProfile)userProfile.style.display="none";
    if(blockOverlay)blockOverlay.style.display="none";
  }
}
function showCart(){
  if(loginRequiredOverlay)loginRequiredOverlay.classList.add("hidden");
  if(cartMain)cartMain.style.display="";
  if(cartCategoryFilter)cartCategoryFilter.style.display="";
  applyPermissions();renderCart();
}
function hideCart(){
  if(loginRequiredOverlay)loginRequiredOverlay.classList.remove("hidden");
  if(cartMain)cartMain.style.display="none";
  if(cartCategoryFilter)cartCategoryFilter.style.display="none";
}

/* PERMISSIONS */
const CATEGORY_PERMISSIONS={"جرد مخزون":["قسم المعمل","قسم السوبرماركت","قسم محلات الجملة","قسم المستودع","احتياجات المعمل"],"حساب فرع":["قسم المعمل","قسم السوبرماركت","قسم محلات الجملة","قسم المستودع","احتياجات المعمل"]};
function getAllowedCategories(){
  if(!currentCustomer)return[];
  const perms=currentCustomer.permissions;
  if(perms&&typeof perms==='object'&&Object.keys(perms).length>0){
    const active=Object.keys(perms).filter(k=>perms[k]);
    const cartCats=new Set(cart.filter(i=>i.category).map(i=>i.category));
    const matched=active.filter(c=>cartCats.has(c));
    if(matched.length>0)return matched;
  }
  const storedMeta=(()=>{try{return JSON.parse(localStorage.getItem("simsim_cat_meta"))||{};}catch(e){return{};}})();
  const dynamicPerms=storedMeta._defaultPerms||CATEGORY_PERMISSIONS;
  const defaults=dynamicPerms[currentCustomer.accountType||""]||[];
  if(defaults.length>0){
    const cartCats=new Set(cart.filter(i=>i.category).map(i=>i.category));
    const matched=defaults.filter(d=>cartCats.has(d));
    if(matched.length>0)return matched;
  }
  return [...new Set(cart.filter(i=>i.category).map(i=>i.category))];
}
function applyPermissions(){
  const allowed=getAllowedCategories();
  document.querySelectorAll("#cartCategoryFilter .cat-card").forEach(c=>{
    const cat=c.dataset.cat;
    if(cat==="all"){c.style.display="";return;}
    c.style.display=allowed.includes(cat)?"":"none";
  });
}

/* LOGIN (FIXED: fetches from Firestore) */
async function loadCustomersFromFirestore(){
  customersCache=getLocalCustomers();
  try{
    const snap=await getDocs(collection(db,"customers"));
    const fc=snap.docs.map(d=>({id:d.id,...d.data()}));
    const ids=new Set(customersCache.map(c=>c.id));
    const names=new Set(customersCache.map(c=>String(c.name||"").trim().toLowerCase()));
    let changed=false;
    fc.forEach(f=>{
      const fn=String(f.name||"").trim().toLowerCase();
      const byId=customersCache.find(c=>c.id===f.id);
      const byName=customersCache.find(c=>String(c.name||"").trim().toLowerCase()===fn);
      if(byId){Object.assign(byId,f);}
      else if(byName){Object.assign(byName,f);}
      else{customersCache.push(f);changed=true;}
    });
    saveLocalCustomers(customersCache);
  }catch(e){console.warn("Firestore sync failed:",e);}
}
function openLoginModal(){
  if(!loginModal)return;
  loginModal.hidden=false;loginModal.setAttribute("aria-hidden","false");
  if(loginAccountType)loginAccountType.value="";
  if(loginNameInput){loginNameInput.style.display="none";loginNameInput.value="";}
  if(loginPinInput){loginPinInput.style.display="none";loginPinInput.value="";}
  if(loginSubmitBtn)loginSubmitBtn.style.display="none";
  if(loginError)loginError.textContent="";
  requestAnimationFrame(()=>loginModal.classList.add("active"));
  loadCustomersFromFirestore();
}
function closeLoginModal(){if(!loginModal)return;loginModal.classList.remove("active");loginModal.setAttribute("aria-hidden","true");setTimeout(()=>{loginModal.hidden=true;},200);}
function populateCustomerDropdown(at){
  if(!loginNameInput)return;
  loginNameInput.innerHTML='<option value="">-- اختر الاسم --</option>';
  let f=customersCache;if(at)f=customersCache.filter(c=>(c.accountType||"")===at);
  [...f].sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"ar")).forEach(c=>{const o=document.createElement("option");o.value=c.name;o.textContent=c.name;loginNameInput.appendChild(o);});
}
loginAccountType?.addEventListener("change",function(){if(this.value){populateCustomerDropdown(this.value);if(loginNameInput)loginNameInput.style.display="block";if(loginPinInput)loginPinInput.style.display="none";if(loginSubmitBtn)loginSubmitBtn.style.display="none";}else{if(loginNameInput)loginNameInput.style.display="none";if(loginPinInput)loginPinInput.style.display="none";if(loginSubmitBtn)loginSubmitBtn.style.display="none";}});
loginNameInput?.addEventListener("change",function(){if(this.value){if(loginPinInput)loginPinInput.style.display="block";if(loginSubmitBtn)loginSubmitBtn.style.display="block";}else{if(loginPinInput)loginPinInput.style.display="none";if(loginSubmitBtn)loginSubmitBtn.style.display="none";}});
loginPinInput?.addEventListener("keydown",e=>{if(e.key==="Enter")loginSubmitBtn?.click();});
loginSubmitBtn?.addEventListener("click",()=>{
  if(loginError)loginError.textContent="";
  const name=loginNameInput?.value.trim()||"";
  const pin=loginPinInput?.value.trim()||"";
  const at=loginAccountType?.value||"";
  if(!at){loginError.textContent=t("selectAccountType");return;}
  if(!name){loginError.textContent=t("selectNameErr");return;}
  if(!pin){loginError.textContent=t("enterPin");return;}
  const match=customersCache.find(c=>String(c.name||"").trim().toLowerCase()===name.trim().toLowerCase());
  if(!match){loginError.textContent=t("accountNotFound");return;}
    if(String(match.pin)===pin){saveSession({id:match.id,name:match.name,branch:match.branch||"",accountType:match.accountType||at,permissions:match.permissions||{}},pin);closeLoginModal();}
  else{loginError.textContent=t("wrongPassword");}
});
document.getElementById("loginRequiredBtn")?.addEventListener("click",openLoginModal);
loginBtn?.addEventListener("click",openLoginModal);
document.getElementById("loginModalClose")?.addEventListener("click",closeLoginModal);
loginModal?.addEventListener("click",e=>{if(e.target===loginModal)closeLoginModal();});

/* PROFILE */
const profileToggle=document.getElementById("profileToggle");
const profileDropdown=document.getElementById("profileDropdown");
profileToggle?.addEventListener("click",e=>{e.stopPropagation();profileDropdown?.classList.toggle("show");});
document.addEventListener("click",e=>{if(profileDropdown?.classList.contains("show")&&!profileDropdown.contains(e.target)&&e.target!==profileToggle)profileDropdown.classList.remove("show");});
document.getElementById("profileLogoutBtn")?.addEventListener("click",()=>{profileDropdown?.classList.remove("show");if(confirm("هل تريد تسجيل الخروج؟"))clearSession();});
document.getElementById("profileTogglePin")?.addEventListener("click",()=>{const el=document.getElementById("profilePin");if(!el)return;const lbl=document.getElementById("profileTogglePin")?.querySelector("span");if(el.textContent==="****"){el.textContent=currentCustomerPin||"N/A";if(lbl)lbl.textContent="إخفاء";}else{el.textContent="****";if(lbl)lbl.textContent="إظهار";}});
document.getElementById("profileChangePinBtn")?.addEventListener("click",async()=>{profileDropdown?.classList.remove("show");const np=prompt("كلمة المرور الجديدة:");if(!np){alert("الرجاء إدخال كلمة المرور");return;}currentCustomerPin=np;const s=JSON.parse(localStorage.getItem(SESSION_KEY)||"{}");s.pin=np;localStorage.setItem(SESSION_KEY,JSON.stringify(s));try{const{doc:d,updateDoc}=await import("https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js");const{db:dbRef}=await import("./firebase.js");await updateDoc(d(dbRef,"customers",currentCustomer.id),{pin:np});}catch(e){}alert("تم تغيير كلمة المرور");});
document.getElementById("profileInvoicesBtn")?.addEventListener("click",()=>{profileDropdown?.classList.remove("show");openInvoicesModal();});

/* INVOICES MODAL */
function openInvoicesModal(){if(!invoicesModal)return;invoicesModal.hidden=false;invoicesModal.setAttribute("aria-hidden","false");if(invoicesList)invoicesList.innerHTML=`<div class="loading-text">${t("loadingInvoices")}</div>`;document.getElementById("invoicesSubtitle").textContent=`${t("customer")}: ${currentCustomer?.name||""}`;requestAnimationFrame(()=>invoicesModal.classList.add("active"));loadCustomerInvoices();}
function closeInvoicesModal(){if(!invoicesModal)return;invoicesModal.classList.remove("active");invoicesModal.setAttribute("aria-hidden","true");setTimeout(()=>{invoicesModal.hidden=true;},200);}
async function loadCustomerInvoices(){
  if(!currentCustomer||!invoicesList)return;
  try{const{collection:col,query:q,where:wh,orderBy:ob,getDocs:gd}=await import("https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js");const{db:d}=await import("./firebase.js");
  let snap;try{snap=await gd(q(col(d,"invoices"),wh("customerId","==",currentCustomer.id),ob("createdAt","desc")));}catch(e){snap=await gd(q(col(d,"invoices"),wh("customerId","==",currentCustomer.id)));}
  if(snap.empty){invoicesList.innerHTML='<div class="empty-text">لا توجد فواتير</div>';return;}
  invoicesList.innerHTML="";
  snap.forEach(doc=>{const inv=doc.data();const div=document.createElement("div");div.className="invoice-history-card";
  div.innerHTML=`<div class="invoice-history-top"><strong class="invoice-history-no">${escapeHTML(inv.branchName||inv.invoiceNo||"")}</strong><span class="invoice-history-date">${inv.date||""}</span></div><div class="invoice-history-items">${escapeHTML((inv.items||[]).slice(0,3).map(i=>i.name).join("، "))}</div><div class="invoice-history-footer"><span>المنتجات: ${inv.totalItems||0} | الكمية: ${inv.totalQty||0}</span><button class="inv-pdf-btn" type="button"><i data-lucide="download"></i><span>PDF</span></button></div>`;
  div.querySelector(".inv-pdf-btn")?.addEventListener("click",e=>{e.stopPropagation();generateInvoicePdf(inv);});
  div.addEventListener("click",()=>openInvoiceDetail(inv));invoicesList.appendChild(div);});
  }catch(e){invoicesList.innerHTML='<div class="error-text">حدث خطأ</div>';}
}
function openInvoiceDetail(inv){
  if(!invoiceDetailModal||!invoiceDetailContent)return;
  let h=`<div style="text-align:center;margin-bottom:14px;"><img src="images/logo.png" style="width:80px;height:auto;margin:0 auto 6px;" onerror="this.style.display='none'"><h2 style="color:var(--dark);">${t("invoiceDetails")}</h2></div>`;
  h+=`<div class="invoice-detail-meta"><div><span>${t("invoiceNum")}</span><strong>${escapeHTML((inv.invoiceNo||"").replace("INV-",""))}</strong></div><div><span>${t("customer")}</span><strong>${escapeHTML(inv.customerName||"")}</strong></div><div><span>${t("date")}</span><strong>${escapeHTML(inv.date||"")}</strong></div></div>`;
  h+=`<table class="invoice-detail-table"><thead><tr><th>#</th><th>${getLang()==="en"?"Item":"المنتج"}</th><th>KOD</th><th>${getLang()==="en"?"Qty":"الكمية"}</th></tr></thead><tbody>`;
  (inv.items||[]).forEach((it,i)=>{const desc=it.description||"";const ar=it.name||"";h+=`<tr><td>${i+1}</td><td>${escapeHTML(desc)}${ar?`<br><span style="font-size:11px;color:#888;">${escapeHTML(ar)}</span>`:""}</td><td>${escapeHTML(it.code||"")}</td><td>${getItemQty(it)}</td></tr>`;});
  h+=`</tbody></table><div class="invoice-detail-summary"><span>${t("products")}: ${inv.totalItems||0}</span><span>${t("qty")}: ${inv.totalQty||0}</span></div>`;
  h+=`<div style="text-align:center;margin-top:14px;"><button onclick="document.getElementById('invoiceDetailModal').classList.remove('active');document.getElementById('invoiceDetailModal').hidden=true;" style="padding:10px 24px;border:none;border-radius:10px;background:rgba(122,102,85,.1);color:var(--dark);font-weight:700;cursor:pointer;">${t("close")}</button></div>`;
  invoiceDetailContent.innerHTML=h;
  invoiceDetailModal.hidden=false;invoiceDetailModal.setAttribute("aria-hidden","false");
  requestAnimationFrame(()=>invoiceDetailModal.classList.add("active"));
}
document.getElementById("invoicesModalClose")?.addEventListener("click",closeInvoicesModal);
document.getElementById("invoicesCloseBtn")?.addEventListener("click",closeInvoicesModal);
invoicesModal?.addEventListener("click",e=>{if(e.target===invoicesModal)closeInvoicesModal();});
document.getElementById("invoiceDetailClose")?.addEventListener("click",()=>{if(invoiceDetailModal){invoiceDetailModal.classList.remove("active");invoiceDetailModal.setAttribute("aria-hidden","true");setTimeout(()=>{invoiceDetailModal.hidden=true;},200);}});
invoiceDetailModal?.addEventListener("click",e=>{if(e.target===invoiceDetailModal){invoiceDetailModal.classList.remove("active");invoiceDetailModal.setAttribute("aria-hidden","true");setTimeout(()=>{invoiceDetailModal.hidden=true;},200);}});

/* CART RENDER */
function getFilteredCart(){if(cartCategory==="all")return cart;return cart.filter(i=>(i.category||"")===cartCategory);}
function buildCartCatCards(){
  const filter=document.getElementById("cartCategoryFilter");if(!filter)return;
  const cats=[...new Set(cart.filter(i=>i.category).map(i=>i.category))];
  filter.innerHTML=`<button type="button" class="cat-card" data-cat="all"><span class="cat-badge" data-cat-count="all" style="display:none;">0</span><span class="cat-label" data-i18n-cat="all">${t("all")}</span></button>`;
  filter.querySelector(".cat-card[data-cat='all']").addEventListener("click",function(){
    filter.querySelectorAll(".cat-card").forEach(c=>c.classList.remove("active"));
    this.classList.add("active");cartCategory="all";renderCart();
  });
  cats.forEach(cat=>{
    const btn=document.createElement("button");btn.type="button";btn.className="cat-card";btn.dataset.cat=cat;
    btn.innerHTML=`<span class="cat-badge" data-cat-count="${cat}" style="display:none;">0</span><span class="cat-label" data-i18n-cat="${cat}">${catLabel(cat)}</span>`;
    btn.addEventListener("click",()=>{
      filter.querySelectorAll(".cat-card").forEach(c=>c.classList.remove("active"));
      btn.classList.add("active");cartCategory=btn.dataset.cat;renderCart();
    });
    filter.appendChild(btn);
  });
  filter.querySelector(".cat-card[data-cat='all']")?.classList.add("active");
  applyPermissions();
  // Restore active filter
  filter.querySelectorAll(".cat-card").forEach(c=>{
    c.classList.toggle("active", c.dataset.cat === cartCategory);
  });
}

function renderCart(){
  buildCartCatCards();
  if(!cartItems)return;
  cartItems.innerHTML="";
  const sv=cartSearch?cartSearch.value.trim().toLowerCase():"";
  let vis=0;
  getFilteredCart().forEach(item=>{
    const pt=`${item.name||""} ${item.description||""} ${item.code||""}`.toLowerCase();
    if(sv&&!pt.includes(sv))return;
    vis++;
    cartItems.insertAdjacentHTML("beforeend",`<div class="cart-item"><img src="${escapeHTML(getProductImage(item))}" alt="${escapeHTML(item.description||"")}" onerror="this.src='images/noimg.jpg'"><div class="info"><h3>${escapeHTML(item.description||"")}</h3><p class="product-name-ar">${escapeHTML(item.name||"")}</p><p style="font-size:12px;color:var(--v2-text-muted);">SKU: ${escapeHTML(item.code||"")} | ${escapeHTML(item.category||"")}</p><div class="qty-controls"><button type="button" data-action="decrease" data-id="${escapeHTML(item.id)}" aria-label="-"><i data-lucide="minus"></i></button><input type="number" min="1" value="${getItemQty(item)}" class="qty-input" data-id="${escapeHTML(item.id)}"><button type="button" data-action="increase" data-id="${escapeHTML(item.id)}" aria-label="+"><i data-lucide="plus"></i></button></div></div><button type="button" class="delete-cart-item" data-action="delete" data-id="${escapeHTML(item.id)}"><i data-lucide="trash-2"></i><span>${t("deleteBtn")}</span></button></div>`);
  });
  if(cart.length===0)cartItems.innerHTML=`<div class="cart-item"><div class="info"><h3>${t("cartEmpty")}</h3></div></div>`;
  else if(vis===0)cartItems.innerHTML=`<div class="cart-item"><div class="info"><h3>${t("noResults")}</h3></div></div>`;
  if(cartTotal)cartTotal.textContent=getCartTotalQty();
  // Update mobile invoice modal total
  const invModalTotal=document.getElementById("invoiceModalTotal");
  if(invModalTotal)invModalTotal.textContent=getCartTotalQty();
  saveCart();
  loadCategoryCounts();
}
function findItem(id){return cart.find(i=>String(i.id)===String(id));}
function increaseQty(id){const i=findItem(id);if(!i)return;i.qty=getItemQty(i)+1;renderCart();}
function decreaseQty(id){const i=findItem(id);if(!i)return;i.qty=getItemQty(i)-1;if(i.qty<=0)cart=cart.filter(p=>String(p.id)!==String(id));renderCart();}
function updateQty(id,v){const i=findItem(id);if(!i)return;const q=parseInt(v,10);i.qty=isNaN(q)||q<1?1:q;renderCart();}
function deleteItem(id){cart=cart.filter(p=>String(p.id)!==String(id));renderCart();}

/* CART CATEGORY FILTER - handlers attached dynamically in buildCartCatCards() */

/* CLEAR CART */
function isClearCartConfirmed(){return confirmClearInput&&confirmClearInput.value.trim().toLowerCase()==="yes";}
function openClearCartModal(){if(cart.length===0){alert("السلة فارغة");return;}if(!clearCartModal||!confirmClearInput||!confirmClearCartButton)return;confirmClearInput.value="";confirmClearCartButton.disabled=true;clearCartModal.classList.add("active");clearCartModal.setAttribute("aria-hidden","false");setTimeout(()=>confirmClearInput.focus(),50);}
function closeClearCartModal(){if(!clearCartModal)return;clearCartModal.classList.remove("active");clearCartModal.setAttribute("aria-hidden","true");if(confirmClearInput)confirmClearInput.value="";if(confirmClearCartButton)confirmClearCartButton.disabled=true;}
function clearCart(){cart=[];saveCart();renderCart();closeClearCartModal();}

/* INVOICE */
function makeInvoiceNumber(){let c=1;try{const v=localStorage.getItem(INV_COUNTER_KEY);if(v)c=parseInt(v,10)||1;}catch(e){}const n=String(c).padStart(4,"0");localStorage.setItem(INV_COUNTER_KEY,String(c+1));return`INV-${n}`;}
function formatInvoiceDate(){return new Date().toLocaleString("en-GB",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hour12:false});}
function createInvoiceCells(item){const desc=item.description||"";const arName=item.name||"";return `<td class="invoice-check-cell"></td><td class="invoice-product-cell"><div class="invoice-product-main"><span class="invoice-product-number invoice-product-qty">${getItemQty(item)}</span><strong><bdi>${escapeHTML(desc)}</bdi></strong><span class="invoice-check-box"></span></div>${arName?`<div class="invoice-product-details" dir="rtl"><bdi>${escapeHTML(arName)}</bdi></div>`:""}</td>`;}
function createEmptyCells(){return '<td class="invoice-check-cell invoice-empty-cell"></td><td class="invoice-product-cell invoice-empty-cell"></td>';}
function createNonCartCell(item){const desc=item.description||"";const arName=item.name||"";return `<td style="padding:2px 4px;font-size:10px;font-weight:800;color:#111;border:1px solid #222;text-align:left;line-height:1.3;"><bdi>${escapeHTML(desc)}</bdi>${arName?`<br><span style="font-size:10px;color:#333;font-weight:600;"><bdi>${escapeHTML(arName)}</bdi></span>`:""}</td><td style="padding:2px 4px;border:1px solid #222;text-align:center;font-size:10px;white-space:nowrap;vertical-align:middle;">&nbsp;</td>`;}
function createEmptyNonCartCell(){return '<td style="padding:2px 4px;border:1px solid #222;"></td><td style="padding:2px 4px;border:1px solid #222;"></td>';}
function createInvoiceRowsFromCart(){
  let items = [...cart];
  const groups = {};
  items.forEach(it => {
    const cat = it.category || "Other";
    if(!groups[cat]) groups[cat] = [];
    groups[cat].push(it);
  });
  const rows = [];
  const processed = new Set();
  CAT_ORDER.forEach(cat => {
    const group = groups[cat];
    if(!group || group.length === 0) return;
    rows.push({ type: "header", catName: getCatMetaObj(cat).nameEn || CAT_EN_NAMES[cat] || cat });
    for(let i = 0; i < group.length; i += COLUMNS_PER_INVOICE_ROW){
      rows.push({ type: "items", items: group.slice(i, i + COLUMNS_PER_INVOICE_ROW) });
    }
    processed.add(cat);
  });
  // Remaining categories not in CAT_ORDER
  Object.keys(groups).forEach(cat => {
    if(processed.has(cat)) return;
    const group = groups[cat];
    rows.push({ type: "header", catName: getCatMetaObj(cat).nameEn || cat });
    for(let i = 0; i < group.length; i += COLUMNS_PER_INVOICE_ROW){
      rows.push({ type: "items", items: group.slice(i, i + COLUMNS_PER_INVOICE_ROW) });
    }
  });
  return rows;
}
function renderInvoiceRows(rows){
  if(!invoiceProducts) return;
  invoiceProducts.innerHTML = "";
  rows.forEach(ri => {
    if(ri.type === "header"){
      invoiceProducts.insertAdjacentHTML("beforeend", `<tr><td colspan="6" style="background:#d9d9d9;color:#111;border:1px solid #222;padding:6px 8px;font-size:14px;font-weight:900;text-align:center;">${ri.catName}</td></tr>`);
    } else if(ri.type === "items"){
      let h = "";
      (ri.items || []).forEach(it => { h += createInvoiceCells(it); });
      for(let e = (ri.items||[]).length; e < COLUMNS_PER_INVOICE_ROW; e++) h += createEmptyCells();
      invoiceProducts.insertAdjacentHTML("beforeend", `<tr>${h}</tr>`);
    }
  });
}
function setFooterVisible(v){const s=invoiceTemplate?.querySelector(".invoice-summary-row");const d=invoiceTemplate?.querySelector(".invoice-delivery-info");const ds=v?"":"none";if(s)s.style.display=ds;if(d)d.style.display=ds;}
function getMaxHeight(){const w=invoiceTemplate?invoiceTemplate.scrollWidth:1120;return Math.floor(w*(A4_HEIGHT_MM/A4_WIDTH_MM))-24;}
function splitPages(rows){const pages=[];const mh=getMaxHeight();let s=0;while(s<rows.length){let e=s+1;let lg=e;while(e<=rows.length){renderInvoiceRows(rows.slice(s,e));setFooterVisible(e===rows.length);if(invoiceTemplate.scrollHeight<=mh){lg=e;e++;}else break;}pages.push(rows.slice(s,lg));s=lg;}return pages;}
function waitForImages(c){return Promise.all(Array.from(c.querySelectorAll("img")).map(i=>new Promise(r=>{if(i.complete){r();return;}i.onload=()=>r();i.onerror=()=>r();setTimeout(r,2000);})));}
function renderNonCartRows(rows){
  const tbody=document.getElementById("nonCartProducts");
  if(!tbody)return;
  tbody.innerHTML="";
  rows.forEach(ri=>{
    if(ri.type==="header"){
      tbody.insertAdjacentHTML("beforeend",`<tr><td colspan="6" style="background:#d9d9d9;color:#111;border:1px solid #222;padding:4px 6px;font-size:12px;font-weight:900;text-align:center;">${ri.catName}</td></tr>`);
    }else if(ri.type==="items"){
      let h="";
      (ri.items||[]).forEach(it=>{h+=createNonCartCell(it);});
      for(let e=(ri.items||[]).length;e<3;e++)h+=createEmptyNonCartCell();
      tbody.insertAdjacentHTML("beforeend",`<tr>${h}</tr>`);
    }
  });
}
function setInvoiceMainVisible(v){
  const t=document.getElementById("invoiceTable");if(t)t.style.display=v?"":"none";
  const s=invoiceTemplate?.querySelector(".invoice-summary-row");if(s)s.style.display=v?"":"none";
  const d=invoiceTemplate?.querySelector(".invoice-delivery-info");if(d)d.style.display=v?"":"none";
}
function setTitleMode(stock){
  const m=document.getElementById("invoiceTitleMain");
  const st=document.getElementById("invoiceTitleStock");
  if(m)m.style.display=stock?"none":"";
  if(st)st.style.display=stock?"":"none";
}
function setSupervisorVisible(v){const s=document.getElementById("nonCartSupervisor");if(s)s.style.display=v?"grid":"none";}
function getNonCartHeight(){const w=invoiceTemplate?invoiceTemplate.scrollWidth:1120;return Math.floor(w*(A4_HEIGHT_MM/A4_WIDTH_MM))-24;}
function splitNonCartPages(rows){
  const pages=[];const mh=getNonCartHeight();let s=0;
  const nc=document.getElementById("nonCartSection");
  if(!nc)return pages;
  setInvoiceMainVisible(false);
  setTitleMode(true);
  nc.style.display="block";
  setSupervisorVisible(false);
  while(s<rows.length){
    let e=s+1;let lg=e;
    while(e<=rows.length){
      renderNonCartRows(rows.slice(s,e));
      setSupervisorVisible(e===rows.length);
      if(invoiceTemplate.scrollHeight<=mh){lg=e;e++;}else break;
    }
    renderNonCartRows(rows.slice(s,lg));
    pages.push(rows.slice(s,lg));
    s=lg;
  }
  renderNonCartRows(rows.slice(0,0));
  setSupervisorVisible(false);
  nc.style.display="none";
  setInvoiceMainVisible(true);
  setTitleMode(false);
  return pages;
}
function createNonCartRowsFromProducts(allProducts,cartIds){
  const cartIdSet=new Set(cartIds.map(id=>String(id)));
  const nonCart=allProducts.filter(p=>!cartIdSet.has(String(p.id)));
  const groups={};
  nonCart.forEach(p=>{
    const cat=p.category||"Other";
    if(!groups[cat])groups[cat]=[];
    if(p.name||p.description)groups[cat].push(p);
  });
  const rows=[];
  const processed=new Set();
  CAT_ORDER.forEach(cat=>{
    const grp=groups[cat];
    if(!grp||grp.length===0)return;
    rows.push({type:"header",catName:getCatMetaObj(cat).nameEn||CAT_EN_NAMES[cat]||cat});
    for(let i=0;i<grp.length;i+=3)rows.push({type:"items",items:grp.slice(i,i+3)});
    processed.add(cat);
  });
  Object.keys(groups).forEach(cat=>{
    if(processed.has(cat))return;
    const grp=groups[cat];
    rows.push({type:"header",catName:getCatMetaObj(cat).nameEn||cat});
    for(let i=0;i<grp.length;i+=3)rows.push({type:"items",items:grp.slice(i,i+3)});
  });
  return rows;
}
async function loadAllProducts(){
  try{
    const snap=await getDocs(collection(db,"products"));
    return snap.docs.map(d=>{const x=d.data();return{id:d.id,...x};});
  }catch(e){console.error("Error loading products:",e);return[];}
}

async function saveInvoiceToFirestore(invoiceNo,customerName){
  try{const items=cart.map(it=>({id:it.id,name:it.name||"",description:it.description||"",code:it.code||"",category:it.category||"",image:it.image||"images/noimg.jpg",qty:getItemQty(it)}));const bn=currentCustomer?.branch||"";
  await addDoc(collection(db,"invoices"),{invoiceNo,branchName:bn,customerId:currentCustomer?currentCustomer.id:"guest",customerName,accountType:currentCustomer?(currentCustomer.accountType||""):"",items,totalItems:cart.length,totalQty:getCartTotalQty(),createdAt:serverTimestamp(),date:new Date().toISOString()});
  }catch(e){console.error("Error saving invoice:",e);}
}

async function createInvoice(){
  if(cart.length===0){alert("السلة فارغة");return;}
  if(!currentCustomer){alert("سجل الدخول أولاً");openLoginModal();return;}
  const bn=currentCustomer?.branch||"";
  const no=makeInvoiceNumber();
  document.getElementById("invoiceNo").textContent=no;
  document.getElementById("invoiceDate").textContent=formatInvoiceDate();
  document.getElementById("invoiceCustomer").textContent=currentCustomer.name;
  document.getElementById("invoiceTotal").textContent=cart.length;
  document.getElementById("invoiceQty").textContent=getCartTotalQty();
  const rv=document.getElementById("invRecvBranch");if(rv){const p=bn.split(" - ");rv.textContent=p.length===2?p[1]+" - "+p[0]:bn;}
  const rows=createInvoiceRowsFromCart();const pages=splitPages(rows);
  invoiceTemplate.offsetHeight;
  await waitForImages(invoiceTemplate);
  const allProducts=await loadAllProducts();
  const nonCartRows=createNonCartRowsFromProducts(allProducts,cart.map(it=>it.id));
  const nonCartPages=splitNonCartPages(nonCartRows);
  const pdf=new window.jspdf.jsPDF("P","mm","A4");
  for(let pi=0;pi<pages.length;pi++){
    setTitleMode(false);
    renderInvoiceRows(pages[pi]);setFooterVisible(pi===pages.length-1);
    const canvas=await html2canvas(invoiceTemplate,{scale:2,useCORS:true,backgroundColor:"#ffffff",windowWidth:invoiceTemplate.scrollWidth,windowHeight:invoiceTemplate.scrollHeight});
    const imgData=canvas.toDataURL("image/png");const imgH=Math.min((canvas.height*A4_WIDTH_MM)/canvas.width,A4_HEIGHT_MM);
    if(pi>0)pdf.addPage();pdf.addImage(imgData,"PNG",0,0,A4_WIDTH_MM,imgH);
  }
  for(let pi=0;pi<nonCartPages.length;pi++){
    const nc=document.getElementById("nonCartSection");
    if(nc)nc.style.display="block";
    setInvoiceMainVisible(false);
    setTitleMode(true);
    setSupervisorVisible(pi===nonCartPages.length-1);
    renderNonCartRows(nonCartPages[pi]);
    const th3=invoiceTemplate?.querySelector("#invoiceTable thead");if(th3)th3.style.display="none";
    const canvas=await html2canvas(invoiceTemplate,{scale:2,useCORS:true,backgroundColor:"#ffffff",windowWidth:invoiceTemplate.scrollWidth,windowHeight:invoiceTemplate.scrollHeight});
    const imgData=canvas.toDataURL("image/png");const imgH=Math.min((canvas.height*A4_WIDTH_MM)/canvas.width,A4_HEIGHT_MM);
    pdf.addPage();pdf.addImage(imgData,"PNG",0,0,A4_WIDTH_MM,imgH);
  }
  const nc=document.getElementById("nonCartSection");if(nc)nc.style.display="none";
  setInvoiceMainVisible(true);
  setSupervisorVisible(false);
  setTitleMode(false);
  setFooterVisible(true);
  pdf.save(`${bn}-${no}.pdf`);
  await saveInvoiceToFirestore(no,currentCustomer.name);
}

/* EVENTS */
if(cartItems){
  cartItems.addEventListener("click",e=>{const b=e.target.closest("button[data-action]");if(!b)return;const{action,id}=b.dataset;if(action==="increase")increaseQty(id);if(action==="decrease")decreaseQty(id);if(action==="delete")deleteItem(id);});
  cartItems.addEventListener("change",e=>{const i=e.target.closest(".qty-input");if(i)updateQty(i.dataset.id,i.value);});
}
if(cartSearch)cartSearch.addEventListener("input",renderCart);
if(createInvoiceButton)createInvoiceButton.addEventListener("click",createInvoice);
document.getElementById("whatsappBtn")?.addEventListener("click",()=>window.open("https://chat.whatsapp.com/FQJrlGGpUNoJZUmAv4Eetd?s=sw&p=a&ilr=4","_blank"));
if(clearCartButton)clearCartButton.addEventListener("click",openClearCartModal);

// Mobile: FAB + invoice modal
const invoiceFab=document.getElementById("invoiceFab");
const invoiceModal=document.getElementById("invoiceModal");
const invoiceModalClose=document.getElementById("invoiceModalClose");
const createInvoiceMobile=document.getElementById("createInvoiceMobile");
const whatsappMobile=document.getElementById("whatsappMobile");
const clearCartTopBtn=document.getElementById("clearCartTopBtn");

function openInvoiceModal(){if(!invoiceModal)return;const t=document.getElementById("invoiceModalTotal");if(t)t.textContent=getCartTotalQty();invoiceModal.hidden=false;invoiceModal.setAttribute("aria-hidden","false");requestAnimationFrame(()=>invoiceModal.classList.add("active"));}
function closeInvoiceModal(){if(!invoiceModal)return;invoiceModal.classList.remove("active");invoiceModal.setAttribute("aria-hidden","true");setTimeout(()=>{invoiceModal.hidden=true;},200);}
invoiceFab?.addEventListener("click",openInvoiceModal);
invoiceModalClose?.addEventListener("click",closeInvoiceModal);
invoiceModal?.addEventListener("click",e=>{if(e.target===invoiceModal)closeInvoiceModal();});
createInvoiceMobile?.addEventListener("click",()=>{closeInvoiceModal();createInvoice();});
whatsappMobile?.addEventListener("click",()=>window.open("https://chat.whatsapp.com/FQJrlGGpUNoJZUmAv4Eetd?s=sw&p=a&ilr=4","_blank"));
clearCartTopBtn?.addEventListener("click",openClearCartModal);
if(confirmClearInput&&confirmClearCartButton){confirmClearInput.addEventListener("input",()=>{confirmClearCartButton.disabled=!isClearCartConfirmed();});confirmClearInput.addEventListener("keydown",e=>{if(e.key==="Enter"&&isClearCartConfirmed())clearCart();});}
if(cancelClearCartButton)cancelClearCartButton.addEventListener("click",closeClearCartModal);
if(confirmClearCartButton)confirmClearCartButton.addEventListener("click",()=>{if(isClearCartConfirmed())clearCart();});
if(clearCartModal)clearCartModal.addEventListener("click",e=>{if(e.target===clearCartModal)closeClearCartModal();});
document.addEventListener("keydown",e=>{if(e.key==="Escape"){clearCartModal?.classList.contains("active")&&closeClearCartModal();loginModal?.classList.contains("active")&&closeLoginModal();invoicesModal?.classList.contains("active")&&closeInvoicesModal();if(invoiceDetailModal?.classList.contains("active")){invoiceDetailModal.classList.remove("active");invoiceDetailModal.setAttribute("aria-hidden","true");setTimeout(()=>{invoiceDetailModal.hidden=true;},200);}}});

/* INIT */
function loadCategoryCounts(){
  const counts = {};
  cart.forEach(item => {
    const cat = item.category;
    if(cat) counts[cat] = (counts[cat]||0) + 1;
  });
  document.querySelectorAll("[data-cat-count]").forEach(badge => {
    const cat = badge.getAttribute("data-cat-count");
    if(cat === "all"){
      const total = cart.length;
      badge.textContent = total;
      badge.style.display = total > 0 ? "" : "none";
      return;
    }
    const count = counts[cat] || 0;
    badge.textContent = count;
    badge.style.display = count > 0 ? "" : "none";
  });
}
/* Inventory block overlay */
document.getElementById("invBlockLogoutBtn")?.addEventListener("click",()=>{ clearSession(); });
document.getElementById("invBlockGoInventory")?.addEventListener("click",()=>{ window.location.href="inventory-cart.html"; });

applyLang();
loadSession();
(async function(){ await loadCategoriesFromFirestore(); renderCart(); if(currentCustomer)await refreshCustomerFromFirestore(); })();
