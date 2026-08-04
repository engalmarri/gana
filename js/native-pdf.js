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
const MARGIN_TOP = 6;
const MARGIN_BOTTOM = 10;   // room for page-number strip
const MARGIN_LEFT = 6;
const MARGIN_RIGHT = 6;
const INNER_W = A4_W - MARGIN_LEFT - MARGIN_RIGHT; // 198 mm

// Palette (only the 4 grays the spec allows)
const COLOR_TEXT       = [0x22, 0x22, 0x22]; // #222222
const COLOR_BORDER     = [0xBF, 0xC3, 0xC8]; // #BFC3C8
const COLOR_OUTER      = [0x70, 0x70, 0x70]; // #707070
const COLOR_HEADER_BG  = [0x4B, 0x55, 0x63]; // #4B5563
const COLOR_HEADER_FG  = [0xFF, 0xFF, 0xFF];
const COLOR_SECTION_BG = [0xE9, 0xEC, 0xEF]; // #E9ECEF
const COLOR_PAGE_BG    = [0xFF, 0xFF, 0xFF];

// Column widths (mm).  No. is small, Product is the widest, the six
// numeric inventory columns are small and equal.  Total must equal INNER_W.
const COL_W = [8, 22, 52, 18, 18, 18, 18, 18, 26];  // No., Category, Product, Requested, Delivered, Available, Expired, No Expiry, Near Expiry
// Row heights (mm)
const RH_HEADER    = 8;    // bilingual column header
const RH_PRODUCT   = 8;    // product row
// Heights for the page-level blocks
const HEADER_FIRST_H = 28;  // logo + titles + meta strip (first page only)
const HEADER_SUB_H = 12;    // tiny header on subsequent pages
const FOOTER_BAND_H = 40;   // delivery date + signature block (last page)

// Inventory input-box dimensions (fits inside the 18mm numeric columns)
const INPUT_BOX_W = 16;
const INPUT_BOX_H = 6;

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
  const cols = COL_W.map(w => ({ w }));
  const sum = cols.reduce((a, c) => a + c.w, 0);
  if(Math.abs(sum - INNER_W) > 0.01){
    console.warn("column widths sum to", sum, "but INNER_W is", INNER_W);
  }
  const edges = [MARGIN_LEFT];
  for(const c of cols){ edges.push(+(edges[edges.length-1] + c.w).toFixed(2)); }
  return { cols, left: edges, right: MARGIN_LEFT + INNER_W };
}

// ---------- First-page header (logo + title + branch/date/user) ----------

function drawFirstPageHeader(doc, ctx){
  const cx = A4_W / 2;
  let y = MARGIN_TOP;

  // Logo centered, max width 32 mm
  if(ctx.logoDataUrl){
    try { doc.addImage(ctx.logoDataUrl, "PNG", cx - 16, y, 32, 10, undefined, "FAST"); }
    catch(e){ /* ignore */ }
  }
  y += 12; // logo zone

  // Bilingual title — centered, symmetric, professional
  textLatin(doc, ctx.titleEn, cx, y, { size: 14, bold: true, align: "center" });
  textArabic(doc, ctx.titleAr, cx, y + 5.5, { size: 16, bold: true, align: "center" });

  // Decorative rule under the title
  y += 9;
  setRgb(doc, "outer");
  setLine(doc, 0.3);
  line(doc, MARGIN_LEFT + 20, y, A4_W - MARGIN_RIGHT - 20, y);

  // Meta strip: branch (left)  |  order date + user (right)
  y += 3;
  textLatin(doc, ctx.branch, MARGIN_LEFT, y + 3, { size: 9, bold: true, align: "left" });
  textLatin(doc, ctx.orderDate, A4_W - MARGIN_RIGHT, y + 3, { size: 8, bold: true, align: "right" });
  textLatin(doc, ctx.user,      A4_W - MARGIN_RIGHT, y + 7, { size: 8, bold: true, align: "right" });
  y += 10;

  return y + 2; // cursorY for the table
}

// ---------- Subsequent-page header (tiny: title + page number only) ----------

function drawSubPageHeader(doc, ctx, pageNum){
  const y = MARGIN_TOP;
  // Left: report title
  textLatin(doc, ctx.subHeaderEn, MARGIN_LEFT, y + 3, { size: 8, bold: true, align: "left" });
  // Right: page number is drawn later, once the total page count is known,
  // so the "Page X of N" label on continuation pages is always correct.
  // Thin rule below
  setRgb(doc, "border");
  setLine(doc, 0.2);
  line(doc, MARGIN_LEFT, y + 6, A4_W - MARGIN_RIGHT, y + 6);
  return y + 10; // cursorY for the table
}

// ---------- Table column header ----------

