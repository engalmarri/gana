// Branch Products Monitoring (Inventory) Report — vector PDF generator.
//
// Produces a fully vector A4 PDF using jsPDF native APIs.  Arabic text is
// rendered with the embedded Tajawal TTF (regular + bold).  The font's
// own OpenType GSUB table handles Arabic shaping at PDF-read time — we
// therefore pass text UNSHAPED (logical order) and let the reader apply
// the correct presentation forms.  This is the standard approach for
// embedding Arabic-capable TTFs in a PDF.
//
// Layout: corporate inventory form.  No html2canvas, no autoTable default
// styling, no third-party themes.  Every line, border, header, and cell is
// drawn manually.

const FONT_REG_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/tajawal/Tajawal-Regular.ttf";
const FONT_BOLD_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/tajawal/Tajawal-Bold.ttf";
const FONT_FAMILY = "Tajawal";
const LOGO_URL = "images/logo.png";

// A4 portrait, mm
const A4_W = 210;
const A4_H = 297;
const MARGIN_TOP = 12;
const MARGIN_BOTTOM = 14;   // extra for page-number strip
const MARGIN_LEFT = 10;
const MARGIN_RIGHT = 10;
const INNER_W = A4_W - MARGIN_LEFT - MARGIN_RIGHT; // 190 mm

// Palette (only the 4 grays the spec allows)
const COLOR_TEXT       = [0x22, 0x22, 0x22]; // #222222
const COLOR_BORDER     = [0xBF, 0xC3, 0xC8]; // #BFC3C8
const COLOR_OUTER      = [0x70, 0x70, 0x70]; // #707070
const COLOR_HEADER_BG  = [0x4B, 0x55, 0x63]; // #4B5563
const COLOR_HEADER_FG  = [0xFF, 0xFF, 0xFF];
const COLOR_SECTION_BG = [0xE9, 0xEC, 0xEF]; // #E9ECEF
const COLOR_PAGE_BG    = [0xFF, 0xFF, 0xFF];

// 8 columns.  The spec specifies percentages, but I redistribute to give
// the Product column more space while keeping the five inventory columns
// equal-width.
const COL_PCT = {
  no:         0.04,   // No.
  product:    0.24,   // Product
  requested:  0.12,   // Number of Products Requested by Branch
  delivered:  0.12,   // Number of Products Delivered to Branch
  available:  0.12,   // Number of Products Available After Delivery
  expired:    0.12,   // Number of Expired Products
  noExpiry:   0.12,   // Number of Products Without Expiry Date
  nearExpiry: 0.12,   // Number of Products Nearing Expiry
};
// Row heights (mm)
const RH_HEADER    = 16;   // bilingual column header (Arabic + wrapped English)
const RH_SECTION   = 13;   // category band
const RH_PRODUCT   = 14;   // product row (Arabic name + English name)
// Heights for the page-level blocks
const HEADER_BAND_H = 28;  // logo + titles + meta strip (top of every page)
const FOOTER_BAND_H = 52;  // delivery date + signature block (last page)

// Inventory input-box dimensions (per spec)
const INPUT_BOX_W = 24;
const INPUT_BOX_H = 10;

// ---------- Font loading ----------

let _fontsReady = null;
function loadFonts(){
  if(_fontsReady) return _fontsReady;
  _fontsReady = (async ()=>{
    async function fetchB64(url){
      const r = await fetch(url, { mode:"cors" });
      if(!r.ok) throw new Error("font fetch failed "+r.status+" "+url);
      const ab = await r.arrayBuffer();
      const bytes = new Uint8Array(ab);
      let bin = "";
      const chunk = 0x8000;
      for(let i=0; i<bytes.length; i+=chunk){
        bin += String.fromCharCode.apply(null, bytes.subarray(i, i+chunk));
      }
      return btoa(bin);
    }
    const [reg, bold] = await Promise.all([fetchB64(FONT_REG_URL), fetchB64(FONT_BOLD_URL)]);
    const { jsPDF } = window.jspdf;
    jsPDF.API.events.push(["initialized", function(){
      this.addFileToVFS("Tajawal-Regular.ttf", reg);
      this.addFont("Tajawal-Regular.ttf", FONT_FAMILY, "normal");
      this.addFileToVFS("Tajawal-Bold.ttf", bold);
      this.addFont("Tajawal-Bold.ttf", FONT_FAMILY, "bold");
    }]);
    return { reg, bold };
  })();
  return _fontsReady;
}

