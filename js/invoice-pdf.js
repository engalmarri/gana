const COLUMNS = 3;
const A4_W = 210;
const A4_H = 297;
const A4_W_MM = 210;
const A4_H_MM = 297;
const CAT_META_KEY = "simsim_cat_meta";
const CAT_EN_NAMES = {
  "قسم المعمل": "Lab",
  "قسم السوبرماركت": "Supermarket",
  "قسم محلات الجملة": "Wholesale",
  "قسم المستودع": "Warehouse",
  "احتياجات المعمل": "Lab Needs"
};
const CAT_ORDER = ["قسم المعمل","قسم السوبرماركت","قسم محلات الجملة","قسم المستودع","احتياجات المعمل"];

function getCatMeta() { try { return JSON.parse(localStorage.getItem(CAT_META_KEY)) || {}; } catch(e) { return {}; } }
function getCatMetaObj(cat) { const m = getCatMeta(); return m[cat] || { nameEn: cat, desc: "", showDesc: true }; }
function catNameEn(cat) { return getCatMetaObj(cat).nameEn || CAT_EN_NAMES[cat] || cat; }

function escapeHTML(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function waitForImages(container) {
  return Promise.all(Array.from(container.querySelectorAll("img")).map(img =>
    new Promise(resolve => {
      if (img.complete) { resolve(); return; }
      img.onload = resolve;
      img.onerror = resolve;
      setTimeout(resolve, 2000);
    })
  ));
}

function getInvoiceEl(id) {
  return document.getElementById(id);
}

function populateTemplate(invoiceData) {
  const invNo = (invoiceData.invoiceNo || "").replace("INV-", "");
  const branchName = invoiceData.branchName || "";
  const customerName = invoiceData.customerName || "Direct Customer";
  let dateStr = "";
  const rawDate = invoiceData.createdAt || invoiceData.date || "";
  if (rawDate) {
    if (typeof rawDate === "string") dateStr = rawDate.split("T")[0];
    else if (rawDate.toDate) dateStr = rawDate.toDate().toLocaleDateString("en-CA");
    else dateStr = String(rawDate);
  }
  const noEl = getInvoiceEl("invoiceNo");
  const custEl = getInvoiceEl("invoiceCustomer");
  const dateEl = getInvoiceEl("invoiceDate");
  const recvEl = getInvoiceEl("invRecvBranch");
  if (noEl) noEl.textContent = invNo;
  if (custEl) custEl.textContent = customerName;
  if (dateEl) dateEl.textContent = dateStr;
  if (recvEl) {
    const parts = branchName.split(" - ");
    let formattedBranch = branchName;
    if (parts.length === 2) formattedBranch = parts[1] + " - " + parts[0];
    recvEl.textContent = formattedBranch;
  }
}

function makeRowsFromItems(items) {
  const groups = {};
  items.forEach(it => {
    const cat = it.category || "Other";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(it);
  });
  const rows = [];
  const processed = new Set();
  CAT_ORDER.forEach(cat => {
    const group = groups[cat];
    if (!group || group.length === 0) return;
    rows.push({ type: "header", catName: catNameEn(cat) });
    for (let i = 0; i < group.length; i += COLUMNS) {
      rows.push({ type: "items", items: group.slice(i, i + COLUMNS) });
    }
    processed.add(cat);
  });
  Object.keys(groups).forEach(cat => {
    if (processed.has(cat)) return;
    const group = groups[cat];
    rows.push({ type: "header", catName: catNameEn(cat) });
    for (let i = 0; i < group.length; i += COLUMNS) {
      rows.push({ type: "items", items: group.slice(i, i + COLUMNS) });
    }
  });
  return rows;
}

function invoiceCell(item) {
  const desc = escapeHTML(item.description || "");
  const arName = escapeHTML(item.name || "");
  const qty = item.qty || 0;
  return '<td class="invoice-check-cell"><span class="invoice-check-box"></span></td><td class="invoice-product-cell"><div class="invoice-product-main"><span class="invoice-product-number invoice-product-qty">' + qty + '</span><strong><bdi>' + desc + '</bdi></strong></div>' + (arName ? '<div class="invoice-product-details" dir="rtl">' + arName + '</div>' : '') + '</td>';
}

function emptyCell() {
  return '<td class="invoice-check-cell invoice-empty-cell"></td><td class="invoice-product-cell invoice-empty-cell"></td>';
}

function renderRowsInto(rows, tbody) {
  if (!tbody) return;
  tbody.innerHTML = "";
  rows.forEach(ri => {
    if (ri.type === "header") {
      tbody.insertAdjacentHTML("beforeend", '<tr><td colspan="6" style="background:#d9d9d9;color:#111;border:1px solid #222;padding:6px 8px;font-size:14px;font-weight:900;text-align:center;">' + ri.catName + '</td></tr>');
    } else if (ri.type === "items") {
      let h = "";
      (ri.items || []).forEach(it => { h += invoiceCell(it); });
      for (let e = (ri.items || []).length; e < COLUMNS; e++) { h += emptyCell(); }
      tbody.insertAdjacentHTML("beforeend", '<tr>' + h + '</tr>');
    }
  });
}

function setDeliveryType(type) {
  const template = getInvoiceEl("invoiceTemplate");
  if (!template) return;
  const delivery = template.querySelector(".invoice-delivery-info");
  const title = template.querySelector(".invoice-title-main");
  if (type === "جرد مخزون") {
    if (title) title.textContent = "Inventory Count Form";
    if (delivery) {
      delivery.style.gridTemplateColumns = "repeat(2,1fr)";
      delivery.innerHTML = '<div class="inv-delivery-col" style="font-size:11px;color:#333;"><div class="inv-delivery-title" style="font-weight:800;font-size:12px;color:#111;margin-bottom:8px;">Branch Responsible:</div><div class="inv-delivery-row" style="margin-bottom:6px;font-weight:600;">Name: ____________________________________________</div><div class="inv-delivery-row" style="margin-bottom:6px;font-weight:600;">Date: ____________________________________________</div></div><div class="inv-delivery-col" style="font-size:11px;color:#333;"><div class="inv-delivery-title" style="font-weight:800;font-size:12px;color:#111;margin-bottom:8px;">Inventory Supervisor:</div><div class="inv-delivery-row" style="margin-bottom:6px;font-weight:600;">Name: ____________________________________________</div><div class="inv-delivery-row" style="margin-bottom:6px;font-weight:600;">Date: ____________________________________________</div></div>';
    }
  }
}

function setFooterVisible(visible) {
  const template = getInvoiceEl("invoiceTemplate");
  if (!template) return;
  const summary = template.querySelector(".invoice-summary-row");
  const delivery = template.querySelector(".invoice-delivery-info");
  const display = visible ? "" : "none";
  if (summary) summary.style.display = display;
  if (delivery) delivery.style.display = display;
}

function setTotals(items) {
  const totalEl = getInvoiceEl("invoiceTotal");
  const qtyEl = getInvoiceEl("invoiceQty");
  if (totalEl) totalEl.textContent = items.length;
  if (qtyEl) qtyEl.textContent = items.reduce((s, it) => s + (it.qty || 0), 0);
}

function getFileName(invoiceData) {
  const shortNo = (invoiceData.invoiceNo || "").replace("INV-", "");
  const branch = invoiceData.branchName || "";
  return (branch || shortNo || "invoice") + ".pdf";
}

function getMaxPageHeight() {
  const tpl = getInvoiceEl("invoiceTemplate");
  const w = tpl ? tpl.scrollWidth : 1120;
  return Math.floor(w * (A4_H_MM / A4_W_MM)) - 24;
}

export async function generateInvoicePdf(invoiceData) {
  populateTemplate(invoiceData);
  setDeliveryType(invoiceData.accountType);
  const items = invoiceData.items || [];
  const thead = getInvoiceEl("invoiceTable")?.querySelector("thead");
  if (thead) thead.style.display = "none";
  setTotals(items);

  const rows = makeRowsFromItems(items);
  const tbody = getInvoiceEl("invoiceProducts");
  const template = getInvoiceEl("invoiceTemplate");
  if (!tbody || !template) return;

  // Force layout once, then wait for images once
  template.offsetHeight;
  await waitForImages(template);

  const maxH = getMaxPageHeight();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF("P", "mm", "A4");
  let start = 0;
  let pageIdx = 0;
  while (start < rows.length) {
    let end = start + 1;
    let best = end;
    while (end <= rows.length) {
      renderRowsInto(rows.slice(start, end), tbody);
      setFooterVisible(end === rows.length);
      if (template.scrollHeight <= maxH) {
        best = end;
        end++;
      } else break;
    }
    renderRowsInto(rows.slice(start, best), tbody);
    setFooterVisible(best === rows.length);
    const canvas = await html2canvas(template, {
      scale: 2, useCORS: true, backgroundColor: "#ffffff",
      windowWidth: template.scrollWidth, windowHeight: template.scrollHeight
    });
    const imgD = canvas.toDataURL("image/png");
    const imgH = Math.min((canvas.height * A4_W) / canvas.width, A4_H);
    if (pageIdx > 0) doc.addPage();
    doc.addImage(imgD, "PNG", 0, 0, A4_W, imgH);
    start = best;
    pageIdx++;
  }
  setFooterVisible(true);
  doc.save(getFileName(invoiceData));
}
