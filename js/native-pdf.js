// Products Inventory & Delivery Report.
//
// Arabic is deliberately rendered by the browser's text engine, not manually
// reversed or converted to Arabic Presentation Forms.  This gives the PDF the
// same correct RTL, shaping and bidirectional behaviour as a normal document.

const A4 = { width: 794, height: 1123 };
const PAGE_MARGIN = 24;
const ROW_HEIGHT = 28;
const FIRST_HEADER_HEIGHT = 155;
const CONTINUED_HEADER_HEIGHT = 84;
const FOOTER_HEIGHT = 150;

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
      requested: requestedById.has(String(product.id)) ? requestedById.get(String(product.id)) : 0,
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
    .report-top { height:92px; border-bottom:1.5px solid #4b5563; position:relative; padding-top:3px; }
    .report-brand { height:25px; display:flex; align-items:center; justify-content:center; }
    .report-brand img { max-height:21px; max-width:94px; object-fit:contain; }
    .report-title { text-align:center; margin:1px 135px 0; }
    .report-title .ar { direction:rtl; unicode-bidi:plaintext; font-size:14px; font-weight:700; }
    .report-title .en { direction:ltr; font-size:10px; font-weight:700; margin-top:1px; }
    .report-meta { position:absolute; top:4px; min-width:145px; font-size:10px; font-weight:700; line-height:1.25; unicode-bidi:plaintext; }
    .report-meta.branch { left:0; direction:ltr; text-align:left; }
    .report-meta.customer { right:0; direction:rtl; text-align:right; }
    .report-meta.customer .label { direction:ltr; font-size:8px; font-weight:700; margin-bottom:2px; }
    .report-table { width:100%; border-collapse:collapse; table-layout:fixed; margin-top:8px; direction:ltr; }
    .report-table th { height:51px; background:#4b5563; color:#fff; padding:2px 1px; border:1px solid #fff; text-align:center; vertical-align:middle; font-weight:700; }
    .report-table th .ar { display:block; direction:rtl; unicode-bidi:plaintext; font-size:5.7px; line-height:1.06; }
    .report-table th .en { display:block; direction:ltr; font-size:4.6px; line-height:1.04; font-weight:400; margin-top:1px; overflow-wrap:anywhere; }
    .report-table td { height:${ROW_HEIGHT}px; padding:1px; border:1px solid #b8bec5; text-align:center; vertical-align:middle; overflow:hidden; font-size:10px; color:#000 !important; }
    .report-table td.report-product-cell { display:table-cell !important; min-height:0 !important; margin:0 !important; padding:1px !important; border-radius:0 !important; background:transparent !important; box-shadow:none !important; text-align:center; color:#000 !important; }
    .report-product-ar { direction:rtl; unicode-bidi:plaintext; color:#000 !important; opacity:1 !important; font-family:Arial, Tahoma, sans-serif; font-size:10px; font-weight:400; line-height:1.02; overflow-wrap:anywhere; }
    .report-product-en { direction:ltr; color:#000 !important; opacity:1 !important; font-family:Arial, Tahoma, sans-serif; font-size:7px; line-height:1; margin-top:1px; overflow-wrap:anywhere; }
    .category { direction:ltr; font-size:10px; overflow-wrap:anywhere; }
    .manual-cell { padding:0 !important; }
    .requested-cell.is-requested { background:#e5e7eb; }
    .no-expiry { font-size:12px; font-weight:700; }
    .continued-head { height:25px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid #b8bec5; font-size:8px; font-weight:700; }
    .continued-head .ar { direction:rtl; unicode-bidi:plaintext; }
    .report-footer { margin-top:8px; }
    .delivery-date { text-align:center; font-weight:700; margin:3px 0 5px; }
    .delivery-date .en { direction:ltr; font-size:9px; }
    .delivery-date .ar { direction:rtl; unicode-bidi:plaintext; font-size:7px; margin-top:1px; }
    .date-box { width:92px; height:14px; border:1px solid #8e969f; margin:3px auto 0; }
    .signatures { height:79px; display:grid; grid-template-columns:1fr 1fr; border:1.5px solid #626a73; }
    .signature-half { padding:6px 0; text-align:center; }
    .signature-half + .signature-half { border-left:1px solid #626a73; }
    .signature-pair { display:flex; justify-content:space-between; align-items:baseline; gap:8px; width:100%; }
    .signature-pair .ar { direction:rtl; unicode-bidi:plaintext; font-size:9px; font-weight:700; text-align:right; }
    .signature-pair .en { direction:ltr; font-size:7px; font-weight:700; text-align:left; }
    .signature-pair.signature-label { margin-top:10px; }
    .signature-pair.signature-label .ar { font-size:8px; font-weight:400; }
    .signature-pair.signature-label .en { font-size:6px; font-weight:400; }
    .signature-line { border-bottom:1px solid #8e969f; margin:3px 0 0; }
    .page-number { position:absolute; right:${PAGE_MARGIN}px; bottom:6px; direction:ltr; font-size:8px; background:#fff; padding-left:3px; }
  `;
}

function tableHeaders(){
  const headers = [
    ["م", "No."],
    ["المنتج", "Product"],
    ["القسم", "Category"],
    ["عدد المنتجات التي طلبها الفرع", "Number of Products Requested by Branch"],
    ["عدد المنتجات المسلمة للفرع", "Number of Products Delivered to Branch"],
    ["عدد المنتجات الموجودة بالفرع بعد التسليم", "Number of Products Available in Branch After Delivery"],
    ["عدد المنتجات المنتهية الصلاحية", "Number of Expired Products"],
    ["عدد المنتجات التي لا تحمل تاريخ صلاحية", "Number of Products Without Expiry Date"],
    ["عدد المنتجات التي بقي على صلاحيتها أقل من أسبوع", "Number of Products with Less Than One Week Until Expiry"],
  ];
  const widths = ["3.5%", "33%", "10%", "7%", "7%", "8%", "7%", "8%", "16.5%"];
  return `<colgroup>${widths.map(width => `<col style="width:${width}">`).join("")}</colgroup><thead><tr>${headers.map(([ar, en]) => `<th><span class="ar">${escapeHtml(ar)}</span><span class="en">${escapeHtml(en)}</span></th>`).join("")}</tr></thead>`;
}

function tableRows(rows){
  if(!rows.length) return `<tbody><tr><td colspan="9">No products</td></tr></tbody>`;
  return `<tbody>${rows.map(row => {
    const expiry = row.noExpiry ? `<td class="no-expiry">-</td><td class="no-expiry">-</td><td class="no-expiry">-</td>` : `<td class="manual-cell"></td><td class="manual-cell"></td><td class="manual-cell"></td>`;
    const requestedClass = Number(row.requested) > 0 ? "requested-cell is-requested" : "requested-cell";
    return `<tr><td>${row.serial}</td><td class="report-product-cell"><div class="report-product-ar">${escapeHtml(row.arabicName)}</div><div class="report-product-en">${escapeHtml(row.englishName)}</div></td><td class="category">${escapeHtml(row.category)}</td><td class="${requestedClass}">${escapeHtml(row.requested)}</td><td class="manual-cell"></td><td class="manual-cell"></td>${expiry}</tr>`;
  }).join("")}</tbody>`;
}

function footer(){
  const dateAr = "تاريخ التسليم والجرد";
  const dateEn = "Delivery & Inventory Date";
  const managerAr = "اسم مدير الفرع";
  const managerEn = "Branch Manager Name";
  const inspectorAr = "اسم مفتش الفرع";
  const inspectorEn = "Branch Inspector Name";
  const signatureAr = "التوقيع";
  const signatureEn = "Signature";
  const pair = (ar, en, extra = "") => `<div class="signature-pair ${extra}"><span class="en">${escapeHtml(en)}</span><span class="ar">${escapeHtml(ar)}</span></div>`;
  const half = (ar, en) => `<div class="signature-half">${pair(ar, en)}<div class="signature-line"></div>${pair(signatureAr, signatureEn, "signature-label")}<div class="signature-line"></div></div>`;
  return `<footer class="report-footer"><div class="delivery-date"><div class="en">${escapeHtml(dateEn)}</div><div class="ar">${escapeHtml(dateAr)}</div><div class="date-box"></div></div><div class="signatures">${half(inspectorAr, inspectorEn)}${half(managerAr, managerEn)}</div></footer>`;
}

function pageMarkup({ rows, first, last, pageNumber, total, ctx, t }){
  const header = first
    ? `<header class="report-top"><div class="report-meta branch">${escapeHtml(ctx.branch)}<br>${escapeHtml(ctx.date)}</div><div class="report-meta customer"><div class="label">Customer</div>${escapeHtml(ctx.user)}<br><span dir="ltr">Invoice No. ${escapeHtml(ctx.invoiceNo)}</span></div><div class="report-brand"><img src="images/logo.png" alt="Logo"></div><div class="report-title"><div class="ar">تقرير جرد وتسليم منتجات</div><div class="en">Products Inventory & Delivery Report</div></div></header>`
    : `<header class="continued-head"><span>Products Inventory & Delivery Report</span><span class="ar">تقرير جرد وتسليم منتجات</span></header>`;
  return `<section class="inventory-report-page">${header}<table class="report-table">${tableHeaders()}${tableRows(rows)}</table>${last ? footer() : ""}<div class="page-number">${pageNumber} of ${total}</div></section>`;
}

async function renderPageToPdf(doc, html, pageIndex){
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;z-index:-1;background:#fff;";
  host.innerHTML = `<style>${reportStyles()}</style>${html}`;
  document.body.appendChild(host);
  try {
    await document.fonts?.ready;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await new Promise(resolve => setTimeout(resolve, 50));
    const canvas = await window.html2canvas(host.firstElementChild.nextElementSibling, { scale:1.5, useCORS:true, backgroundColor:"#ffffff", logging:false, width:A4.width, height:A4.height });
    if(pageIndex > 0) doc.addPage();
    doc.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 210, 297, undefined, "FAST");
    await new Promise(resolve => setTimeout(resolve, 30));
  } finally {
    host.remove();
  }
}

export async function generateInventoryReportPdf(inputs, options = {}){
  if(!window.jspdf?.jsPDF || !window.html2canvas) throw new Error("PDF dependencies are unavailable");
  const t = labelsFor(inputs);
  const rows = buildRows(inputs.products, inputs.cart);
  const pages = splitRows(rows);
  const ctx = { branch: inputs.customer?.branch || "", user: inputs.customer?.name || "", date: inputs.dateStr || "", invoiceNo: inputs.invoiceNo || "" };
  const doc = new window.jspdf.jsPDF({ unit:"mm", format:"a4", orientation:"portrait", compress:true });
  for(let index = 0; index < pages.length; index++){
    await renderPageToPdf(doc, pageMarkup({ rows:pages[index], first:index === 0, last:index === pages.length - 1, pageNumber:index + 1, total:pages.length, ctx, t }), index);
  }
  const fileName = `${filenamePart(ctx.branch)}-inventory-${filenamePart(ctx.date)}.pdf`;
  const blob = doc.output("blob");
  if(options.save !== false) doc.save(fileName);
  return { pages:pages.length, fileName, blob };
}