// ---------- Helpers ----------

function setRgb(doc, key){
  const c = ({
    text:       COLOR_TEXT,
    border:     COLOR_BORDER,
    outer:      COLOR_OUTER,
    headerBg:   COLOR_HEADER_BG,
    headerFg:   COLOR_HEADER_FG,
    sectionBg:  COLOR_SECTION_BG,
    pageBg:     COLOR_PAGE_BG,
  })[key];
  if(!c) throw new Error("unknown color key "+key);
  doc.setTextColor(c[0], c[1], c[2]);
  doc.setDrawColor(c[0], c[1], c[2]);
}

function setFill(doc, key){
  const c = ({
    headerBg:   COLOR_HEADER_BG,
    sectionBg:  COLOR_SECTION_BG,
    pageBg:     COLOR_PAGE_BG,
    text:       COLOR_TEXT,
    border:     COLOR_BORDER,
  })[key];
  if(!c) throw new Error("unknown fill color key "+key);
  doc.setFillColor(c[0], c[1], c[2]);
}

function setLine(doc, w){
  doc.setLineWidth(w);
}

function rect(doc, x, y, w, h, fillKey, strokeKey){
  if(fillKey){
    setFill(doc, fillKey);
    if(strokeKey){
      doc.rect(x, y, w, h, "FD");
    } else {
      doc.rect(x, y, w, h, "F");
    }
  } else if(strokeKey){
    setRgb(doc, strokeKey);
    doc.rect(x, y, w, h, "S");
  }
}

function line(doc, x1, y1, x2, y2){
  doc.line(x1, y1, x2, y2);
}

// Write Latin text using the embedded Tajawal font (it covers Latin too).
function textLatin(doc, str, x, y, opts){
  opts = opts || {};
  const style = opts.bold ? "bold" : "normal";
  doc.setFont(FONT_FAMILY, style);
  doc.setFontSize(opts.size || 10);
  setRgb(doc, opts.color || "text");
  doc.text(str, x, y, { align: opts.align || "left" });
}

// Write Arabic text using Tajawal.  We pass the string UNSHAPED in logical
// order; the font's GSUB table (OpenType layout) at render time will
// substitute the correct presentation forms (initial / medial / final /
// isolated).  jsPDF draws LTR — the PDF reader applies RTL bidi to mirror
// the visual order, so a string like "منتج 5" displays as "5 منتج".
function textArabic(doc, str, x, y, opts){
  opts = opts || {};
  if(!str) return;
  const style = opts.bold ? "bold" : "normal";
  doc.setFont(FONT_FAMILY, style);
  doc.setFontSize(opts.size || 10);
  setRgb(doc, opts.color || "text");
  doc.text(str, x, y, { align: opts.align || "right" });
}

// Text + simple width measurement (Latin / numbers).  Arabic width is
// measured the same way since shapeArabic returns presentation forms that
// jsPDF draws LTR.
function measureText(doc, str, size, bold){
  doc.setFont(FONT_FAMILY, bold ? "bold" : "normal");
  doc.setFontSize(size);
  return doc.getTextWidth(str);
}

// ---------- Column geometry ----------

function makeCols(){
  const cols = [
    { key:"no",         w: +(INNER_W * COL_PCT.no).toFixed(2) },
    { key:"product",    w: +(INNER_W * COL_PCT.product).toFixed(2) },
    { key:"requested",  w: +(INNER_W * COL_PCT.requested).toFixed(2) },
    { key:"delivered",  w: +(INNER_W * COL_PCT.delivered).toFixed(2) },
    { key:"available",  w: +(INNER_W * COL_PCT.available).toFixed(2) },
    { key:"expired",    w: +(INNER_W * COL_PCT.expired).toFixed(2) },
    { key:"noExpiry",   w: +(INNER_W * COL_PCT.noExpiry).toFixed(2) },
    { key:"nearExpiry", w: +(INNER_W * COL_PCT.nearExpiry).toFixed(2) },
  ];
  // Recompute so the last column absorbs rounding
  const sum = cols.reduce((a, c) => a + c.w, 0);
  cols[cols.length-1].w += +(INNER_W - sum).toFixed(2);
  // Build left edges
  const edges = [MARGIN_LEFT];
  for(const c of cols){ edges.push(+(edges[edges.length-1] + c.w).toFixed(2)); }
  return { cols, left: edges, right: MARGIN_LEFT + INNER_W };
}

