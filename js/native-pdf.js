// Products Inventory & Delivery Report.
//
// Arabic is deliberately rendered by the browser's text engine, not manually
// reversed or converted to Arabic Presentation Forms.  This gives the PDF the
// same correct RTL, shaping and bidirectional behaviour as a normal document.

const A4 = { width: 794, height: 1123 };
const PAGE_MARGIN = 24;
const ROW_HEIGHT = 42;
const FIRST_HEADER_HEIGHT = 195;
const CONTINUED_HEADER_HEIGHT = 58;
const FOOTER_HEIGHT = 182;

const CATEGORY_NAMES = {
  "قسم المعمل": "Lab",
  "المعمل": "Lab",
  "قسم السوبرماركت": "Supermarket",
  "قسم محلات الجملة": "Wholesale",
  "قسم المستودع": "Warehouse",
  "المستودع": "Warehouse",
  "البوكسات": "Boxes",
  "احتياجات المعمل": "Lab Needs",
};
const CATEGORY_ORDER = ["قسم المعمل", "قسم السوبرماركت", "قسم محلات الجملة", "قسم المستودع", "احتياجات المعمل"];

function escapeHtml(value){
  return String(value ?? "").replace(/[&<>\"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#39;" }[char]));
}

function filenamePart(value){
  return String(value || "report").replace(/[^0-9A-Za-z _-]/g, "").trim() || "report";
}

function labelsFor(input){
  const supplied = input.labels || {};
  return (key, fallback) => supplied[key] || fallback;
}

function categoryEnglish(category, categoryEn){
  if(CATEGORY_NAMES[category]) return CATEGORY_NAMES[category];
  // A category name is only valid in this report when the explicitly stored
  // English value is actually English; never leak an Arabic fallback into the
  // Category column.
  if(categoryEn && !/[\u0600-\u06FF]/.test(categoryEn)) return categoryEn;
  return "Other";
}

function buildRows(products, cart){
  const requestedById = new Map((cart || []).map(item => [String(item.id), Number(item.qty) || 0]));
  const groups = new Map();
  (products || []).forEach(product => {
    const category = product.category || "Other";
    if(!groups.has(category)) groups.set(category, []);
    groups.get(category).push(product);
  });
  const categories = [
    ...CATEGORY_ORDER.filter(category => groups.has(category)),
    ...[...groups.keys()].filter(category => !CATEGORY_ORDER.includes(category)),
  ];
  let serial = 0;
  return categories.flatMap(category => {
    const items = groups.get(category) || [];
    // Requested products first makes the delivery form easier to use.
    items.sort((a, b) => Number(requestedById.has(String(b.id))) - Number(requestedById.has(String(a.id))));
    return items.map(product => ({
      serial: ++serial,
      arabicName: product.name || "",
      englishName: product.description || product.nameEn || "",
      category: categoryEnglish(category, product.categoryEn),
      requested: requestedById.get(String(product.id)) || "",
      noExpiry: Boolean(product.noExpiry),
    }));
  });
}

function splitRows(rows){
  const firstCapacity = Math.max(1, Math.floor((A4.height - FIRST_HEADER_HEIGHT - PAGE_MARGIN - 30) / ROW_HEIGHT));
  const firstLastCapacity = Math.max(1, Math.floor((A4.height - FIRST_HEADER_HEIGHT - FOOTER_HEIGHT - PAGE_MARGIN - 30) / ROW_HEIGHT));
  const laterCapacity = Math.max(1, Math.floor((A4.height - CONTINUED_HEADER_HEIGHT - PAGE_MARGIN - 30) / ROW_HEIGHT));
  const lastCapacity = Math.max(1, Math.floor((A4.height - CONTINUED_HEADER_HEIGHT - FOOTER_HEIGHT - PAGE_MARGIN - 30) / ROW_HEIGHT));
  if(rows.length <= firstLastCapacity) return [rows];

  const pages = [rows.slice(0, firstCapacity)];
  let offset = firstCapacity;
  while(rows.length - offset > lastCapacity){
    pages.push(rows.slice(offset, offset + laterCapacity));
    offset += laterCapacity;
  }
  pages.push(rows.slice(offset));
  return pages;
}