function drawTableHeader(doc, ctx, y){
  const { cols, left, right } = ctx.geom;
  const headers = ctx.headers; // [{ar,en}, ...]  length = 9
  // Background
  rect(doc, MARGIN_LEFT, y, INNER_W, RH_HEADER, "headerBg");
  // Vertical separators + top + bottom rules
  setRgb(doc, "headerFg");
  setLine(doc, 0.3);
  for(const x of left){ line(doc, x, y, x, y + RH_HEADER); }
  line(doc, MARGIN_LEFT, y, right, y);
  line(doc, MARGIN_LEFT, y + RH_HEADER, right, y + RH_HEADER);

  // Cell content: Arabic on top (~3mm), English below (~3.5mm), both
  // single line, centered, white.
  const cx = (a, b) => (a + b) / 2;
  for(let i=0; i<cols.length; i++){
    const c = cols[i];
    const midX = cx(left[i], left[i+1]);
    const cellW = c.w - 1;

    // --- Arabic: top, bold, white ---
    doc.setFont(FONT_FAMILY, "bold");
    let arSize = 7;
    doc.setFontSize(arSize);
    doc.setTextColor(0xFF, 0xFF, 0xFF);
    const arStr = headers[i].ar;
    while(arSize > 5.5 && doc.getTextWidth(arStr) > cellW){ arSize -= 0.5; doc.setFontSize(arSize); }
    doc.text(arStr, midX, y + 2.8, { align: "center" });

    // --- English: bottom, regular, white, single line ---
    doc.setFont(FONT_FAMILY, "normal");
    let enSize = 5.5;
    doc.setFontSize(enSize);
    const enStr = headers[i].en;
    while(enSize > 4.5 && doc.getTextWidth(enStr) > cellW){ enSize -= 0.5; doc.setFontSize(enSize); }
    doc.text(enStr, midX, y + 6, { align: "center" });
  }

  return y + RH_HEADER;
}

// ---------- Category separator line (drawn when the category changes) ----------

function drawCategorySeparator(doc, ctx, y){
  const { right } = ctx.geom;
  setRgb(doc, "outer");
  setLine(doc, 0.4);
  line(doc, MARGIN_LEFT, y, right, y);
  return y;
}

// ---------- Product row ----------