// ---------- Page header (logo + title + branch/date/user) ----------

function drawPageHeader(doc, ctx){
  const cx = A4_W / 2;
  let y = MARGIN_TOP;

  // Logo centered, max width 32 mm
  if(ctx.logoDataUrl){
    try { doc.addImage(ctx.logoDataUrl, "PNG", cx - 16, y, 32, 12, undefined, "FAST"); }
    catch(e){ /* ignore */ }
  }
  y += 14; // logo zone

  // Bilingual title — centered, symmetric, professional
  // English title 16pt bold, Arabic title 18pt bold
  textLatin(doc, ctx.titleEn, cx, y, { size: 16, bold: true, align: "center" });
  textArabic(doc, ctx.titleAr, cx, y + 6, { size: 18, bold: true, align: "center" });

  // Decorative rule under the title
  y += 12;
  setRgb(doc, "outer");
  setLine(doc, 0.4);
  line(doc, MARGIN_LEFT + 15, y, A4_W - MARGIN_RIGHT - 15, y);

  // Meta strip: branch (left)  |  order date + user (right)
  y += 4;
  textLatin(doc, ctx.branch, MARGIN_LEFT, y + 4, { size: 11, bold: true, align: "left" });
  textLatin(doc, ctx.orderDate, A4_W - MARGIN_RIGHT, y + 4, { size: 10, bold: true, align: "right" });
  textLatin(doc, ctx.user,      A4_W - MARGIN_RIGHT, y + 8.5, { size: 10, bold: true, align: "right" });
  y += 12;

  return y + 2; // cursorY for the table
}

// ---------- Table column header ----------

function drawTableHeader(doc, ctx, y){
  const { cols, left, right } = ctx.geom;
  const headers = ctx.headers; // [{ar,en}, ...]  length = 8
  // Background
  rect(doc, MARGIN_LEFT, y, INNER_W, RH_HEADER, "headerBg");
  // Vertical separators + top + bottom rules
  setRgb(doc, "headerFg");
  setLine(doc, 0.4);
  for(const x of left){ line(doc, x, y, x, y + RH_HEADER); }
  line(doc, MARGIN_LEFT, y, right, y);
  line(doc, MARGIN_LEFT, y + RH_HEADER, right, y + RH_HEADER);

  // Cell content layout:
  //   top half  (6mm): Arabic header (bold, shrink-to-fit)
  //   bottom half (8mm): English header (wrapped, centered vertically)
  const cx = (a, b) => (a + b) / 2;
  for(let i=0; i<cols.length; i++){
    const c = cols[i];
    const midX = cx(left[i], left[i+1]);
    const cellW = c.w - 1.5;

    // --- Arabic: top half, single line, bold, white ---
    doc.setFont(FONT_FAMILY, "bold");
    let arSize = 8;
    doc.setFontSize(arSize);
    doc.setTextColor(0xFF, 0xFF, 0xFF);
    const arStr = headers[i].ar;
    while(arSize > 6 && doc.getTextWidth(arStr) > cellW){ arSize -= 0.5; doc.setFontSize(arSize); }
    doc.text(arStr, midX, y + 4.5, { align: "center" });

    // --- English: bottom half, wrapped, regular, white ---
    doc.setFont(FONT_FAMILY, "normal");
    doc.setFontSize(6.5);
    const enStr = headers[i].en;
    const lines = doc.splitTextToSize(enStr, cellW);
    const lineH = 2.6;
    // vertical-center the wrapped block in the bottom 8mm (y+7.5 to y+14.5)
    const blockH = lines.length * lineH;
    const startY = y + 7.5 + (7 - blockH) / 2 + lineH - 0.5;
    for(let li=0; li<lines.length; li++){
      doc.text(lines[li], midX, startY + li*lineH, { align: "center" });
    }
  }

  return y + RH_HEADER;
}

// ---------- Category band ----------

function drawCategoryBand(doc, ctx, y, catAr, catEn){
  const { left, right } = ctx.geom;
  // Background spans full table width
  rect(doc, MARGIN_LEFT, y, INNER_W, RH_SECTION, "sectionBg");
  // Top/bottom rules
  setRgb(doc, "border");
  setLine(doc, 0.3);
  line(doc, MARGIN_LEFT, y, right, y);
  line(doc, MARGIN_LEFT, y + RH_SECTION, right, y + RH_SECTION);
  // Text: English on top (bold), Arabic below (bold, larger), both centered
  const cx = (left[0] + right) / 2;
  textLatin(doc, catEn, cx, y + 6, { size: 12, bold: true, align: "center" });
  textArabic(doc, catAr, cx, y + 10.5, { size: 13, bold: true, align: "center" });
  return y + RH_SECTION;
}