function reportStyles(){
  return `
    @page { size: A4 portrait; margin: 0; }
    .inventory-report-page { width:${A4.width}px; height:${A4.height}px; box-sizing:border-box; padding:${PAGE_MARGIN}px; background:#fff; color:#202124; font-family:Tahoma, Arial, sans-serif; font-size:10px; line-height:1.15; position:relative; overflow:hidden; }
    .inventory-report-page * { box-sizing:border-box; }
    .report-top { min-height:164px; border-bottom:2px solid #4b5563; padding-bottom:8px; }
    .report-brand { height:38px; display:flex; align-items:center; justify-content:center; }
    .report-brand img { max-height:30px; max-width:118px; object-fit:contain; }
    .report-title { text-align:center; margin:2px 0 8px; }
    .report-title .ar { direction:rtl; unicode-bidi:plaintext; font-size:17px; font-weight:700; }
    .report-title .en { direction:ltr; font-size:12px; font-weight:700; margin-top:2px; }
    .report-info { display:grid; grid-template-columns:1fr 1fr; gap:10px; border:1px solid #b8bec5; background:#f1f3f5; padding:7px 9px; min-height:77px; }
    .report-field { min-width:0; }
    .report-field.right { text-align:right; direction:rtl; unicode-bidi:plaintext; }
    .report-field.left { text-align:left; direction:ltr; }
    .report-label-ar { font-size:9px; font-weight:700; direction:rtl; unicode-bidi:plaintext; }
    .report-label-en { font-size:8px; font-weight:700; direction:ltr; margin-top:1px; }
    .report-value { font-size:10px; font-weight:700; margin-top:4px; overflow-wrap:anywhere; unicode-bidi:plaintext; }
    .report-table { width:100%; border-collapse:collapse; table-layout:fixed; margin-top:8px; direction:ltr; }
    .report-table th { height:53px; background:#4b5563; color:#fff; padding:3px 2px; border:1px solid #fff; text-align:center; vertical-align:middle; font-weight:700; }
    .report-table th .ar { display:block; direction:rtl; unicode-bidi:plaintext; font-size:7px; line-height:1.12; }
    .report-table th .en { display:block; direction:ltr; font-size:5.5px; line-height:1.1; font-weight:400; margin-top:2px; overflow-wrap:anywhere; }
    .report-table td { height:${ROW_HEIGHT}px; padding:2px 3px; border:1px solid #b8bec5; text-align:center; vertical-align:middle; overflow:hidden; }
    .report-table td.product { text-align:center; }
    .product-ar { direction:rtl; unicode-bidi:plaintext; font-size:10px; font-weight:400; line-height:1.12; overflow-wrap:anywhere; }
    .product-en { direction:ltr; font-size:8px; line-height:1.1; margin-top:2px; overflow-wrap:anywhere; }
    .category { direction:ltr; font-size:8px; overflow-wrap:anywhere; }
    .manual-cell { position:relative; }
    .manual-cell::after { content:""; position:absolute; width:15px; height:13px; border:1px solid #aeb5bd; border-radius:2px; left:50%; top:50%; transform:translate(-50%,-50%); }
    .no-expiry { font-size:12px; font-weight:700; }
    .continued-head { height:26px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #b8bec5; font-size:9px; font-weight:700; }
    .continued-head .ar { direction:rtl; unicode-bidi:plaintext; }
    .report-footer { margin-top:8px; }
    .delivery-date { text-align:center; font-weight:700; margin:4px 0 7px; }
    .delivery-date .ar { direction:rtl; unicode-bidi:plaintext; font-size:10px; }
    .delivery-date .en { direction:ltr; font-size:8px; margin-top:2px; }
    .date-box { width:106px; height:17px; border:1px solid #8e969f; margin:4px auto 0; }
    .signatures { height:93px; display:grid; grid-template-columns:1fr 1fr; border:1.5px solid #626a73; }
    .signature-half { padding:8px 13px; text-align:center; }
    .signature-half + .signature-half { border-left:1px solid #626a73; }
    .signature-title-ar { direction:rtl; unicode-bidi:plaintext; font-size:11px; font-weight:700; }
    .signature-title-en { direction:ltr; font-size:8px; margin-top:2px; }
    .signature-label { margin-top:15px; direction:rtl; unicode-bidi:plaintext; font-size:9px; }
    .signature-label .en { direction:ltr; font-size:7px; margin-top:2px; }
    .signature-line { border-bottom:1px solid #8e969f; margin:5px 12px 0; }
    .page-number { position:absolute; right:${PAGE_MARGIN}px; bottom:12px; direction:ltr; font-size:9px; }
  `;
}

