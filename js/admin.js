import { db } from "./firebase.js";
import { generateInvoicePdf } from "./invoice-pdf.js";
import {
  collection, addDoc, getDoc, getDocs, deleteDoc, updateDoc, doc,
  query, where, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import { getLang, setLang, t, catLabel, applyFullLang, applyMenuLang } from "./i18n.js";

let editingId = null;
let allProducts = [];
let allInvoices = [];
let allCustomers = [];

const NEW_CATEGORIES = ["قسم المعمل","قسم السوبرماركت","قسم محلات الجملة","قسم المستودع","احتياجات المعمل"];
const ARABIC_DAYS = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const ARABIC_MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const CAT_EN_NAMES_ADMIN = {"قسم المعمل":"Almamal","قسم السوبرماركت":"AlsuperNarket","قسم محلات الجملة":"Aljumllah","قسم المستودع":"Almstudaa","احتياجات المعمل":"AhtyagatAlmamal"};
const CAT_ORDER_ADMIN = ["قسم المعمل","قسم السوبرماركت","قسم محلات الجملة","قسم المستودع","احتياجات المعمل"];
const CATEGORY_PERMISSIONS={"جرد مخزون":["قسم المعمل","قسم السوبرماركت","قسم محلات الجملة","قسم المستودع","احتياجات المعمل"],"حساب فرع":["قسم المعمل","قسم السوبرماركت","قسم محلات الجملة","قسم المستودع","احتياجات المعمل"]};


const productsTable = document.getElementById("productsTable");
const productsCollection = collection(db,"products");
const invoicesCollection = collection(db,"invoices");
const customersCollection = collection(db,"customers");
const adminsCollection = collection(db,"admins");
const categoriesCollection = collection(db,"categories");

async function loadCategoriesFromFirestore(){
  try{
    const snap=await getDocs(query(categoriesCollection,orderBy("order","asc")));
    if(snap.empty){await seedDefaultCategories();return;}
    CAT_ORDER_ADMIN.length=0;Object.keys(CAT_EN_NAMES_ADMIN).forEach(k=>delete CAT_EN_NAMES_ADMIN[k]);
    snap.forEach(d=>{const d2=d.data();CAT_ORDER_ADMIN.push(d2.nameAr);CAT_EN_NAMES_ADMIN[d2.nameAr]=d2.nameEn||d2.nameAr;});
    // Update CATEGORY_PERMISSIONS — replace old names with current Firestore names
    for(const at in CATEGORY_PERMISSIONS){
      const arr=CATEGORY_PERMISSIONS[at];
      for(let i=0;i<arr.length;i++){
        const metaDoc=snap.docs.find(d=>d.data().nameAr===arr[i]);
        if(!metaDoc){
          // Try to find renamed category by checking if any doc has the previous nameAr
          const allMeta=JSON.parse(localStorage.getItem("simsim_cat_meta"))||{};
          for(const key in allMeta){
            if(key!==arr[i]&&!key.startsWith("_")&&allMeta[key].nameEn&&snap.docs.find(d=>d.data().nameAr===key)){arr[i]=key;break;}
          }
        }
      }
    }
    // Save to localStorage as cache
    const allMeta={};snap.forEach(d=>{const d2=d.data();allMeta[d2.nameAr]={nameEn:d2.nameEn||d2.nameAr,desc:d2.desc||"",showDesc:d2.showDesc!==false};});
    allMeta._catOrder=[...CAT_ORDER_ADMIN];allMeta._catEnNames={...CAT_EN_NAMES_ADMIN};allMeta._defaultPerms=JSON.parse(JSON.stringify(CATEGORY_PERMISSIONS));
    localStorage.setItem("simsim_cat_meta",JSON.stringify(allMeta));
  }catch(e){console.error("loadCategoriesFromFirestore error:",e);
    // Fallback: restore from localStorage
    try{const _m=JSON.parse(localStorage.getItem("simsim_cat_meta"))||{};if(_m._catOrder){CAT_ORDER_ADMIN.length=0;CAT_ORDER_ADMIN.push(..._m._catOrder);}if(_m._catEnNames){Object.keys(CAT_EN_NAMES_ADMIN).forEach(k=>delete CAT_EN_NAMES_ADMIN[k]);Object.keys(_m._catEnNames).forEach(k=>CAT_EN_NAMES_ADMIN[k]=_m._catEnNames[k]);}if(_m._defaultPerms){Object.keys(CATEGORY_PERMISSIONS).forEach(k=>delete CATEGORY_PERMISSIONS[k]);Object.keys(_m._defaultPerms).forEach(k=>CATEGORY_PERMISSIONS[k]=_m._defaultPerms[k]);}}catch(e2){}
  }
}
async function seedDefaultCategories(){
  const snap=await getDocs(categoriesCollection);
  if(!snap.empty)return;
  const defaults=[{nameAr:"قسم المعمل",nameEn:"Lab",order:0,desc:"",showDesc:true},{nameAr:"قسم السوبرماركت",nameEn:"Supermarket",order:1,desc:"",showDesc:true},{nameAr:"قسم محلات الجملة",nameEn:"Wholesale",order:2,desc:"",showDesc:true},{nameAr:"قسم المستودع",nameEn:"Warehouse",order:3,desc:"",showDesc:true},{nameAr:"احتياجات المعمل",nameEn:"Lab Needs",order:4,desc:"",showDesc:true}];
  for(const c of defaults){try{await addDoc(categoriesCollection,c);}catch(e){}}
  // Reload into constants
  CAT_ORDER_ADMIN.length=0;Object.keys(CAT_EN_NAMES_ADMIN).forEach(k=>delete CAT_EN_NAMES_ADMIN[k]);
  defaults.forEach(c=>{CAT_ORDER_ADMIN.push(c.nameAr);CAT_EN_NAMES_ADMIN[c.nameAr]=c.nameEn;});
}

function escapeHTML(v){return String(v??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;");}
function getElement(id){return document.getElementById(id);}
function getInputValue(id){const e=getElement(id);return e?e.value.trim():"";}
function setText(id,v){const e=getElement(id);if(e)e.textContent=v;}
function getProductImage(p){if(p.image&&String(p.image).trim()!=="")return p.image;return "images/noimg.jpg";}
function normalizeText(v){return String(v??"").trim().toLowerCase();}
function isBase64Image(v){return typeof v==="string"&&v.startsWith("data:image/");}
function getExportImageValue(v){if(!v)return"";const i=String(v).trim();if(isBase64Image(i))return"Image stored inside database";if(i.length>32000)return"Image too long";return i;}
function formatArabicDate(date){if(!date)return"";const d=date.toDate?date.toDate():new Date(date);return`${ARABIC_DAYS[d.getDay()]} ${ARABIC_MONTHS[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`;}

/* AUTH */
const AUTH_KEY="sallah_admin_unlocked";
const VERIFIED_KEY="sallah_admin_verified";
const ADMIN_SESSION_KEY="sallah_admin_session";
const LOCAL_ADMIN_KEY="sallah_local_admin";
function getLocalAdmin(){try{const d=localStorage.getItem(LOCAL_ADMIN_KEY);if(d)return JSON.parse(d);}catch(e){}return null;}
function saveLocalAdmin(username,password){try{localStorage.setItem(LOCAL_ADMIN_KEY,JSON.stringify({username,password}));}catch(e){}}
let currentAdminData=null;
let currentAdminDocId=null;
let currentAdminPerms={};
let currentAdminPermsLoaded=false;

function revertToLoginScreen(msg){
  sessionStorage.removeItem(AUTH_KEY);
  document.body.classList.add("admin-locked");
  getElement("adminLoginScreen").hidden=false;
  getElement("adminPanel").hidden=true;
  if(msg){const e=getElement("adminLoginError");if(e)e.textContent=msg;}
  // Keep script tag in DOM so processLogin() works on retry
}
function showAdminPanel(){
  sessionStorage.setItem(AUTH_KEY,"true");
  if(typeof showAdminPanelUI==="function")showAdminPanelUI();
  else{document.body.classList.remove("admin-locked");getElement("adminLoginScreen").hidden=true;getElement("adminPanel").hidden=false;}
}
async function checkAdminAuth(){
  if(sessionStorage.getItem(VERIFIED_KEY)==="true"){
    const savedUser=sessionStorage.getItem(ADMIN_SESSION_KEY);
    if(savedUser&&(!currentAdminData||currentAdminData.username!==savedUser)){
      try{const local=JSON.parse(localStorage.getItem(LOCAL_ADMIN_KEY));if(local&&local.username===savedUser){currentAdminData={username:local.username,password:local.password};currentAdminDocId="local";}}catch(e){}
      if(!currentAdminData)try{const q=query(adminsCollection,where("username","==",savedUser));const snap=await Promise.race([getDocs(q),new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")),15000))]);if(!snap.empty){currentAdminData=snap.docs[0].data();currentAdminDocId=snap.docs[0].id;}}catch(e){}
    }
    return true;
  }
  // Check for pending login from inline script
  return await processLoginInternal();
}
async function processLoginInternal(){
  const la=sessionStorage.getItem("admin_login_attempt");
  if(!la){revertToLoginScreen("");return false;}
  const{username,password}=JSON.parse(la);sessionStorage.removeItem("admin_login_attempt");
  // 1) Try localStorage cache first (instant)
  const local=getLocalAdmin();
  if(local&&local.username===username&&local.password===password){
    currentAdminData={username:local.username,password:local.password};currentAdminDocId="local";
    sessionStorage.setItem(VERIFIED_KEY,"true");sessionStorage.setItem(ADMIN_SESSION_KEY,username);
    showAdminPanel();return true;
  }
  // 2) Fall back to Firestore with timeout
  try{
    const q=query(adminsCollection,where("username","==",username));
    const snap=await Promise.race([getDocs(q),new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")),15000))]);
    if(!snap.empty){const a=snap.docs[0];const d=a.data();if(d.password===password){currentAdminData=d;currentAdminDocId=a.id;sessionStorage.setItem(VERIFIED_KEY,"true");sessionStorage.setItem(ADMIN_SESSION_KEY,username);saveLocalAdmin(d.username||username,d.password||password);showAdminPanel();return true;}}
    revertToLoginScreen(t("adminLoginError"));return false;
  }catch(e){revertToLoginScreen(t("adminConnError"));return false;}
}
window.processLogin=processLoginInternal;
async function seedDefaultAdmin(){try{const s=await Promise.race([getDocs(adminsCollection),new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")),10000))]);if(s.empty)await addDoc(adminsCollection,{username:"admin",password:"admin"});}catch(e){}}

/* TABS */
const loadedTabs={};
async function loadTabContent(name){
  if(loadedTabs[name])return;
  if(name==="customers"&&currentAdminPerms.canManageCustomers===false){
    const sec=document.getElementById("section-customers");if(sec)sec.innerHTML=`<div style="text-align:center;padding:40px 20px;color:#dc3545;font-size:16px;font-weight:700;">🔒 ${t("noCustomerPerm")}</div>`;
    loadedTabs[name]=true;return;
  }
  loadedTabs[name]=true;switch(name){case"products":await loadProducts();break;case"invoices":await loadAllInvoices();break;case"customers":await loadAllCustomers();populateCustBranchDropdown();break;case"branches":renderBranches();break;case"categories":renderCategories();break;}
}
function initTabs(){document.querySelectorAll(".admin-tab").forEach(tab=>{tab.addEventListener("click",function(){document.querySelectorAll(".admin-tab").forEach(t=>t.classList.remove("active"));document.querySelectorAll(".admin-section").forEach(s=>s.classList.remove("active"));this.classList.add("active");const n=this.dataset.tab;const sec=document.getElementById("section-"+n);if(sec)sec.classList.add("active");loadTabContent(n);});});}

/* PRODUCTS */
async function loadProducts(){const snap=await getDocs(productsCollection);allProducts=[];snap.forEach(d=>allProducts.push({id:d.id,...d.data()}));renderProducts(allProducts);updateCategoryBadges();rebuildCatPickCards();renderCategories();try{localStorage.setItem("sallah_products_cache",JSON.stringify(allProducts));}catch(e){}}

function updateCategoryBadges(){
  document.querySelectorAll(".cat-pick-card").forEach(c => {
    const cat = c.dataset.cat;
    const count = allProducts.filter(p => p.category === cat).length;
    const badge = c.querySelector(".cat-pick-badge");
    if(badge) badge.textContent = count;
  });
}

/* CATEGORY PICKER */
let selectedAdminCategory = null;
const categoryPicker = document.getElementById("categoryPicker");
const productFormSection = document.getElementById("productFormSection");
const categorySelect = document.getElementById("category");
const selectedCategoryName = document.getElementById("selectedCategoryName");

function showCategoryPicker(){
  if(categoryPicker) categoryPicker.style.display = "";
  if(productFormSection) productFormSection.style.display = "none";
  selectedAdminCategory = null;
  const catProducts = document.getElementById("categoryProductsSection");
  if(catProducts) catProducts.style.display = "none";
  // Re-render all products
  renderProducts(allProducts);
}
function showProductForm(cat){
  selectedAdminCategory = cat;
  if(categoryPicker) categoryPicker.style.display = "none";
  if(productFormSection) productFormSection.style.display = "";
  if(selectedCategoryName) selectedCategoryName.textContent = catLabel(cat);
  if(categorySelect){ categorySelect.value = cat; }
  // Control save button based on permissions
  const pProds=currentAdminPerms.canAddProducts;
  let canAdd=true;
  if(currentAdminPermsLoaded){
    if(!pProds||Object.keys(pProds).length===0)canAdd=false;
    else canAdd=pProds[cat]===true;
  }
  const saveBtn=getElement("save");
  if(saveBtn)saveBtn.style.display=canAdd?"":"none";
  // Show category products below the form
  renderCategoryProducts(cat);
}

function renderCategoryProducts(cat){
  const section = document.getElementById("categoryProductsSection");
  if(!section) return;
  const list = document.getElementById("categoryProductsList");
  const title = document.getElementById("categoryProductsTitle");
  if(!list) return;
  const catProducts = allProducts.filter(p => p.category === cat);
  if(title) title.textContent = `${t("productsInCategory")} - ${catLabel(cat)} (${catProducts.length})`;
  if(catProducts.length === 0){
    list.innerHTML = `<div class="empty-msg">${t("noProductsInCategory")}</div>`;
  } else {
    list.innerHTML = "";
    catProducts.forEach(p => {
      list.insertAdjacentHTML("beforeend",`<div class="admin-product"><img src="${escapeHTML(getProductImage(p))}" alt="${escapeHTML(p.description||p.name||"")}" onerror="this.src='images/noimg.jpg'"><div class="admin-info"><h3>${escapeHTML(p.description||"")}</h3><p class="product-name-ar">${escapeHTML(p.name||"")}</p><p>SKU: ${escapeHTML(p.code||"")}</p></div><div class="admin-actions"><label class="inv-vis-toggle" title="Show in Inventory Store"><input type="checkbox" class="inv-vis-cb" data-id="${escapeHTML(p.id)}"${p.invVisible!==false?" checked":""}><span>👁</span></label><button class="edit-btn" type="button" onclick="editProduct('${escapeHTML(p.id)}')">${t("editBtn")}</button><button class="delete-btn" type="button" onclick="deleteProduct('${escapeHTML(p.id)}')">${t("deleteBtn")}</button></div></div>`);
    });
    list.querySelectorAll(".inv-vis-cb").forEach(cb => {
      cb.addEventListener("change", function(){
        updateDoc(doc(db,"products",this.dataset.id),{invVisible:this.checked}).catch(()=>{});
      });
    });
  }
  section.style.display = "";
}

document.getElementById("catPickCardsContainer")?.addEventListener("click", e => {
  const btn = e.target.closest(".cat-pick-card");
  if(btn) showProductForm(btn.dataset.cat);
});
getElement("backToCategories")?.addEventListener("click", () => {
  showCategoryPicker();
  clearForm();
  editingId = null;
});

document.querySelectorAll(".admin-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    if(tab.dataset.tab === "products") showCategoryPicker();
  });
});

function renderProducts(products){
  if(!productsTable)return;
  productsTable.innerHTML="";
  const checked = new Set((window.__selectedProducts)||[]);
  products.forEach(p=>{
    const cid = p.id;
    productsTable.insertAdjacentHTML("beforeend",`<div class="admin-product"><label class="prod-check"><input type="checkbox" class="prod-cb" value="${escapeHTML(cid)}"${checked.has(cid)?" checked":""}></label><img src="${escapeHTML(getProductImage(p))}" alt="${escapeHTML(p.description||p.name||"")}" onerror="this.src='images/noimg.jpg'"><div class="admin-info"><h3>${escapeHTML(p.description||"")}</h3><p class="product-name-ar">${escapeHTML(p.name||"")}</p><p>SKU: ${escapeHTML(p.code||"")}</p><p style="color:var(--accent);font-weight:700;">${escapeHTML(catLabel(p.category||""))}</p></div><div class="admin-actions"><label class="inv-vis-toggle" title="Show in Inventory Store"><input type="checkbox" class="inv-vis-cb" data-id="${escapeHTML(cid)}"${p.invVisible!==false?" checked":""}><span>👁</span></label><button class="edit-btn" type="button" onclick="editProduct('${escapeHTML(p.id)}')">${t("editBtn")}</button><button class="delete-btn" type="button" onclick="deleteProduct('${escapeHTML(p.id)}')">${t("deleteBtn")}</button></div></div>`);
  });
  // Re-check checkboxes after re-render
  productsTable.querySelectorAll(".prod-cb").forEach(cb => {
    if(checked.has(cb.value)) cb.checked = true;
    cb.addEventListener("change", updateBulkUI);
  });
  // Visibility toggle listeners
  productsTable.querySelectorAll(".inv-vis-cb").forEach(cb => {
    cb.addEventListener("change", function(){
      const id = this.dataset.id;
      const val = this.checked;
      updateDoc(doc(db,"products",id),{invVisible:val}).catch(()=>{});
    });
  });
  updateBulkUI();
}

getElement("imageFile")?.addEventListener("change",function(){const f=this.files[0];if(!f)return;const r=new FileReader();r.onload=e=>{const pi=getElement("previewImage");if(pi)pi.src=e.target.result;};r.readAsDataURL(f);});

document.getElementById("suggestCodeCheckbox")?.addEventListener("change",function(){
  const codeInput=getElement("code");
  if(!codeInput)return;
  if(this.checked){
    codeInput.value=String(Math.floor(10000+Math.random()*90000));
    codeInput.disabled=true;
  }else{codeInput.disabled=false;}
});

function clearForm(){["name","description","code","image"].forEach(id=>{const e=getElement(id);if(e)e.value="";});const f=getElement("imageFile");if(f)f.value="";const pi=getElement("previewImage");if(pi)pi.src="images/noimg.jpg";const sc=getElement("suggestCodeCheckbox");if(sc){sc.checked=false;}const ci=getElement("code");if(ci)ci.disabled=false;}

function compressImageFile(file){return new Promise((res,rej)=>{const img=new Image();const r=new FileReader();r.onload=e=>{img.onload=()=>{const c=document.createElement("canvas");let w=img.width,h=img.height;if(w>800){h=h*(800/w);w=800;}c.width=w;c.height=h;c.getContext("2d").drawImage(img,0,0,w,h);const d=c.toDataURL("image/jpeg",0.6);if(Math.ceil((d.length*3)/4)>1000000){rej(new Error("Image > 1MB"));return;}res(d);};img.onerror=()=>rej(new Error("Failed to load"));img.src=e.target.result;};r.onerror=()=>rej(new Error("Failed to read"));r.readAsDataURL(file);});}

getElement("save")?.addEventListener("click",async()=>{
  try{const pCat=getInputValue("category");const pProds=currentAdminPerms.canAddProducts;if(currentAdminPermsLoaded&&(!pProds||Object.keys(pProds).length===0||pProds[pCat]!==true)){alert(t("errorSaving"));return;}
  let img=getInputValue("image");const f=getElement("imageFile")?.files[0];if(f)img=await compressImageFile(f);if(!img)img="images/noimg.jpg";
  const p={name:getInputValue("name"),description:getInputValue("description"),code:getInputValue("code"),category:pCat,image:img,invVisible:true,createdAt:Date.now()};
  if(!p.name||!p.code){alert(t("fillRequired"));return;}
  if(editingId){await updateDoc(doc(db,"products",editingId),p);editingId=null;alert(t("productUpdated"));}
  else{await addDoc(productsCollection,p);alert(t("productAdded"));}
  clearForm();await loadProducts();}catch(e){console.error(e);alert(t("errorSaving"));}
});

window.deleteProduct=async function(id){if(!confirm(t("deleteProduct")))return;try{await deleteDoc(doc(db,"products",id));await loadProducts();}catch(e){alert(t("errorOccurredShort"));}};
window.editProduct=function(id){const p=allProducts.find(i=>String(i.id)===String(id));if(!p)return;editingId=id;showProductForm(p.category||"قسم المعمل");getElement("name").value=p.name||"";getElement("description").value=p.description||"";getElement("code").value=p.code||"";getElement("image").value=p.image||"";const pi=getElement("previewImage");if(pi)pi.src=getProductImage(p);window.scrollTo({top:0,behavior:"smooth"});const sc=getElement("suggestCodeCheckbox");if(sc)sc.checked=false;const ci=getElement("code");if(ci)ci.disabled=false;};

getElement("searchAdmin")?.addEventListener("input",function(){const v=normalizeText(this.value);renderProducts(allProducts.filter(p=>normalizeText(`${p.name||""} ${p.description||""} ${p.code||""} ${p.category||""}`).includes(v)));});
getElement("sortNewest")?.addEventListener("click",()=>renderProducts([...allProducts].sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))));
getElement("sortOldest")?.addEventListener("click",()=>renderProducts([...allProducts].sort((a,b)=>(a.createdAt||0)-(b.createdAt||0))));
getElement("sortNameAsc")?.addEventListener("click",()=>renderProducts([...allProducts].sort((a,b)=>String(a.name||"").localeCompare(String(b.name||""),"ar"))));

/* BULK CATEGORY CHANGE */
function getSelectedIds(){
  return Array.from(document.querySelectorAll(".prod-cb:checked")).map(cb => cb.value);
}
function updateBulkUI(){
  const ids = getSelectedIds();
  window.__selectedProducts = new Set(ids);
  const countEl = document.getElementById("selectedCount");
  if(countEl) countEl.textContent = ids.length;
  const btn = document.getElementById("bulkChangeCatBtn");
  const sel = document.getElementById("bulkCategorySelect");
  if(btn) btn.disabled = ids.length === 0 || !sel?.value;
  const allCb = document.getElementById("selectAllCheckbox");
  if(allCb){
    const total = document.querySelectorAll(".prod-cb").length;
    allCb.checked = total > 0 && ids.length === total;
    allCb.indeterminate = ids.length > 0 && ids.length < total;
  }
  const toolbar = document.getElementById("bulkToolbar");
  if(toolbar) toolbar.classList.toggle("has-selection", ids.length > 0);
}
document.getElementById("selectAllCheckbox")?.addEventListener("change", function(){
  document.querySelectorAll(".prod-cb").forEach(cb => cb.checked = this.checked);
  updateBulkUI();
});
document.getElementById("bulkCategorySelect")?.addEventListener("change", updateBulkUI);
document.getElementById("bulkChangeCatBtn")?.addEventListener("click", async function(){
  const ids = getSelectedIds();
  if(ids.length === 0){ alert(t("noProductsSelected")); return; }
  const cat = document.getElementById("bulkCategorySelect")?.value;
  if(!cat){ alert(t("selectCategoryFirst")); return; }
  if(!confirm(`${ids.length} منتج → ${catLabel(cat)}؟`)) return;
  const btn = this;
  btn.disabled = true;
  btn.textContent = "جاري التحديث...";
  let success = 0, fail = 0;
  for(const id of ids){
    try{
      await updateDoc(doc(db, "products", id), { category: cat });
      success++;
    }catch(e){ fail++; }
  }
  btn.textContent = "تغيير القسم";
  btn.disabled = false;
  alert(`تم تحديث ${success} منتج` + (fail ? `, فشل ${fail}` : ""));
  await loadProducts();
  window.__selectedProducts = new Set();
  document.querySelectorAll(".prod-cb").forEach(cb => cb.checked = false);
  const allCb = document.getElementById("selectAllCheckbox");
  if(allCb){ allCb.checked = false; allCb.indeterminate = false; }
  updateBulkUI();
});

/* EXCEL */
function loadXLSXLibrary(){return new Promise((res,rej)=>{if(window.XLSX){res(window.XLSX);return;}const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";s.onload=()=>{if(window.XLSX)res(window.XLSX);else rej(new Error("XLSX not available"));};s.onerror=()=>rej(new Error("Failed to load XLSX"));document.head.appendChild(s);});}
function makeExcelFileName(){const n=new Date();return`products-${n.getFullYear()}${String(n.getMonth()+1).padStart(2,"0")}${String(n.getDate()).padStart(2,"0")}-${String(n.getHours()).padStart(2,"0")}${String(n.getMinutes()).padStart(2,"0")}.xlsx`;}

getElement("importExcel")?.addEventListener("click",async()=>{try{await loadXLSXLibrary();getElement("excelFile")?.click();}catch(e){alert(t("excelLoadError"));}});
getElement("excelFile")?.addEventListener("change",async e=>{const f=e.target.files[0];if(!f)return;try{const XLSX=await loadXLSXLibrary();const d=await f.arrayBuffer();const wb=XLSX.read(d,{type:"array"});const sh=wb.Sheets[wb.SheetNames[0]];const prods=XLSX.utils.sheet_to_json(sh,{defval:""});const snap=await getDocs(productsCollection);let mc=9999;snap.forEach(i=>{const c=parseInt(i.data().code,10);if(!isNaN(c)&&c>mc)mc=c;});let nc=mc+1;const existing=allProducts.map(p=>normalizeText(p.name));let imp=0;for(const p of prods){const pn=normalizeText(p.name);if(!pn||existing.includes(pn))continue;await addDoc(productsCollection,{name:p.name||"",description:p.description||"",code:p.code||String(nc++),category:p.category||"",image:p.image||"images/noimg.jpg",createdAt:Date.now()});imp++;}  e.target.value="";alert(`${imp}${t("productsExported")}`);await loadProducts();}catch(e){alert(t("errorImport"));}});
getElement("exportExcel")?.addEventListener("click",async()=>{const btn=getElement("exportExcel");const orig=btn?btn.innerHTML:"";try{if(btn){btn.disabled=true;btn.textContent=t("importing");}const XLSX=await loadXLSXLibrary();const rows=allProducts.map(p=>[p.name||"",p.description||"",p.code||"",getExportImageValue(p.image),p.category||""]);if(!rows.length){alert(t("noProductsExport"));return;}const ws=XLSX.utils.aoa_to_sheet([["name","description","code","image","category"],...rows]);ws["!cols"]=[{wch:34},{wch:40},{wch:12},{wch:70},{wch:24}];const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Products");XLSX.writeFile(wb,makeExcelFileName(),{compression:true});}catch(e){alert(t("errorExport"));}finally{if(btn){btn.disabled=false;btn.innerHTML=orig;}}});

/* INVOICES */
async function loadAllInvoices(){
  const list=document.getElementById("allInvoicesList");if(!list)return;
  list.innerHTML=`<div class='loading-msg'>${t("loadingInvoicesAdmin")}</div>`;
  try{let snap;try{const q=query(invoicesCollection,orderBy("createdAt","desc"));snap=await getDocs(q);}catch(e){snap=await getDocs(invoicesCollection);}
  allInvoices=[];snap.forEach(d=>allInvoices.push({id:d.id,...d.data()}));renderAllInvoices(allInvoices);
  }catch(e){list.innerHTML=`<div class='empty-msg'>${t("errorOccurred")}</div>`;}
}
function renderAllInvoices(invoices){
  const list=document.getElementById("allInvoicesList");if(!list)return;
  if(!invoices.length){list.innerHTML=`<div class='empty-msg'>${t("noInvoicesAdmin")}</div>`;return;}
  list.innerHTML="";
  invoices.forEach(inv=>{
    const ds=formatArabicDate(inv.createdAt||inv.date);
    let preview="";if(inv.items?.length){preview=inv.items.slice(0,3).map(i=>i.description||i.name).join("، ");if(inv.items.length>3)preview+=`...+${inv.items.length-3}`;}
    let rows="";
    if(inv.items?.length){
      let admItems = [...inv.items];
      const admGroups = {};
      admItems.forEach(it => {
        const cat = it.category || "Other";
        if(!admGroups[cat]) admGroups[cat] = [];
        admGroups[cat].push(it);
      });
      let admIdx = 0;
      CAT_ORDER_ADMIN.forEach(cat => {
        const group = admGroups[cat];
        if(!group || group.length === 0) return;
        rows+=`<tr><td colspan="4" style="background:#d9d9d9;border:1px solid #bbb;padding:6px 10px;font-size:13px;font-weight:900;text-align:center;">${CAT_EN_NAMES_ADMIN[cat]||cat}</td></tr>`;
        group.forEach(it => {
          admIdx++;
          rows+=`<tr><td>${admIdx}</td><td>${escapeHTML(it.description||it.name||"")}</td><td>${escapeHTML(it.code||"")}</td><td>${it.qty||0}</td></tr>`;
        });
      });
      // Remaining categories not in CAT_ORDER_ADMIN
      Object.keys(admGroups).forEach(cat => {
        if(CAT_ORDER_ADMIN.includes(cat)) return;
        const group = admGroups[cat];
        if(!group || group.length === 0) return;
        rows+=`<tr><td colspan="4" style="background:#d9d9d9;border:1px solid #bbb;padding:6px 10px;font-size:13px;font-weight:900;text-align:center;">${cat}</td></tr>`;
        group.forEach(it => {
          admIdx++;
          rows+=`<tr><td>${admIdx}</td><td>${escapeHTML(it.description||it.name||"")}</td><td>${escapeHTML(it.code||"")}</td><td>${it.qty||0}</td></tr>`;
        });
      });
    }
    const dn=inv.branchName||inv.invoiceNo||"";const acc=inv.accountType||"";
    const card=document.createElement("div");card.className="invoice-admin-card";
    card.innerHTML=`<div class="inv-header"><strong>${escapeHTML(dn)}</strong><span>${ds}</span></div><div class="inv-customer">👤 ${escapeHTML(inv.customerName||"")}</div>${acc?`<div style="font-size:11px;color:var(--accent);font-weight:700;margin-bottom:4px;">${escapeHTML(acc)}</div>`:""}<div class="inv-items-preview">${escapeHTML(preview)}</div><div class="inv-footer"><span>${t("products")}: ${inv.totalItems||0}</span><span>${t("qty")}: ${inv.totalQty||0}</span></div><div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;"><button class="inv-toggle-btn" type="button">${t("showDetails")}</button><button class="inv-print-btn" type="button">📥 PDF</button><button class="inv-del-btn" type="button">🗑 ${t("deleteBtn")}</button></div><table class="inv-detail-table"><thead><tr><th>#</th><th>${t("products")}</th><th>KOD</th><th>${t("qty")}</th></tr></thead><tbody>${rows}</tbody></table>`;
    card.querySelector(".inv-toggle-btn").addEventListener("click",()=>{const t2=card.querySelector(".inv-detail-table");t2.classList.toggle("show");card.querySelector(".inv-toggle-btn").textContent=t2.classList.contains("show")?t("hideDetails"):t("showDetails");});
    card.querySelector(".inv-print-btn").addEventListener("click",()=>downloadInvoicePdf(inv));
    card.querySelector(".inv-del-btn").addEventListener("click",()=>openDeleteInvoiceModal(inv.id,dn));
    list.appendChild(card);
  });
}
getElement("invoiceSearch")?.addEventListener("input",function(){const v=normalizeText(this.value);renderAllInvoices(allInvoices.filter(inv=>normalizeText(inv.customerName||"").includes(v)||normalizeText(inv.invoiceNo||"").includes(v)));});

/* CUSTOMERS */
const CUSTOMERS_LOCAL_KEY="sallah_customers_data";
function getLocalCustomers(){try{return JSON.parse(localStorage.getItem(CUSTOMERS_LOCAL_KEY))||[];}catch(e){return[];}}
function saveLocalCustomers(a){localStorage.setItem(CUSTOMERS_LOCAL_KEY,JSON.stringify(a));}
function removeLocalCustomer(id){saveLocalCustomers(getLocalCustomers().filter(c=>c.id!==id));}

async function loadAllCustomers(){
  const list=document.getElementById("allCustomersList");if(!list)return;
  list.innerHTML=`<div class='loading-msg'>${t("loadingCustomers")}</div>`;
  allCustomers=getLocalCustomers();
  try{const snap=await getDocs(customersCollection);const fids=new Set();
   snap.forEach(d=>{fids.add(d.id);const data=d.data();const existing=allCustomers.find(c=>c.id===d.id);if(existing){existing.permissions=data.permissions||{};existing.branch=data.branch||"";}else{const byName=allCustomers.find(c=>String(c.name||"").trim().toLowerCase()===String(data.name||"").trim().toLowerCase());if(byName){byName.id=d.id;byName.permissions=data.permissions||{};byName.branch=data.branch||"";}else{allCustomers.push({id:d.id,name:data.name,pin:data.pin,accountType:data.accountType||"",branch:data.branch||"",permissions:data.permissions||{},createdAt:data.createdAt});}}});
  allCustomers=allCustomers.filter(c=>fids.has(c.id)||String(c.id).startsWith("local_"));
  allCustomers.forEach(c=>{const s=snap.docs.find(dd=>dd.id===c.id);if(s&&!s.data().accountType){try{updateDoc(doc(db,"customers",c.id),{accountType:"جرد مخزون"});c.accountType="جرد مخزون";}catch(e){}}});
  saveLocalCustomers(allCustomers);}catch(e){}
  renderAllCustomers(allCustomers);
}
function renderAllCustomers(customers){
  const list=document.getElementById("allCustomersList");if(!list)return;
  if(!customers.length){list.innerHTML=`<div class='empty-msg'>${t("noCustomers")}</div>`;return;}
  list.innerHTML="";
  customers.forEach(cust=>{
    const ds=cust.createdAt?formatArabicDate(cust.createdAt):"";
    const acc=cust.accountType||"غير محدد";
    const card=document.createElement("div");card.className="customer-admin-card";
    card.innerHTML=`<div class="cust-header"><div style="display:flex;justify-content:space-between;align-items:flex-start;"><strong>👤 ${escapeHTML(cust.name)}</strong><span style="color:#dc3545;font-size:10px;font-weight:700;">${escapeHTML(acc)}</span></div><div style="display:flex;align-items:center;justify-content:space-between;margin-top:2px;"><span style="font-size:11px;color:var(--secondary);font-weight:600;">PIN: ${escapeHTML(cust.pin||"")}</span><button class="cust-action-btn" type="button" style="font-size:16px;padding:2px 10px;border:1px solid var(--accent);border-radius:6px;background:var(--white);color:var(--accent);cursor:pointer;font-weight:700;">▾</button></div></div><div style="font-size:12px;color:var(--secondary);margin-top:4px;">${ds?`${t("registrationDate")} ${ds}`:""}</div><div style="font-size:12px;color:var(--secondary);">${t("branchName")}: <span class="cust-branch-label">${cust.branch?escapeHTML(cust.branch):"---"}</span></div><div class="cust-invoices"></div><div class="cust-actions-dropdown" style="display:none;margin-top:8px;padding:8px;border:1px solid var(--accent);border-radius:8px;background:var(--bg);flex-direction:column;gap:6px;"></div>`;
    const invDiv=card.querySelector(".cust-invoices");
    const dropdown=card.querySelector(".cust-actions-dropdown");
    const branchLabel=card.querySelector(".cust-branch-label");
    const actionBtn=card.querySelector(".cust-action-btn");
    actionBtn.addEventListener("click",()=>{
      const vis=dropdown.style.display;
      if(vis==="none"||!vis){
        dropdown.style.display="flex";
        dropdown.innerHTML=`
          <button class="cust-perm-action-btn" type="button" style="padding:8px 12px;border:none;border-radius:6px;background:var(--white);color:var(--dark);font-size:13px;font-weight:700;cursor:pointer;text-align:right;box-shadow:var(--shadow);">🔑 ${t("permissionsLabel")}</button>
          <button class="cust-branch-action-btn" type="button" style="padding:8px 12px;border:none;border-radius:6px;background:var(--white);color:var(--dark);font-size:13px;font-weight:700;cursor:pointer;text-align:right;box-shadow:var(--shadow);">🏪 ${t("editBranch")}</button>
          <button class="cust-inv-action-btn" type="button" style="padding:8px 12px;border:none;border-radius:6px;background:var(--white);color:var(--dark);font-size:13px;font-weight:700;cursor:pointer;text-align:right;box-shadow:var(--shadow);">📄 ${t("showInvoices")}</button>
          <button class="cust-del-action-btn" type="button" style="padding:8px 12px;border:none;border-radius:6px;background:rgba(220,53,69,.1);color:#dc3545;font-size:13px;font-weight:700;cursor:pointer;text-align:right;box-shadow:var(--shadow);">🗑 ${t("deleteBtn")}</button>`;
        dropdown.querySelector(".cust-perm-action-btn").addEventListener("click",()=>{openCustPerms(cust,card,dropdown);});
        dropdown.querySelector(".cust-branch-action-btn").addEventListener("click",()=>{openCustBranchEdit(cust,card,branchLabel,dropdown);});
        dropdown.querySelector(".cust-inv-action-btn").addEventListener("click",()=>{toggleCustInvoices(cust,invDiv,dropdown);});
        dropdown.querySelector(".cust-del-action-btn").addEventListener("click",()=>{openDeleteCustomerModal(cust.id,cust.name);dropdown.style.display="none";});
      }else{
        dropdown.style.display="none";
      }
    });
    list.appendChild(card);
  });
}
function openCustBranchEdit(cust,card,branchLabel,dropdown){
  const branches=getBranches();
  const cur=cust.branch||branches[0]||"";
  const sel=document.createElement("select");sel.style.cssText="padding:6px;border:1.5px solid var(--accent);border-radius:6px;font-size:12px;font-weight:600;background:var(--white);color:var(--dark);cursor:pointer;width:100%;margin-bottom:6px;";
  const blank=document.createElement("option");blank.value="";blank.textContent="--";sel.appendChild(blank);
  branches.forEach(b=>{const o=document.createElement("option");o.value=b;o.textContent=b;if(b===cur)o.selected=true;sel.appendChild(o);});
  const saveBtn=document.createElement("button");saveBtn.textContent=t("saveBtn")||"💾 حفظ";saveBtn.style.cssText="padding:6px 12px;border:none;border-radius:6px;background:var(--accent);color:#fff;font-size:12px;font-weight:700;cursor:pointer;width:100%;";
  const cont=document.createElement("div");cont.style.cssText="margin-top:6px;";
  cont.appendChild(sel);cont.appendChild(saveBtn);
  dropdown.innerHTML="";dropdown.appendChild(cont);
  saveBtn.addEventListener("click",async()=>{
    const newBranch=sel.value;
    cust.branch=newBranch;
    const lcArr=getLocalCustomers();const lc2=lcArr.find(c=>c.id===cust.id);if(lc2)lc2.branch=newBranch;
    saveLocalCustomers(lcArr);
    try{await updateDoc(doc(db,"customers",cust.id),{branch:newBranch});}catch(e){}
    if(branchLabel)branchLabel.textContent=newBranch||"---";
    dropdown.style.display="none";
  });
}
function openCustPerms(cust,card,dropdown){
  const permSection=document.createElement("div");permSection.className="cust-perm-section";
  const curPerms=cust.permissions||{};
  const defPerms=CATEGORY_PERMISSIONS[cust.accountType]||CAT_ORDER_ADMIN;
  const hasCustom=typeof curPerms==='object'&&Object.keys(curPerms).length>0;
  let ph=`<div class="perm-header"><span>🔑 ${t("permissionsLabel")}</span></div>`;
  CAT_ORDER_ADMIN.forEach(cat=>{
    const checked=hasCustom?!!curPerms[cat]:defPerms.includes(cat);
    ph+=`<div class="perm-toggle-row"><span class="perm-cat-name" data-i18n-cat="${cat}">${catLabel(cat)}</span><label class="perm-toggle-switch"><input type="checkbox" class="perm-checkbox" data-cat="${cat}" ${checked?"checked":""}><span class="perm-toggle-slider"></span></label></div>`;
  });
  ph+=`<div class="perm-actions"><button class="perm-save-btn" type="button">${t("savePerms")}</button><button class="perm-reset-btn" type="button">${t("resetPerms")}</button></div>`;
  permSection.innerHTML=ph;
  dropdown.innerHTML="";dropdown.appendChild(permSection);
  permSection.querySelector(".perm-save-btn").addEventListener("click",async()=>{
    const perms={};CAT_ORDER_ADMIN.forEach(cat=>{const cb=permSection.querySelector(`.perm-checkbox[data-cat="${cat}"]`);if(cb)perms[cat]=cb.checked;});
    cust.permissions=perms;
    const lcArr=getLocalCustomers();const lc2=lcArr.find(c=>c.id===cust.id);if(lc2)lc2.permissions=perms;
    saveLocalCustomers(lcArr);
    try{await updateDoc(doc(db,"customers",cust.id),{permissions:perms});alert(t("permsSaved"));}catch(e){alert(t("errorOccurredShort"));}
    dropdown.style.display="none";
  });
  permSection.querySelector(".perm-reset-btn").addEventListener("click",async()=>{
    cust.permissions={};
    const lcArr2=getLocalCustomers();const lc3=lcArr2.find(c=>c.id===cust.id);if(lc3)lc3.permissions={};
    saveLocalCustomers(lcArr2);
    try{await updateDoc(doc(db,"customers",cust.id),{permissions:{}});alert(t("permsReset"));}catch(e){alert(t("errorOccurredShort"));}
    permSection.querySelectorAll(".perm-checkbox").forEach(cb=>{const cat=cb.dataset.cat;cb.checked=defPerms.includes(cat);});
  });
}
function toggleCustInvoices(cust,invDiv,dropdown){
  if(invDiv.classList.contains("show")){invDiv.classList.remove("show");invDiv.innerHTML="";return;}
  invDiv.innerHTML=`<div style='text-align:center;padding:10px;color:var(--secondary);'>${t("loadingInvoices")}</div>`;
  dropdown.style.display="none";
  (async()=>{
    try{let snap;try{const q=query(invoicesCollection,where("customerId","==",cust.id),orderBy("createdAt","desc"));snap=await getDocs(q);}catch(e){snap=await getDocs(query(invoicesCollection,where("customerId","==",cust.id)));}
    invDiv.innerHTML="";if(snap.empty){invDiv.innerHTML=`<p style='color:var(--secondary);padding:10px;'>${t("noInvoicesAdmin")}</p>`;}
    else{snap.forEach(d=>{const inv=d.data();const ids=inv.branchName||inv.invoiceNo||"";const idv=document.createElement("div");idv.style.cssText="background:var(--bg);border-radius:8px;padding:10px;margin-bottom:6px;border-right:3px solid var(--accent);";idv.innerHTML=`<div style="display:flex;justify-content:space-between;font-size:13px;"><strong>${escapeHTML(ids)}</strong><span>${formatArabicDate(inv.createdAt||inv.date)}</span></div><div style="font-size:12px;color:var(--secondary);margin-top:3px;">${t("products")}: ${inv.totalItems||0} | ${t("qty")}: ${inv.totalQty||0}</div>`;invDiv.appendChild(idv);});}
    invDiv.classList.add("show");
    }catch(e){invDiv.innerHTML=`<p style='color:#dc3545;padding:10px;'>${t("errorOccurred")}</p>`;invDiv.classList.add("show");}
  })();
}

/* ADD CUSTOMER */
getElement("addCustBtn")?.addEventListener("click",async()=>{
  const name=getInputValue("newCustName");const pin=getInputValue("newCustPin");const acc=getInputValue("newCustAccountType");const branch=document.getElementById("newCustBranch")?.value||"";
  if(!name||name.length<2){alert(t("nameMinTwo"));return;}
  if(!pin){alert(t("enterPin"));return;}
  if(allCustomers.find(c=>String(c.name||"").trim().toLowerCase()===name.toLowerCase())){alert(t("customerExists"));return;}
  getElement("newCustName").value="";getElement("newCustPin").value="";document.getElementById("newCustBranch").value="";
  try{const ref=await addDoc(customersCollection,{name,pin,accountType:acc,branch,createdAt:serverTimestamp()});removeLocalCustomer("local_"+name.toLowerCase());const local=getLocalCustomers();local.push({id:ref.id,name,pin,accountType:acc,branch,createdAt:Date.now()});saveLocalCustomers(local);}catch(e){const id="local_"+Date.now()+"_"+Math.random().toString(36).slice(2,6);const local=getLocalCustomers();local.push({id,name,pin,accountType:acc,branch,createdAt:Date.now()});saveLocalCustomers(local);}
  alert(t("customerAdded"));await loadAllCustomers();
});

/* DELETE CUSTOMER */
let deleteCustomerTargetId=null;
function openDeleteCustomerModal(id,name){deleteCustomerTargetId=id;const o=document.getElementById("deleteCustomerModal");if(!o)return;document.getElementById("deleteCustName").textContent=name;const i=document.getElementById("deleteCustConfirmInput");if(i)i.value="";const b=document.getElementById("deleteCustConfirmBtn");if(b)b.disabled=true;o.hidden=false;o.setAttribute("aria-hidden","false");requestAnimationFrame(()=>o.classList.add("active"));}
window.closeDeleteCustomerModal=function(){const o=document.getElementById("deleteCustomerModal");if(!o)return;o.classList.remove("active");o.setAttribute("aria-hidden","true");setTimeout(()=>{o.hidden=true;},200);deleteCustomerTargetId=null;};
window.confirmDeleteCustomer=async function(){if(!deleteCustomerTargetId)return;const id=deleteCustomerTargetId;deleteCustomerTargetId=null;removeLocalCustomer(id);closeDeleteCustomerModal();await loadAllCustomers();try{await deleteDoc(doc(db,"customers",id));}catch(e){}};
getElement("customerSearch")?.addEventListener("input",function(){const v=normalizeText(this.value);renderAllCustomers(allCustomers.filter(c=>normalizeText(c.name||"").includes(v)));});

/* DELETE INVOICE */
let deleteInvoiceTargetId=null;
window.openDeleteInvoiceModal=function(id,name){deleteInvoiceTargetId=id;const o=document.getElementById("deleteInvoiceModal");if(!o)return;document.getElementById("deleteInvoiceName").textContent=name;const i=document.getElementById("deleteInvoiceConfirmInput");if(i)i.value="";const b=document.getElementById("deleteInvoiceConfirmBtn");if(b)b.disabled=true;o.hidden=false;o.setAttribute("aria-hidden","false");requestAnimationFrame(()=>o.classList.add("active"));};
window.closeDeleteInvoiceModal=function(){const o=document.getElementById("deleteInvoiceModal");if(!o)return;o.classList.remove("active");o.setAttribute("aria-hidden","true");setTimeout(()=>{o.hidden=true;},200);deleteInvoiceTargetId=null;};
window.confirmDeleteInvoice=async function(){if(!deleteInvoiceTargetId)return;const id=deleteInvoiceTargetId;deleteInvoiceTargetId=null;const removedIdx=allInvoices.findIndex(i=>i.id===id);const removedInv=removedIdx!==-1?allInvoices.splice(removedIdx,1)[0]:null;renderAllInvoices(allInvoices);closeDeleteInvoiceModal();try{await Promise.race([deleteDoc(doc(db,"invoices",id)),new Promise((_,r)=>setTimeout(()=>r(new Error("Timeout")),10000))]);}catch(e){if(removedInv)allInvoices.push(removedInv);renderAllInvoices(allInvoices);alert(e.message==="Timeout"?t("timeout"):t("errorOccurredShort"));}const cb=document.getElementById("deleteInvoiceConfirmBtn");if(cb)cb.disabled=false;};

/* BRANCHES */
const BRANCHES_KEY="sallah_branches";
const DEFAULT_BRANCHES=["فرع الحمدانية - Hamdanya","فرع الطائف - Altayf","فرع السامر - Al-Samer","فرع المعمل - Almamal"];
function getBranches(){try{const d=localStorage.getItem(BRANCHES_KEY);if(d){const p=JSON.parse(d);if(Array.isArray(p)&&p.length)return p;}}catch(e){}return[...DEFAULT_BRANCHES];}
function saveBranches(l){localStorage.setItem(BRANCHES_KEY,JSON.stringify(l));}
function populateCustBranchDropdown(){
  const sel=document.getElementById("newCustBranch");if(!sel)return;
  const branches=getBranches();sel.innerHTML="";
  const blank=document.createElement("option");blank.value="";blank.textContent=t("selectBranch");sel.appendChild(blank);
  branches.forEach(b=>{const o=document.createElement("option");o.value=b;o.textContent=b;sel.appendChild(o);});
}
let _branchEditIdx=-1;
function openBranchRenameModal(idx){
  _branchEditIdx=idx;
  const br=getBranches();
  if(idx<0||idx>=br.length)return;
  const cur=br[idx];
  const parts=cur.split(" - ");
  const ar=parts[0]||cur;
  const en=parts[1]||"";
  document.getElementById("branchRenameArInput").value=ar;
  document.getElementById("branchRenameEnInput").value=en;
  document.getElementById("branchRenameModalTitle").textContent=t("editBranch");
  applyBranchRenameModalLang();
  const m=document.getElementById("branchRenameModal");m.classList.add("active");m.setAttribute("aria-hidden","false");
  setTimeout(()=>document.getElementById("branchRenameArInput").focus(),100);
}
function closeBranchRenameModal(){
  const m=document.getElementById("branchRenameModal");m.classList.remove("active");m.setAttribute("aria-hidden","true");
}
function applyBranchRenameModalLang(){
  const lang=getLang();
  ["branchRenameArInput","branchRenameEnInput"].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    const key=el.getAttribute("data-i18n-placeholder");if(key&&t(key)!==key)el.placeholder=t(key);
  });
  document.querySelectorAll("#branchRenameModal [data-i18n]").forEach(el=>{const k=el.getAttribute("data-i18n");if(k&&t(k)!==k)el.textContent=t(k);});
}
window.confirmBranchRename=function(){
  const ar=document.getElementById("branchRenameArInput").value.trim();
  const en=document.getElementById("branchRenameEnInput").value.trim();
  if(!ar){alert(getLang()==="ar"?"الاسم بالعربي مطلوب":"Arabic name required");return;}
  const newName=ar+(en?" - "+en:"");
  const br=getBranches();
  if(_branchEditIdx<0||_branchEditIdx>=br.length)return;
  if(br.includes(newName)&&br[_branchEditIdx]!==newName){alert(t("branchExists"));return;}
  br[_branchEditIdx]=newName;
  saveBranches(br);
  closeBranchRenameModal();
  renderBranches();
};

function renderBranches(){
  const list=document.getElementById("branchesList");if(!list)return;
  const branches=getBranches();
  if(!branches.length){list.innerHTML=`<div class='empty-msg'>${t("noBranches")}</div>`;return;}
  list.innerHTML="";
  branches.forEach((b,idx)=>{
    const card=document.createElement("div");card.className="customer-admin-card";
    card.innerHTML=`<div class="cust-header"><strong>${escapeHTML(b)}</strong></div><div style="display:flex;gap:8px;margin-top:8px;"><button class="branch-edit-btn" type="button" style="background:var(--accent);color:#fff;border:none;border-radius:var(--radius-sm);padding:8px 14px;cursor:pointer;font-size:12px;font-weight:700;" data-index="${idx}">✏️ ${t("editBtn")}</button><button class="branch-del-btn" type="button" style="background:rgba(220,53,69,.1);color:#dc3545;border:none;border-radius:var(--radius-sm);padding:8px 14px;cursor:pointer;font-size:12px;font-weight:700;" data-index="${idx}">🗑 ${t("deleteBtn")}</button></div>`;
    card.querySelector(".branch-del-btn").addEventListener("click",function(){const br=getBranches();const i=parseInt(this.dataset.index);if(i>=0&&i<br.length){if(confirm(`Delete "${br[i]}"?`)){br.splice(i,1);saveBranches(br);renderBranches();}}});
    card.querySelector(".branch-edit-btn").addEventListener("click",function(){openBranchRenameModal(parseInt(this.dataset.index));});
    list.appendChild(card);
  });
}
getElement("addBranchBtn")?.addEventListener("click",function(){const n=getInputValue("newBranchName");if(!n){alert(t("enterBranchName"));return;}const b=getBranches();if(b.includes(n)){alert(t("branchExists"));return;}b.push(n);saveBranches(b);getElement("newBranchName").value="";renderBranches();});

/* CATEGORIES MANAGEMENT */
const CAT_META_KEY="simsim_cat_meta";
let _renameCatOldName="";
function getCatMeta(){try{return JSON.parse(localStorage.getItem(CAT_META_KEY))||{};}catch(e){return{};}}
function saveCatMeta(m){localStorage.setItem(CAT_META_KEY,JSON.stringify(m));}
function getCatMetaObj(cat){const m=getCatMeta();return m[cat]||{nameEn:cat,desc:"",showDesc:true};}
function catDisplayName(cat){const meta=getCatMetaObj(cat);return getLang()==="en"?meta.nameEn:cat;}

function canAddProductsToCat(cat){
  const pProds=currentAdminPerms.canAddProducts;
  if(!currentAdminPermsLoaded)return true;
  if(!pProds||Object.keys(pProds).length===0)return false;
  return pProds[cat]===true;
}
function rebuildCatPickCards(){
  const cont=document.getElementById("catPickCardsContainer");if(!cont)return;
  const cats=[...new Set([...CAT_ORDER_ADMIN,...allProducts.filter(p=>p.category).map(p=>p.category)])];
  const pCats=currentAdminPerms.categories;
  let allowed;
  if(!currentAdminPermsLoaded){allowed=[...cats];}
  else if(!pCats||Object.keys(pCats).length===0){allowed=[];}
  else{allowed=cats.filter(cat=>pCats[cat]!==false);}
  cont.innerHTML="";
  allowed.forEach(cat=>{
    const count=allProducts.filter(p=>p.category===cat).length;
    const canAdd=canAddProductsToCat(cat);
    const btn=document.createElement("button");btn.type="button";btn.className="cat-pick-card"+(canAdd?"":" no-add-perm");btn.dataset.cat=cat;
    btn.innerHTML=`<span class="cat-pick-badge">${count}</span><br><span class="cat-pick-label">${catDisplayName(cat)}</span>`+(canAdd?"":`<br><small class="no-add-perm-msg">${t("noAddPermForCat")}</small>`);
    btn.addEventListener("click",()=>{
      if(!canAdd){alert(t("noAddPermForCat"));return;}
      showProductForm(cat);
    });
    cont.appendChild(btn);
  });
  // Also rebuild the category select in product form
  const catSelect=document.getElementById("category");
  if(catSelect){
    const curVal=catSelect.value;
    catSelect.innerHTML="";
    allowed.forEach(cat=>{
      const opt=document.createElement("option");opt.value=cat;
      opt.textContent=catDisplayName(cat);
      catSelect.appendChild(opt);
    });
    if(allowed.includes(curVal))catSelect.value=curVal;
  }
  // Rebuild bulk category select
  const bulkSelect=document.getElementById("bulkCategorySelect");
  if(bulkSelect){
    const curVal2=bulkSelect.value;
    bulkSelect.innerHTML=`<option value="">-- ${t("selectCategory")} --</option>`;
    allowed.forEach(cat=>{
      const opt=document.createElement("option");opt.value=cat;
      opt.textContent=catDisplayName(cat);
      bulkSelect.appendChild(opt);
    });
    if(allowed.includes(curVal2))bulkSelect.value=curVal2;
  }
}

window.openRenameCatModal=function(oldName){
  _renameCatOldName=oldName;
  document.getElementById("renameCatArInput").value="";
  document.getElementById("renameCatEnInput").value="";
  const meta=getCatMetaObj(oldName);
  document.getElementById("renameCatDescInput").value=meta.desc||"";
  document.getElementById("renameCatShowDesc").checked=meta.showDesc!==false;
  document.getElementById("renameCatModalTitle").textContent=t("renameCatTitle");
  applyRenameModalLang();
  const m=document.getElementById("renameCatModal");m.classList.add("active");m.setAttribute("aria-hidden","false");
  setTimeout(()=>document.getElementById("renameCatArInput").focus(),100);
};
window.closeRenameCatModal=function(){
  const m=document.getElementById("renameCatModal");m.classList.remove("active");m.setAttribute("aria-hidden","true");
};
window.openAddCategoryModal=function(){
  _renameCatOldName=null;
  document.getElementById("renameCatArInput").value="";
  document.getElementById("renameCatEnInput").value="";
  document.getElementById("renameCatDescInput").value="";
  document.getElementById("renameCatShowDesc").checked=true;
  document.getElementById("renameCatModalTitle").textContent=t("addCatTitle");
  applyRenameModalLang();
  const m=document.getElementById("renameCatModal");m.classList.add("active");m.setAttribute("aria-hidden","false");
  setTimeout(()=>document.getElementById("renameCatArInput").focus(),100);
};

function applyRenameModalLang(){
  const lang=getLang();
  ["renameCatArInput","renameCatEnInput","renameCatDescInput"].forEach(id=>{
    const el=document.getElementById(id);if(!el)return;
    const key=el.getAttribute("data-i18n-placeholder");if(key&&t(key)!==key)el.placeholder=t(key);
  });
  document.querySelectorAll("#renameCatModal [data-i18n]").forEach(el=>{const k=el.getAttribute("data-i18n");if(k&&t(k)!==k)el.textContent=t(k);});
  const cbLabel=document.querySelector("#renameCatShowDesc + [data-i18n]");
  if(cbLabel){const k=cbLabel.getAttribute("data-i18n");if(k)cbLabel.textContent=t(k);}
}

window.confirmRenameCat=async function(){
  if(document.getElementById("renameCatConfirmBtn").disabled)return;
  document.getElementById("renameCatConfirmBtn").disabled=true;
  const arName=document.getElementById("renameCatArInput").value.trim();
  const enName=document.getElementById("renameCatEnInput").value.trim();
  if(!arName){alert(getLang()==="ar"?"الاسم بالعربي مطلوب":"Arabic name required");document.getElementById("renameCatConfirmBtn").disabled=false;return;}
  const oldName=_renameCatOldName;
  const desc=document.getElementById("renameCatDescInput").value.trim();
  const showDesc=document.getElementById("renameCatShowDesc").checked;

  // ADD mode
  if(!oldName){
    if(CAT_ORDER_ADMIN.includes(arName)){alert(t("adminExists"));document.getElementById("renameCatConfirmBtn").disabled=false;return;}
    CAT_ORDER_ADMIN.push(arName);
    CAT_EN_NAMES_ADMIN[arName]=enName||arName;
    for(const at in CATEGORY_PERMISSIONS){if(!CATEGORY_PERMISSIONS[at].includes(arName))CATEGORY_PERMISSIONS[at].push(arName);}
    try{await addDoc(categoriesCollection,{nameAr:arName,nameEn:enName||arName,order:CAT_ORDER_ADMIN.length-1,desc:desc,showDesc:showDesc});}catch(e){console.error(e);}
    const allMeta=getCatMeta();
    allMeta[arName]={nameEn:enName||arName,desc:desc,showDesc:showDesc};
    allMeta._defaultPerms=JSON.parse(JSON.stringify(CATEGORY_PERMISSIONS));
    allMeta._catOrder=[...CAT_ORDER_ADMIN];allMeta._catEnNames={...CAT_EN_NAMES_ADMIN};
    saveCatMeta(allMeta);
    closeRenameCatModal();document.getElementById("renameCatConfirmBtn").disabled=false;
    await loadProducts();applyAdminLang();
    return;
  }

  // RENAME mode
  if(arName===oldName&&enName===(getCatMetaObj(oldName).nameEn||oldName)&&desc===(getCatMetaObj(oldName).desc||"")&&showDesc===(getCatMetaObj(oldName).showDesc!==false)){closeRenameCatModal();document.getElementById("renameCatConfirmBtn").disabled=false;return;}
  const ids=allProducts.filter(p=>p.category===oldName).map(p=>p.id);let s=0,f=0;
  for(const id of ids){try{await updateDoc(doc(db,"products",id),{category:arName});s++;}catch(e){f++;}}
  if(oldName!==arName){
    try{const snap=await getDocs(collection(db,"customers"));for(const d of snap.docs){const p=d.data().permissions||{};if(oldName in p){p[arName]=p[oldName];delete p[oldName];await updateDoc(doc(db,"customers",d.id),{permissions:p});}}}catch(e){console.error(e);}
    const localC=getLocalCustomers();if(localC){let changed=false;localC.forEach(c=>{if(c.permissions&&oldName in c.permissions){c.permissions[arName]=c.permissions[oldName];delete c.permissions[oldName];changed=true;}});if(changed)saveLocalCustomers(localC);}
    const idx=CAT_ORDER_ADMIN.indexOf(oldName);if(idx!==-1)CAT_ORDER_ADMIN[idx]=arName;
    if(CAT_EN_NAMES_ADMIN[oldName]){CAT_EN_NAMES_ADMIN[arName]=CAT_EN_NAMES_ADMIN[oldName];delete CAT_EN_NAMES_ADMIN[oldName];}
    for(const at in CATEGORY_PERMISSIONS){const arr=CATEGORY_PERMISSIONS[at];const oi=arr.indexOf(oldName);if(oi!==-1)arr[oi]=arName;}
    try{const cs=await getDocs(query(categoriesCollection,where("nameAr","==",oldName)));if(cs.empty){await addDoc(categoriesCollection,{nameAr:arName,nameEn:enName||oldName,order:CAT_ORDER_ADMIN.indexOf(arName),desc:desc||"",showDesc:showDesc});}else{for(const d of cs.docs){await updateDoc(doc(db,"categories",d.id),{nameAr:arName,nameEn:enName||oldName,desc:desc||"",showDesc:showDesc});}}}catch(e){console.error(e);}
  }
  const allMeta=getCatMeta();
  if(allMeta[oldName]){allMeta[arName]=allMeta[oldName];delete allMeta[oldName];}
  if(!allMeta[arName])allMeta[arName]={};
  allMeta[arName].nameEn=enName||arName;
  allMeta[arName].desc=desc;allMeta[arName].showDesc=showDesc;
  allMeta._defaultPerms=CATEGORY_PERMISSIONS;
  allMeta._catOrder=[...CAT_ORDER_ADMIN];allMeta._catEnNames={...CAT_EN_NAMES_ADMIN};
  saveCatMeta(allMeta);
  closeRenameCatModal();document.getElementById("renameCatConfirmBtn").disabled=false;
  await loadProducts();applyAdminLang();await loadAllCustomers();
};
function renderCategories(){
  const list=document.getElementById("categoriesList");const sec=document.getElementById("catProdSection");
  if(!list)return;
  if(sec)sec.style.display="none";list.style.display="";
  const cats=[...new Set([...CAT_ORDER_ADMIN,...allProducts.map(p=>p.category).filter(Boolean)])];
  list.innerHTML="";
  if(cats.length===0){list.innerHTML=`<div class='empty-msg'>${t("noProductsInCat")}</div>`;return;}
  cats.forEach(cat=>{
    const count=allProducts.filter(p=>p.category===cat).length;const meta=getCatMetaObj(cat);
    const dispName=catDisplayName(cat);
    const hasDesc=!!meta.desc;
    const showDesc=meta.showDesc!==false;
    const card=document.createElement("div");card.className="cat-admin-card";
    card.innerHTML=`<div style="flex:1;min-width:0;"><div class="cat-admin-name">${escapeHTML(dispName)}</div>${hasDesc?`<div class="cat-admin-desc" style="display:${showDesc?'':'none'}">${escapeHTML(meta.desc)}</div>`:""}</div><span class="cat-admin-count">(${count})</span><div class="cat-admin-actions"><button class="cat-rename-btn" type="button">${t("renameCategory")}</button>${hasDesc?`<button class="cat-desc-toggle-btn" type="button">${showDesc?"👁️":"🙈"}</button>`:""}<button class="cat-del-btn" type="button">${t("deleteCategory")}</button></div>`;
    card.querySelector(".cat-admin-name").addEventListener("click",()=>showCategoryProducts(cat));
    card.querySelector(".cat-rename-btn").addEventListener("click",e=>{e.stopPropagation();openRenameCatModal(cat);});
    card.querySelector(".cat-del-btn").addEventListener("click",e=>{e.stopPropagation();deleteCategory(cat);});
    const toggleBtn=card.querySelector(".cat-desc-toggle-btn");
    if(toggleBtn)toggleBtn.addEventListener("click",e=>{e.stopPropagation();const allMeta=getCatMeta();if(!allMeta[cat])allMeta[cat]={};const next=!allMeta[cat].showDesc;allMeta[cat].showDesc=next;saveCatMeta(allMeta);renderCategories();(async()=>{try{const cs=await getDocs(query(categoriesCollection,where("nameAr","==",cat)));if(!cs.empty){for(const d of cs.docs){await updateDoc(doc(db,"categories",d.id),{showDesc:next});}}}catch(e){}})();});
    list.appendChild(card);
  });
}
function showCategoryProducts(cat){
  const list=document.getElementById("categoriesList");const sec=document.getElementById("catProdSection");
  const prodList=document.getElementById("catProdList");const title=document.getElementById("catProdTitle");
  const addBtn=document.getElementById("addProductFromCat");list.style.display="none";
  if(sec)sec.style.display="";if(title)title.textContent=`${catDisplayName(cat)} (${allProducts.filter(p=>p.category===cat).length})`;
  const products=allProducts.filter(p=>p.category===cat);
  if(!prodList)return;
  prodList.innerHTML=products.length===0?`<div class='empty-msg'>${t("noProductsInCat")}</div>`:"";
  products.forEach(p=>{prodList.insertAdjacentHTML("beforeend",`<div class="admin-product"><img src="${escapeHTML(getProductImage(p))}" alt="${escapeHTML(p.description||p.name||"")}" onerror="this.src='images/noimg.jpg'"><div class="admin-info"><h3>${escapeHTML(p.description||"")}</h3><p class="product-name-ar">${escapeHTML(p.name||"")}</p><p>SKU: ${escapeHTML(p.code||"")}</p></div><div class="admin-actions"><label class="inv-vis-toggle" title="Show in Inventory Store"><input type="checkbox" class="inv-vis-cb" data-id="${escapeHTML(p.id)}"${p.invVisible!==false?" checked":""}><span>👁</span></label><button class="edit-btn" type="button" onclick="editProduct('${escapeHTML(p.id)}')">${t("editBtn")}</button><button class="delete-btn" type="button" onclick="deleteProduct('${escapeHTML(p.id)}')">${t("deleteBtn")}</button></div></div>`);});
  prodList.querySelectorAll(".inv-vis-cb").forEach(cb => {
    cb.addEventListener("change", function(){
      const id = this.dataset.id;
      const val = this.checked;
      updateDoc(doc(db,"products",id),{invVisible:val}).catch(()=>{});
    });
  });
  if(addBtn)addBtn.onclick=()=>{clearForm();editingId=null;showProductForm(cat);document.querySelectorAll(".admin-tab").forEach(t=>t.classList.remove("active"));document.querySelectorAll(".admin-section").forEach(s=>s.classList.remove("active"));const pt=document.querySelector('[data-tab="products"]');const ps=document.getElementById("section-products");if(pt)pt.classList.add("active");if(ps)ps.classList.add("active");};
  const backBtn=document.getElementById("backToCategoriesList");
  if(backBtn)backBtn.onclick=()=>{if(sec)sec.style.display="none";list.style.display="";renderCategories();};
}
async function deleteCategory(cat){
  if(!confirm(`${t("deleteCategoryConfirm")}\n${t("products")} ${t("qty")}: ${allProducts.filter(p=>p.category===cat).length}`))return;
  // Unlink products
  const ids=allProducts.filter(p=>p.category===cat).map(p=>p.id);let s=0,f=0;
  for(const id of ids){try{await updateDoc(doc(db,"products",id),{category:""});s++;}catch(e){f++;}}
  // Remove from constants
  const oi=CAT_ORDER_ADMIN.indexOf(cat);if(oi!==-1)CAT_ORDER_ADMIN.splice(oi,1);
  if(CAT_EN_NAMES_ADMIN[cat])delete CAT_EN_NAMES_ADMIN[cat];
  for(const at in CATEGORY_PERMISSIONS){const arr=CATEGORY_PERMISSIONS[at];const ci=arr.indexOf(cat);if(ci!==-1)arr.splice(ci,1);}
  // Remove from Firestore categories collection
  try{const cs=await getDocs(query(categoriesCollection,where("nameAr","==",cat)));for(const d of cs.docs)await deleteDoc(doc(db,"categories",d.id));}catch(e){}
  // Remove from customer permissions
  try{const custSnap=await getDocs(customersCollection);for(const d of custSnap.docs){const perms=d.data().permissions||{};if(perms[cat]!==undefined){delete perms[cat];await updateDoc(doc(db,"customers",d.id),{permissions:perms});}}}catch(e){}
  try{const lc=getLocalCustomers();let changed=false;lc.forEach(c=>{if(c.permissions&&c.permissions[cat]!==undefined){delete c.permissions[cat];changed=true;}});if(changed)saveLocalCustomers(lc);}catch(e){}
  // Remove from meta cache
  const allMeta=getCatMeta();delete allMeta[cat];allMeta._catOrder=[...CAT_ORDER_ADMIN];allMeta._catEnNames={...CAT_EN_NAMES_ADMIN};allMeta._defaultPerms=JSON.parse(JSON.stringify(CATEGORY_PERMISSIONS));saveCatMeta(allMeta);
  alert(`${t("deleteCategorySuccess")} (${s}/${ids.length})`);await loadProducts();renderCategories();
}

/* PDF */
async function downloadInvoicePdf(inv){try{await generateInvoicePdf(inv);const fn=`${(inv.branchName||(inv.invoiceNo||"").replace("INV-","")||"invoice")}.pdf`;const m=document.getElementById("pdfSuccessMsg");if(m){m.textContent=`${t("pdfDownloaded")} ${fn}`;setTimeout(()=>{m.textContent="";},3000);}}catch(e){alert(t("pdfError"));}}

/* INIT */
function applyAdminLang(){
  const lang = getLang();
  const isEn = lang === "en";
  document.documentElement.lang = lang;
  document.documentElement.dir = isEn ? "ltr" : "rtl";
  const btn = document.getElementById("adminLangToggle");
  if(btn) btn.textContent = isEn ? "🌐 عربي" : "🌐 EN";
  const logoutBtn = document.getElementById("adminLogoutBtn");
  if(logoutBtn) logoutBtn.textContent = t("logout");

  // Admin profile
  const profDisplay=document.getElementById("adminProfileDisplay");
  if(profDisplay)profDisplay.textContent=currentAdminData?`🔑 ${currentAdminData.username}`:"";
  const profEditBtn=document.getElementById("adminProfileEditBtn");
  const profEditSection=document.getElementById("adminProfileEditSection");
  if(profEditBtn)profEditBtn.textContent="✏️";
  const editUser=document.getElementById("adminEditProfileUser");
  if(editUser)editUser.placeholder=t("newUsername");
  const editPass=document.getElementById("adminEditProfilePass");
  if(editPass)editPass.placeholder=t("newPassword");
  const saveBtn=document.getElementById("adminSaveProfileBtn");
  if(saveBtn)saveBtn.textContent=t("saveBtn")||"💾 حفظ";

  // Admin login screen
  const loginH1 = document.querySelector("#adminLoginScreen h1");
  const loginP = document.querySelector("#adminLoginScreen p");
  const loginBtn = document.querySelector("#adminLoginForm button[type='submit']");
  if(loginH1) loginH1.textContent = t("adminLoginTitle");
  if(loginP) loginP.textContent = t("adminLoginSubtitle");
  if(loginBtn) loginBtn.textContent = t("adminLoginBtn");

  // Tabs
  const tabs = document.querySelectorAll(".admin-tab");
  const tabKeys = ["productsTab","invoicesTab","customersTab","branchesTab","categoriesTab"];
  tabs.forEach((tab,i) => {
    if(tabKeys[i]) tab.textContent = t(tabKeys[i]);
    if(i===2){
      if(currentAdminPerms.canManageCustomers===false){
        tab.innerHTML='🔒 '+(tab.textContent||t(tabKeys[i]));
        tab.style.opacity="0.5";
      }else{tab.style.opacity="1";}
    }
  });

  // Category picker title
  const pickerTitle = document.querySelector("#categoryPicker h2:first-child");
  if(pickerTitle) pickerTitle.textContent = t("selectCategory");

  // Category picker cards - rebuild dynamically
  rebuildCatPickCards();

  // All Products heading
  const allProdH2 = document.querySelector("#categoryPicker > hr + h2");
  if(allProdH2) allProdH2.textContent = t("allProducts");

  // Apply data-i18n translations
  document.querySelectorAll("[data-i18n]:not([data-i18n-cat])").forEach(el => {
    const k = el.getAttribute("data-i18n");
    if(k && t(k) !== k) el.textContent = t(k);
  });

  // Product form
  const backBtn = document.getElementById("backToCategories");
  if(backBtn) backBtn.textContent = t("backToCategories");
  const addTitle = document.querySelector("#productFormSection h2");
  if(addTitle) addTitle.innerHTML = `${t("addProductTo")} <span id="selectedCategoryName" style="color:var(--accent);"></span>`;
  const ph = {name:"arabicName",description:"englishName",code:"productCode",image:"imageLink"};
  Object.entries(ph).forEach(([id,key]) => {
    const el = document.getElementById(id);
    if(el) el.placeholder = t(key);
  });
  const saveProductBtn = document.getElementById("save");
  if(saveProductBtn) saveProductBtn.textContent = t("saveProduct");
  const suggestCodeLabel=document.getElementById("suggestCodeLabel");
  if(suggestCodeLabel) suggestCodeLabel.textContent = t("suggestCode");

  // Category select in product form
  const catSelect = document.getElementById("category");
  if(catSelect){
    CAT_ORDER_ADMIN.forEach(cat => {
      const opt = catSelect.querySelector(`option[value="${cat}"]`);
      if(opt) opt.textContent = catLabel(cat);
    });
  }

  // Upload image label
  const uploadLabel = document.querySelector("label[for='imageFile']");
  if(uploadLabel) uploadLabel.textContent = t("uploadImage");

  // Import/Export Excel buttons
  const importBtn = document.getElementById("importExcel");
  if(importBtn) importBtn.textContent = t("importExcelLabel");
  const exportBtn = document.getElementById("exportExcel");
  if(exportBtn) exportBtn.textContent = t("exportExcelLabel");

  // Bulk actions
  const selectAllLabel = document.getElementById("selectAllLabel");
  if(selectAllLabel) selectAllLabel.textContent = t("bulkSelectAll");
  const bulkCatSel = document.getElementById("bulkCategorySelect");
  if(bulkCatSel){
    const defOpt = bulkCatSel.querySelector("option[value='']");
    if(defOpt) defOpt.textContent = t("bulkCategoryPlaceholder");
  }
  const bulkBtn = document.getElementById("bulkChangeCatBtn");
  if(bulkBtn) bulkBtn.textContent = t("bulkChangeBtn");

  // Categories section
  const catBackBtn = document.getElementById("backToCategoriesList");
  if(catBackBtn) catBackBtn.textContent = t("catProductsBack");
  const catAddBtn = document.getElementById("addProductFromCat");
  if(catAddBtn) catAddBtn.textContent = t("addProductToCat");
  const addNewCatBtn = document.getElementById("addNewCategoryBtn");
  if(addNewCatBtn) addNewCatBtn.textContent = t("addNewCategory");

  // Category names in dynamic sections (e.g. customer permissions)
  document.querySelectorAll("[data-i18n-cat]").forEach(el => {
    el.textContent = catLabel(el.getAttribute("data-i18n-cat"));
  });

  // Search and sort
  const searchAdmin = document.getElementById("searchAdmin");
  if(searchAdmin) searchAdmin.placeholder = t("searchProduct");
  const sortBtns = {sortNewest:"sortNewest",sortOldest:"sortOldest",sortNameAsc:"sortNameAsc"};
  Object.entries(sortBtns).forEach(([id,key]) => {
    const el = document.getElementById(id);
    if(el) el.textContent = t(key);
  });

  // Products table buttons
  document.querySelectorAll(".edit-btn").forEach(b => b.textContent = t("editBtn"));

  // Delete modals
  const delCustTitle=document.getElementById("deleteCustTitle");
  if(delCustTitle)delCustTitle.textContent=t("deleteCustomerTitle");
  const delCustMsg=document.getElementById("deleteCustMsg");
  if(delCustMsg)delCustMsg.textContent=t("deleteCustomerMsg");
  const delCustType=document.getElementById("deleteCustConfirmType");
  if(delCustType)delCustType.textContent=t("deleteCategoryConfirmType");
  const delCustCancel=document.getElementById("deleteCustCancelBtn");
  if(delCustCancel)delCustCancel.textContent=t("cancelDelete");
  const delCustConfirm=document.getElementById("deleteCustConfirmBtn");
  if(delCustConfirm)delCustConfirm.textContent=t("deleteConfirm");
  const delCustInput=document.getElementById("deleteCustConfirmInput");
  if(delCustInput)delCustInput.placeholder=t("confirmDelete");
  const delInvTitle=document.getElementById("deleteInvTitle");
  if(delInvTitle)delInvTitle.textContent=t("deleteInvoiceTitle");
  const delInvMsg=document.getElementById("deleteInvMsg");
  if(delInvMsg)delInvMsg.textContent=t("deleteInvoiceMsg");
  const delInvType=document.getElementById("deleteInvConfirmType");
  if(delInvType)delInvType.textContent=t("deleteCategoryConfirmType");
  const delInvCancel=document.getElementById("deleteInvCancelBtn");
  if(delInvCancel)delInvCancel.textContent=t("cancelDelete");
  const delInvConfirm=document.getElementById("deleteInvConfirmBtn");
  if(delInvConfirm)delInvConfirm.textContent=t("deleteConfirm");
  const delInvInput=document.getElementById("deleteInvoiceConfirmInput");
  if(delInvInput)delInvInput.placeholder=t("confirmDelete");
  document.querySelectorAll(".delete-btn").forEach(b => b.textContent = t("deleteBtn"));
  document.querySelectorAll(".edit-btn").forEach(b => b.textContent = t("editBtn"));
  document.querySelectorAll(".inv-toggle-btn").forEach(b => {
    const tbl = b.closest(".invoice-admin-card")?.querySelector(".inv-detail-table");
    b.textContent = tbl?.classList.contains("show") ? t("hideDetails") : t("showDetails");
  });

  // Invoices section
  const invTitle = document.querySelector("#section-invoices h2");
  if(invTitle) invTitle.textContent = t("allInvoices");
  const invSearch = document.getElementById("invoiceSearch");
  if(invSearch) invSearch.placeholder = t("searchInvoice");

  // Customers section
  const custTitle = document.querySelector("#section-customers h2");
  if(custTitle) custTitle.textContent = t("addCustomer");
  const custName = document.getElementById("newCustName");
  if(custName) custName.placeholder = t("customerName");
  const custPin = document.getElementById("newCustPin");
  if(custPin) custPin.placeholder = t("customerPin");
  const custBtn = document.getElementById("addCustBtn");
  if(custBtn) custBtn.textContent = t("addCustomerBtn");
  const custSearch = document.getElementById("customerSearch");
  if(custSearch) custSearch.placeholder = t("searchCustomer");

  // Account type dropdown
  const accSel = document.getElementById("newCustAccountType");
  if(accSel && accSel.options.length >= 2){
    accSel.options[0].textContent = t("accountTypeLab");
    accSel.options[1].textContent = t("accountTypeBranch");
  }

  // Hide branch dropdown when account type is inventory (جرد مخزون)
  const branchSel = document.getElementById("newCustBranch");
  function toggleBranchVisibility(){
    if(!branchSel) return;
    if(accSel && accSel.value === "جرد مخزون"){
      branchSel.style.display = "none";
    } else {
      branchSel.style.display = "";
    }
  }
  accSel?.addEventListener("change", toggleBranchVisibility);
  toggleBranchVisibility();

  // Customer branch dropdown
  populateCustBranchDropdown();

  // Branches section
  const brTitle = document.querySelector("#section-branches h2");
  if(brTitle) brTitle.textContent = t("manageBranches");
  const brName = document.getElementById("newBranchName");
  if(brName) brName.placeholder = t("branchName");
  const brBtn = document.getElementById("addBranchBtn");
  if(brBtn) brBtn.textContent = t("addBranchBtn");

  // Floating menu
  applyMenuLang();

  // Rename/Add category modal i18n
  applyRenameModalLang();

  // Branch rename modal i18n
  applyBranchRenameModalLang();

  // Re-render category products / categories list on language switch
  if(selectedAdminCategory) renderCategoryProducts(selectedAdminCategory);
  const catSec = document.getElementById("section-categories");
  if(catSec && catSec.classList.contains("active")) renderCategories();

  // Update restriction message if shown
  const custSection = document.getElementById("section-customers");
  if(custSection && currentAdminPerms.canManageCustomers===false && loadedTabs.customers){
    custSection.innerHTML=`<div style="text-align:center;padding:40px 20px;color:#dc3545;font-size:16px;font-weight:700;">🔒 ${t("noCustomerPerm")}</div>`;
  }
}
getElement("adminLangToggle")?.addEventListener("click", () => {
  setLang(getLang() === "ar" ? "en" : "ar");
  applyAdminLang();
});

document.getElementById("adminLogoutBtn")?.addEventListener("click", () => {
  if(confirm(t("logoutConfirm"))){revertToLoginScreen("");currentAdminData=null;currentAdminDocId=null;sessionStorage.removeItem(ADMIN_SESSION_KEY);}
});

// Add new category button
document.getElementById("addNewCategoryBtn")?.addEventListener("click", openAddCategoryModal);

// Rename category modal
document.getElementById("renameCatCancelBtn")?.addEventListener("click", closeRenameCatModal);
document.getElementById("renameCatConfirmBtn")?.addEventListener("click", confirmRenameCat);
document.getElementById("renameCatModal")?.addEventListener("click", e => {
  if(e.target === e.currentTarget) closeRenameCatModal();
});
document.getElementById("renameCatModal")?.addEventListener("keydown", e => {
  if(e.key === "Escape") closeRenameCatModal();
  if(e.key === "Enter" && !document.getElementById("renameCatConfirmBtn").disabled) confirmRenameCat();
});
['renameCatArInput','renameCatEnInput','renameCatDescInput'].forEach(id => {
  document.getElementById(id)?.addEventListener("keydown", e => {
    if(e.key === "Enter"){ e.stopPropagation(); document.getElementById("renameCatConfirmBtn")?.click(); }
  });
});
document.getElementById("adminProfileEditBtn")?.addEventListener("click",()=>{
  const s=document.getElementById("adminProfileEditSection");if(!s)return;
  s.style.display=s.style.display==="none"?"":"none";
  const eu=document.getElementById("adminEditProfileUser");if(eu&&currentAdminData)eu.value=currentAdminData.username||"";
  const ep=document.getElementById("adminEditProfilePass");if(ep)ep.value="";
});
document.getElementById("adminSaveProfileBtn")?.addEventListener("click",async()=>{
  if(!currentAdminData||!currentAdminDocId){alert(t("errorOccurredShort"));return;}
  const nu=document.getElementById("adminEditProfileUser").value.trim();
  const np=document.getElementById("adminEditProfilePass").value.trim();
  if(!nu&&!np){alert(t("enterAtLeastOne"));return;}
  const updates={};
  if(nu&&nu!==(currentAdminData.username||""))updates.username=nu;
  if(np)updates.password=np;
  if(Object.keys(updates).length===0){alert(t("noChanges"));return;}
  try{await updateDoc(doc(db,"admins",currentAdminDocId),updates);Object.assign(currentAdminData,updates);document.getElementById("adminProfileEditSection").style.display="none";applyAdminLang();alert(t("profileUpdated"));}catch(e){alert(t("errorOccurredShort"));}
  // Sync to localStorage for offline login
  try{localStorage.setItem(LOCAL_ADMIN_KEY,JSON.stringify({username:currentAdminData.username||"admin",password:currentAdminData.password||"admin"}));}catch(e){}
});

// Branch rename modal
document.getElementById("branchRenameCancelBtn")?.addEventListener("click", closeBranchRenameModal);
document.getElementById("branchRenameConfirmBtn")?.addEventListener("click", confirmBranchRename);
document.getElementById("branchRenameModal")?.addEventListener("click", e => {
  if(e.target === e.currentTarget) closeBranchRenameModal();
});
document.getElementById("branchRenameModal")?.addEventListener("keydown", e => {
  if(e.key === "Escape") closeBranchRenameModal();
  if(e.key === "Enter") confirmBranchRename();
});
['branchRenameArInput','branchRenameEnInput'].forEach(id => {
  document.getElementById(id)?.addEventListener("keydown", e => {
    if(e.key === "Enter"){ e.stopPropagation(); confirmBranchRename(); }
  });
});

async function loadAdminPermissions(){
  currentAdminPermsLoaded=false;
  try{
    let docId=currentAdminDocId;
    const uname=currentAdminData?currentAdminData.username:null;
    if(!docId||docId==="local"){
      if(!uname){currentAdminPerms={};return;}
      const q=query(adminsCollection,where("username","==",uname));
      const snap=await getDocs(q);
      if(snap.empty){currentAdminPerms={};return;}
      docId=snap.docs[0].id;
      currentAdminDocId=docId;
    }
    const snap=await getDoc(doc(db,"admins",docId));
    if(snap.exists()){
      currentAdminPerms=snap.data().permissions||{};
      currentAdminPermsLoaded=true;
    }else{currentAdminPerms={};}
  }catch(e){currentAdminPerms={};}
}
async function init(){
  applyFullLang({langToggle:"adminLoginLangToggle"});
  applyMenuLang();
  if(sessionStorage.getItem(VERIFIED_KEY)!=="true")await seedDefaultAdmin();
  const authed=await checkAdminAuth();if(!authed){if(!getLocalAdmin())saveLocalAdmin("admin","admin");return;}
  sessionStorage.setItem(AUTH_KEY,"true");if(currentAdminData)saveLocalAdmin(currentAdminData.username||"admin",currentAdminData.password||"admin");await loadAdminPermissions();applyAdminLang();initTabs();try{await loadCategoriesFromFirestore();await loadTabContent("products");}catch(e){}
}
init();
getElement("adminLoginLangToggle")?.addEventListener("click", () => {
  setLang(getLang() === "ar" ? "en" : "ar");
  applyFullLang({langToggle:"adminLoginLangToggle"});
  applyMenuLang();
});