// ---------- Product row ----------

function drawProductRow(doc, ctx, y, row){
  const { cols, left, right } = ctx.geom;
  // Row border (top)
  setRgb(doc, "border");
  setLine(doc, 0.3);
  line(doc, MARGIN_LEFT, y, right, y);
  // Vertical separators
  for(const x of left){ line(doc, x, y, x, y + RH_PRODUCT); }
  // Bottom rule
  line(doc, MARGIN_LEFT, y + RH_PRODUCT, right, y + RH_PRODUCT);

  // Col 0: serial (centered)
  const c0cx = (left[0] + left[1]) / 2;
  textLatin(doc, String(row.serial), c0cx, y + RH_PRODUCT/2 + 2, { size: 13, bold: true, align: "center" });

  // Col 1: product name (Arabic top, English bottom, centered vertically)
  // The Product column is the widest (24%) so we have room for two clearly
  // separated lines.  Arabic sits in the top half, English in the bottom.
  const c1cx = (left[1] + left[2]) / 2;
  const productCellW = left[2] - left[1] - 2;
  // Arabic name: shrink to fit if needed
  doc.setFont(FONT_FAMILY, "bold");
  doc.setFontSize(11);
  let arSize = 11;
  while(arSize > 8 && doc.getTextWidth(row.ar) > productCellW){ arSize -= 1; doc.setFontSize(arSize); }
  textArabic(doc, row.ar, c1cx, y + 5.5, { size: arSize, bold: true, align: "center" });
  // English name: wrapped, centered
  doc.setFont(FONT_FAMILY, "normal");
  doc.setFontSize(9);
  const enLines = doc.splitTextToSize(row.en, productCellW);
  const enLineH = 3.2;
  const enStartY = y + 11.2;
  for(let li=0; li<enLines.length; li++){
    doc.text(enLines[li], c1cx, enStartY + li*enLineH, { align: "center" });
  }

  // Col 2: requested qty (printed number)
  const c2cx = (left[2] + left[3]) / 2;
  textLatin(doc, String(row.requestedQty), c2cx, y + RH_PRODUCT/2 + 2, { size: 13, bold: true, align: "center" });

  // Cols 3..7: bordered input boxes for handwriting, centered
  for(let i=3; i<8; i++){
    const cxc = (left[i] + left[i+1]) / 2;
    const bx = cxc - INPUT_BOX_W/2;
    const by = y + (RH_PRODUCT - INPUT_BOX_H) / 2;
    setRgb(doc, "border");
    setLine(doc, 0.25);
    doc.rect(bx, by, INPUT_BOX_W, INPUT_BOX_H);
  }
  return y + RH_PRODUCT;
}

// ---------- Footer (last page only) ----------

function drawFooter(doc, ctx){
  let y = ctx.cursorY + 6;
  const cx = A4_W / 2;

  // Delivery & inventory date label + empty box
  textLatin(doc, ctx.deliveryDateLabel, cx, y, { size: 11, bold: true, align: "center" });
  const boxW = 50, boxH = 10;
  setRgb(doc, "border");
  setLine(doc, 0.3);
  doc.rect(cx - boxW/2, y + 2, boxW, boxH);
  y += 2 + boxH + 6;

  // Signature area: 2 columns
  const blockW = INNER_W;
  const blockH = 32;
  setRgb(doc, "border");
  setLine(doc, 0.3);
  doc.rect(MARGIN_LEFT, y, blockW, blockH);
  // Vertical separator
  const midX = MARGIN_LEFT + blockW/2;
  line(doc, midX, y, midX, y + blockH);

  // Right column (Branch Manager)
  drawSignatureColumn(doc, ctx.signMgrLabel, ctx.signatureLabel, MARGIN_LEFT, y, blockW/2, blockH, /*rtl*/ true);
  // Left column (Branch Inspector)
  drawSignatureColumn(doc, ctx.signInspLabel, ctx.signatureLabel, midX, y, blockW/2, blockH, /*rtl*/ false);
}