function field(ar, en, value, side){
  return `<div class="report-field ${side}"><div class="report-label-ar">${escapeHtml(ar)}</div><div class="report-label-en">${escapeHtml(en)}</div><div class="report-value">${escapeHtml(value)}</div></div>`;
}

function tableHeaders(t){
  const headers = [
    [t("rptColNoAr", "م"), t("rptColNoEn", "No.")],
    [t("rptColProductAr", "المنتج"), t("rptColProductEn", "Product")],
    [t("rptColCategoryAr", "القسم"), t("rptColCategoryEn", "Category")],
    [t("rptColRequestedAr", "عدد المنتجات التي طلبها الفرع"), t("rptColRequestedEn", "Number of Products Requested by Branch")],
    [t("rptColDeliveredAr", "عدد المنتجات المسلمة للفرع"), t("rptColDeliveredEn", "Number of Products Delivered to Branch")],
    [t("rptColAvailableAr", "عدد المنتجات الموجودة بالفرع بعد التسليم"), t("rptColAvailableEn", "Number of Products Available in Branch After Delivery")],
    [t("rptColExpiredAr", "عدد المنتجات المنتهية الصلاحية"), t("rptColExpiredEn", "Number of Expired Products")],
    [t("rptColNoExpiryAr", "عدد المنتجات التي لا تحمل تاريخ صلاحية"), t("rptColNoExpiryEn", "Number of Products Without Expiry Date")],
    [t("rptColNearExpiryAr", "عدد المنتجات التي بقي على صلاحيتها أقل من أسبوع"), t("rptColNearExpiryEn", "Number of Products with Less Than One Week Until Expiry")],
  ];
  const widths = ["3.5%", "20%", "8%", "9%", "9%", "11%", "9%", "11%", "19.5%"];
  return `<colgroup>${widths.map(width => `<col style="width:${width}">`).join("")}</colgroup><thead><tr>${headers.map(([ar, en]) => `<th><span class="ar">${escapeHtml(ar)}</span><span class="en">${escapeHtml(en)}</span></th>`).join("")}</tr></thead>`;
}

function tableRows(rows){
  if(!rows.length) return `<tbody><tr><td colspan="9">No products</td></tr></tbody>`;
  return `<tbody>${rows.map(row => {
    const expiry = row.noExpiry ? `<td class="no-expiry">-</td><td class="no-expiry">-</td><td class="no-expiry">-</td>` : `<td class="manual-cell"></td><td class="manual-cell"></td><td class="manual-cell"></td>`;
    return `<tr><td>${row.serial}</td><td class="product"><div class="product-ar">${escapeHtml(row.arabicName)}</div><div class="product-en">${escapeHtml(row.englishName)}</div></td><td class="category">${escapeHtml(row.category)}</td><td>${escapeHtml(row.requested)}</td><td class="manual-cell"></td><td class="manual-cell"></td>${expiry}</tr>`;
  }).join("")}</tbody>`;
}