function drawProductRow(doc, ctx, y, row){
  const { cols, left, right } = ctx.geom;
  // Row border (top)
  setRgb(doc, "border");
  setLine(doc, 0.2);
  line(doc, MARGIN_LEFT, y, right, y);
  // Vertical separators
  for(const x of left){ line(doc, x, y, x, y + RH_PRODUCT); }
  // Bottom rule
  line(doc, MARGIN_LEFT, y + RH_PRODUCT, right, y + RH_PRODUCT);

  const midY = y + RH_PRODUCT / 2;

  // Col 0: serial (centered)
  const c0cx = (left[0] + left[1]) / 2;
  textLatin(doc, String(row.serial), c0cx, midY + 1, { size: 9, bold: true, align: "center" });

  // Col 1: category (English, centered, small)
  const c1cx = (left[1] + left[2]) / 2;
  textLatin(doc, row.catEn, c1cx, midY + 1, { size: 5.5, align: "center" });

  // Col 2: product name (Arabic top, English bottom, centered)
  const c2cx = (left[2] + left[3]) / 2;
  const productCellW = left[3] - left[2] - 1;
  // Arabic name: shrink to fit if needed
  doc.setFont(FONT_FAMILY, "bold");
  let arSize = 8;
  doc.setFontSize(arSize);
  while(arSize > 6 && doc.getTextWidth(row.ar) > productCellW){ arSize -= 0.5; doc.setFontSize(arSize); }
  textArabic(doc, row.ar, c2cx, y + 2.8, { size: arSize, bold: true, align: "center" });
  // English name: single line, centered
  doc.setFont(FONT_FAMILY, "normal");
  let enSize = 6.5;
  doc.setFontSize(enSize);
  const enStr = row.en;
  while(enSize > 5 && doc.getTextWidth(enStr) > productCellW){ enSize -= 0.5; doc.setFontSize(enSize); }
  doc.text(enStr, c2cx, y + 6, { align: "center" });

  // Col 3: requested qty (printed number)
  const c3cx = (left[3] + left[4]) / 2;
  textLatin(doc, String(row.requestedQty), c3cx, midY + 1, { size: 9, bold: true, align: "center" });

  // Cols 4..8: bordered input boxes for handwriting, centered
  for(let i=4; i<9; i++){
    const cxc = (left[i] + left[i+1]) / 2;
    const bx = cxc - INPUT_BOX_W/2;
    const by = y + (RH_PRODUCT - INPUT_BOX_H) / 2;
    setRgb(doc, "border");
    setLine(doc, 0.2);
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

  // For each category: in-cart (preserve order), then not-in-cart
  // Every row carries its Category in the dedicated Category column.
  const rows = [];
  let serial = 0;
  for(const cat of orderedCats){
    const all = groups[cat] || [];
    const inCart = all.filter(p => cartIds.has(String(p.id)));
    const notInCart = all.filter(p => !cartIds.has(String(p.id)));
    const catEn = EN_CAT[cat] || cat;
    for(const p of [...inCart, ...notInCart]){
      serial++;
      const c = cartById.get(String(p.id));
      rows.push({
        type: "product",
        serial,
        catEn,
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
    subHeaderEn: t("rptSubHeaderEn") || "Products Delivery & Inventory Report",
    branch: (inputs.customer && inputs.customer.branch) || "",
    orderDate: inputs.dateStr || "",
    user: (inputs.customer && inputs.customer.name) || "",
    deliveryDateLabel: t("rptDeliveryDateEn") || "Delivery & Inventory Date",
    signMgrLabel:  t("rptBranchMgrEn")  || "Branch Manager Name",
    signInspLabel: t("rptBranchInspEn") || "Branch Inspector Name",
    signatureLabel: t("rptSignatureEn") || "Signature",
    headers: [
      { ar: t("rptColNoAr")        || "م",       en: t("rptColNoEn")        || "No." },
      { ar: t("rptColCategoryAr")  || "القسم",  en: t("rptColCategoryEn")  || "Category" },
      { ar: t("rptColProductAr")   || "المنتج", en: t("rptColProductEn")   || "Product" },
      { ar: t("rptColRequestedAr") || "المطلوب",en: t("rptColRequestedEn") || "Requested" },
      { ar: t("rptColDeliveredAr") || "المسلم", en: t("rptColDeliveredEn") || "Delivered" },
      { ar: t("rptColAvailableAr") || "المتوفر",en: t("rptColAvailableEn") || "Available" },
      { ar: t("rptColExpiredAr")   || "المنتهي",en: t("rptColExpiredEn")   || "Expired" },
      { ar: t("rptColNoExpiryAr")  || "بدون صلاحية", en: t("rptColNoExpiryEn")  || "No Expiry" },
      { ar: t("rptColNearExpiryAr")|| "قارب الانتهاء", en: t("rptColNearExpiryEn") || "Near Expiry" },
    ],
    logoDataUrl,
  };

  // First page
  let cursorY = drawFirstPageHeader(doc, ctx);
  cursorY = drawTableHeader(doc, ctx, cursorY);

  // If we have no rows, leave a "no products" note
  if(rows.length === 0){
    setRgb(doc, "text");
    textLatin(doc, t("rptNoProducts") || "No products", A4_W/2, cursorY + 6, { size: 10, align: "center" });
    cursorY += 10;
  } else {
    let prevCat = null;
    for(let i=0; i<rows.length; i++){
      const r = rows[i];
      // Page break: if the next product doesn't fit, start a new page
      const bottomLimit = A4_H - MARGIN_BOTTOM;
      if(cursorY + RH_PRODUCT > bottomLimit){
        doc.addPage();
        cursorY = drawSubPageHeader(doc, ctx, doc.getNumberOfPages());
        cursorY = drawTableHeader(doc, ctx, cursorY);
        // after a page break, we also need a category separator if the
        // category changes right at the page boundary
        prevCat = null;
      }
      // Draw a separator line when the category changes
      if(prevCat !== null && prevCat !== r.catEn){
        cursorY = drawCategorySeparator(doc, ctx, cursorY);
      }
      prevCat = r.catEn;
      cursorY = drawProductRow(doc, ctx, cursorY, r);
    }
  }

  // Footer (last page only)
  ctx.cursorY = cursorY;
  // Reserve space for the footer block.  If not enough, push to a new page.
  if(cursorY + FOOTER_BAND_H > A4_H - MARGIN_BOTTOM){
    doc.addPage();
    cursorY = drawSubPageHeader(doc, ctx, doc.getNumberOfPages());
    cursorY = drawTableHeader(doc, ctx, cursorY);
    ctx.cursorY = cursorY;
  }
  drawFooter(doc, ctx);

  // Page numbers on every page; the continuation-page sub-header also
  // carries a "Page X of N" label on the right, drawn now that the total
  // page count is known.
  const total = doc.getNumberOfPages();
  for(let p = 1; p <= total; p++){
    doc.setPage(p);
    drawPageNumber(doc, total, p);
    if(p >= 2){
      textLatin(doc, `Page ${p} of ${total}`, A4_W - MARGIN_RIGHT, MARGIN_TOP + 3, { size: 8, align: "right" });
    }
  }

  // Save
  const branch = String((inputs.customer && inputs.customer.branch) || "report").replace(/[^0-9A-Za-z _-]/g, "") || "report";
  const dateStr = (inputs.dateStr || "").replace(/[^0-9A-Za-z-]/g, "") || "report";
  const fname = `${branch}-inventory-${dateStr}.pdf`;
  doc.save(fname);

  return { pages: total, fileName: fname };
}