function drawSignatureColumn(doc, nameLabel, sigLabel, x, y, w, h, rtl){
  // Name label (bold)
  if(rtl){
    textArabic(doc, nameLabel, x + w - 2, y + 5, { size: 11, bold: true, align: "right" });
  } else {
    textLatin(doc, nameLabel, x + 2, y + 5, { size: 11, bold: true, align: "left" });
  }
  // Name line
  setRgb(doc, "border");
  setLine(doc, 0.25);
  const nameY = y + 12;
  line(doc, x + 4, nameY, x + w - 4, nameY);

  // Signature label
  const sigY = y + 16;
  if(rtl){
    textArabic(doc, sigLabel, x + w - 2, sigY, { size: 10, align: "right" });
  } else {
    textLatin(doc, sigLabel, x + 2, sigY, { size: 10, align: "left" });
  }
  // Signature line
  const sigLineY = y + 24;
  line(doc, x + 4, sigLineY, x + w - 4, sigLineY);
}

// ---------- Page number ----------

function drawPageNumber(doc, total, cur){
  setRgb(doc, "text");
  textLatin(doc, `Page ${cur} of ${total}`, A4_W - MARGIN_RIGHT, A4_H - MARGIN_BOTTOM + 8, { size: 9, align: "right" });
}

// ---------- Main build ----------