function footer(t){
  const dateAr = t("rptDeliveryDateAr", "تاريخ التسليم والجرد");
  const dateEn = t("rptDeliveryDateEn", "Delivery & Inventory Date");
  const managerAr = t("rptBranchMgrAr", "اسم مدير الفرع");
  const managerEn = t("rptBranchMgrEn", "Branch Manager Name");
  const inspectorAr = t("rptBranchInspAr", "اسم مفتش الفرع");
  const inspectorEn = t("rptBranchInspEn", "Branch Inspector Name");
  const signatureAr = t("rptSignatureAr", "التوقيع");
  const signatureEn = t("rptSignatureEn", "Signature");
  const half = (ar, en) => `<div class="signature-half"><div class="signature-title-ar">${escapeHtml(ar)}</div><div class="signature-title-en">${escapeHtml(en)}</div><div class="signature-line"></div><div class="signature-label">${escapeHtml(signatureAr)}<div class="en">${escapeHtml(signatureEn)}</div></div><div class="signature-line"></div></div>`;
  return `<footer class="report-footer"><div class="delivery-date"><div class="ar">${escapeHtml(dateAr)}</div><div class="en">${escapeHtml(dateEn)}</div><div class="date-box"></div></div><div class="signatures">${half(inspectorAr, inspectorEn)}${half(managerAr, managerEn)}</div></footer>`;
}

function pageMarkup({ rows, first, last, pageNumber, total, ctx, t }){
  const header = first
    ? `<header class="report-top"><div class="report-brand"><img src="images/logo.png" alt="Logo"></div><div class="report-title"><div class="ar">${escapeHtml(t("rptTitleAr", "تقرير جرد وتسليم منتجات"))}</div><div class="en">${escapeHtml(t("rptTitleEn", "Products Inventory & Delivery Report"))}</div></div><div class="report-info">${field(t("rptBranchAr", "اسم الفرع"), t("rptBranchEn", "Branch Name"), ctx.branch, "left")}<div>${field(t("rptOrderDateAr", "تاريخ إنشاء التقرير"), t("rptOrderDateEn", "Report Creation Date"), ctx.date, "right")}${field(t("rptUserAr", "اسم صاحب الطلب"), t("rptUserEn", "Requester Name"), ctx.user, "right")}</div></div></header>`
    : `<header class="continued-head"><span>${escapeHtml(t("rptSubHeaderEn", "Products Inventory & Delivery Report"))}</span><span class="ar">${escapeHtml(t("rptSubHeaderAr", "تقرير جرد وتسليم منتجات"))}</span></header>`;
  return `<section class="inventory-report-page">${header}<table class="report-table">${tableHeaders(t)}${tableRows(rows)}</table>${last ? footer(t) : ""}<div class="page-number">${pageNumber} of ${total}</div></section>`;
}

async function renderPageToPdf(doc, html, pageIndex){
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;z-index:-1;background:#fff;";
  host.innerHTML = `<style>${reportStyles()}</style>${html}`;
  document.body.appendChild(host);
  try {
    await document.fonts?.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const canvas = await window.html2canvas(host.firstElementChild.nextElementSibling, { scale:2, useCORS:true, backgroundColor:"#ffffff", logging:false, width:A4.width, height:A4.height });
    if(pageIndex > 0) doc.addPage();
    doc.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297, undefined, "FAST");
  } finally {
    host.remove();
  }
}

export async function generateInventoryReportPdf(inputs){
  if(!window.jspdf?.jsPDF || !window.html2canvas) throw new Error("PDF dependencies are unavailable");
  const t = labelsFor(inputs);
  const rows = buildRows(inputs.products, inputs.cart);
  const pages = splitRows(rows);
  const ctx = { branch: inputs.customer?.branch || "", user: inputs.customer?.name || "", date: inputs.dateStr || "" };
  const doc = new window.jspdf.jsPDF({ unit:"mm", format:"a4", orientation:"portrait", compress:true });
  for(let index = 0; index < pages.length; index++){
    await renderPageToPdf(doc, pageMarkup({ rows:pages[index], first:index === 0, last:index === pages.length - 1, pageNumber:index + 1, total:pages.length, ctx, t }), index);
  }
  const fileName = `${filenamePart(ctx.branch)}-inventory-${filenamePart(ctx.date)}.pdf`;
  doc.save(fileName);
  return { pages:pages.length, fileName };
}