export async function generateInventoryReportPdf(inputs){
  await loadFonts();

  const { jsPDF } = window.jspdf;
  const labels = inputs.labels || {};
  const t = (k) => labels[k] || k;
  const lang = inputs.lang || "ar";

  // === Build product rows in category order, with cart first then 0-qty ===
  const cartIds = new Set((inputs.cart || []).map(c => String(c.id)));
  const cartById = new Map();
  (inputs.cart || []).forEach(c => cartById.set(String(c.id), c));

  const CAT_ORDER = ["قسم المعمل","قسم السوبرماركت","قسم محلات الجملة","قسم المستودع","احتياجات المعمل"];
  const EN_CAT = {
    "قسم المعمل":        "Lab",
    "قسم السوبرماركت":   "Supermarket",
    "قسم محلات الجملة":  "Wholesale",
    "قسم المستودع":      "Warehouse",
    "احتياجات المعمل":    "Lab Needs",
  };
  const groups = {};
  (inputs.products || []).forEach(p => {
    const c = p.category || "Other";
    if(!groups[c]) groups[c] = [];
    groups[c].push(p);
  });
  const orderedCats = [];
  CAT_ORDER.forEach(c => { if(groups[c] && groups[c].length) orderedCats.push(c); });
  Object.keys(groups).forEach(c => { if(!orderedCats.includes(c)) orderedCats.push(c); });

  // For each category: section, then in-cart (preserve order), then not-in-cart
  const rows = [];
  let serial = 0;
  for(const cat of orderedCats){
    const all = groups[cat] || [];
    const inCart = all.filter(p => cartIds.has(String(p.id)));
    const notInCart = all.filter(p => !cartIds.has(String(p.id)));
    rows.push({ type: "section", catAr: cat, catEn: EN_CAT[cat] || cat });
    for(const p of [...inCart, ...notInCart]){
      serial++;
      const c = cartById.get(String(p.id));
      rows.push({
        type: "product",
        serial,
        ar: p.name || "",
        en: p.description || p.nameEn || p.name || "",
        requestedQty: c ? (c.qty || 0) : 0,
      });
    }
  }

  // === PDF setup ===
  const doc = new jsPDF({ unit:"mm", format:"a4", orientation:"portrait", putOnlyUsedFonts:true });
  // Set white page background
  setFill(doc, "pageBg");
  doc.rect(0, 0, A4_W, A4_H, "F");

  // Try to load the logo as a base64 data URL
  let logoDataUrl = null;
  try {
    if(typeof window.__SIMSIM_LOGO_DATAURL === "string"){
      logoDataUrl = window.__SIMSIM_LOGO_DATAURL;
    } else {
      const r = await fetch(LOGO_URL);
      if(r.ok){
        const ab = await r.arrayBuffer();
        const bytes = new Uint8Array(ab);
        let bin = "";
        for(let i=0; i<bytes.length; i+=0x8000){
          bin += String.fromCharCode.apply(null, bytes.subarray(i, i+0x8000));
        }
        logoDataUrl = "data:image/png;base64," + btoa(bin);
        window.__SIMSIM_LOGO_DATAURL = logoDataUrl;
      }
    }
  } catch(e){ /* logo missing — skip */ }

  const ctx = {
    geom: makeCols(),
    titleAr: t("rptTitleAr") || "تقرير جرد وتسليم منتجات",
    titleEn: t("rptTitleEn") || "Branch Products Monitoring Report",
    branch: (inputs.customer && inputs.customer.branch) || "",
    orderDate: inputs.dateStr || "",
    user: (inputs.customer && inputs.customer.name) || "",
    deliveryDateLabel: t("rptDeliveryDateEn") || "Delivery & Inventory Date",
    signMgrLabel:  t("rptBranchMgrEn")  || "Branch Manager Name",
    signInspLabel: t("rptBranchInspEn") || "Branch Inspector Name",
    signatureLabel: t("rptSignatureEn") || "Signature",
    headers: [
      { ar: t("rptColNoAr")         || "م", en: t("rptColNoEn")         || "No." },
      { ar: t("rptColProductAr")     || "المنتج", en: t("rptColProductEn")     || "Product" },
      { ar: t("rptColRequestedAr")  || "عدد المنتجات التي طلبها الفرع",   en: t("rptColRequestedEn")  || "Number of Products Requested by Branch" },
      { ar: t("rptColDeliveredAr")  || "عدد المنتجات المسلمة للفرع",   en: t("rptColDeliveredEn")  || "Number of Products Delivered to Branch" },
      { ar: t("rptColAvailableAr")  || "عدد المنتجات الموجودة بالفرع بعد التسليم", en: t("rptColAvailableEn")  || "Number of Products Available in Branch After Delivery" },
      { ar: t("rptColExpiredAr")    || "عدد المنتجات المنتهية الصلاحية",  en: t("rptColExpiredEn")    || "Number of Expired Products" },
      { ar: t("rptColNoExpiryAr")   || "عدد المنتجات التي لا تحمل تاريخ صلاحية", en: t("rptColNoExpiryEn")   || "Number of Products Without Expiry Date" },
      { ar: t("rptColNearExpiryAr") || "عدد المنتجات التي قارب تاريخها على الانتهاء", en: t("rptColNearExpiryEn") || "Number of Products Nearing Expiry" },
    ],
    logoDataUrl,
  };

  // First page
  let cursorY = drawPageHeader(doc, ctx);
  cursorY = drawTableHeader(doc, ctx, cursorY);

  // If we have no rows, leave a "no products" note
  if(rows.length === 0){
    setRgb(doc, "text");
    textLatin(doc, t("rptNoProducts") || "No products", A4_W/2, cursorY + 8, { size: 12, align: "center" });
    cursorY += 14;
  } else {
    for(let i=0; i<rows.length; i++){
      const r = rows[i];
      const needH = r.type === "section" ? RH_SECTION : RH_PRODUCT;
      // Page break: keep section + first product together
      const minRequired = r.type === "section" ? RH_SECTION + RH_PRODUCT : RH_PRODUCT;
      const bottomLimit = A4_H - MARGIN_BOTTOM;
      // We need room for the section/product AND the rest of the page-block
      // (header + table header on next page) = HEADER_BAND_H + RH_HEADER.
      // Reserve enough to draw at least the next product too.
      if(cursorY + minRequired + HEADER_BAND_H + RH_HEADER > bottomLimit){
        // New page
        doc.addPage();
        cursorY = drawPageHeader(doc, ctx);
        cursorY = drawTableHeader(doc, ctx, cursorY);
      }
      if(r.type === "section"){
        cursorY = drawCategoryBand(doc, ctx, cursorY, r.catAr, r.catEn);
      } else {
        cursorY = drawProductRow(doc, ctx, cursorY, r);
      }
    }
  }

  // Footer (last page only)
  ctx.cursorY = cursorY;
  // Reserve space for the footer block.  If not enough, push to a new page.
  if(cursorY + FOOTER_BAND_H > A4_H - MARGIN_BOTTOM){
    doc.addPage();
    cursorY = drawPageHeader(doc, ctx);
    cursorY = drawTableHeader(doc, ctx, cursorY);
    ctx.cursorY = cursorY;
  }
  drawFooter(doc, ctx);

  // Page numbers on every page
  const total = doc.getNumberOfPages();
  for(let p = 1; p <= total; p++){
    doc.setPage(p);
    drawPageNumber(doc, total, p);
  }

  // Save
  const branch = (inputs.customer && inputs.customer.branch) || "report";
  const dateStr = (inputs.dateStr || "").replace(/-/g,"") || "report";
  const fname = `${branch}-inventory-${dateStr}.pdf`;
  doc.save(fname);

  return { pages: total, fileName: fname };
}
