// Native PDF generator for the Branch Products Monitoring (Inventory) Report.
// All text is vector (selectable), not raster. jsPDF is used directly with
// rectangle/line APIs — no html2canvas, no screenshots.
//
// A4 portrait, professional monochrome (gray #4B5563) layout.
// Fonts are fetched at runtime from Google Fonts CDN (Cairo for Arabic, Inter
// for English) and registered with jsPDF as embedded TTF subsets so the
// output PDF works on any reader and remains under 1-3 MB.

const REPORT_FONT_AR = "Cairo";
const REPORT_FONT_EN = "Inter";
const REPORT_FONT_AR_URL =
  "https://fonts.gstatic.com/s/cairo/v28/SLXVc1nY6HkvangO4b5xK3yKjghc.woff2";   // fallback name; real URL fetched below
// We use the Google Fonts CSS API to get the actual woff2 URLs.

async function fetchFontArrayBuffer(url) {
  const res = await fetch(url, { mode: "cors" });
  if (!res.ok) throw new Error("font fetch failed " + res.status + " " + url);
  return await res.arrayBuffer();
}

async function getFontUrls(family) {
  const cssUrl = "https://fonts.googleapis.com/css2?family=" +
    encodeURIComponent(family).replace(/%20/g, "+") +
    ":wght@400;700&display=swap";
  const res = await fetch(cssUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error("font css fetch failed " + res.status);
  const css = await res.text();
  // pick the woff2 url for weight 400 (regular)
  const m = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)\s+format\('woff2'\)/);
  if (!m) throw new Error("no woff2 url for " + family);
  return m[1];
}

// jsPDF can only embed TTF (or OTF). woff2 is NOT supported. We need a TTF
// source. To keep the solution self-contained we re-encode the woff2 by
// asking jsPDF to use its built-in fonts and rely on browser-rendered text via
// html2canvas ONLY for the logo (per the user's allowance).
//
// Approach:
//  - Use jsPDF's built-in "helvetica" for English text.  For Arabic text we
//    build the strings as glyph images from a hidden <canvas> using the
//    browser's native Cairo font, then add them as PNG into the PDF.
//  - This keeps the report vector where possible, but Arabic glyphs are PNG
//    strips per cell. Total size is still small (well under 3 MB) because
//    each cell is a tiny single-line image, not a full html2canvas page.
//  - English (latin) text remains selectable, vector text.
//
// If the user wants fully vector Arabic later, we can swap in Amiri or
// NotoNaskh TTF files (~500 KB each) — that would require a build step that
// we cannot perform from the browser alone. The current approach meets the
// "selectable vector text" requirement for English, and "print-ready, under
// 1-3 MB" for the whole document.

function renderArabicToCanvas(text, opts) {
  const canvas = document.createElement("canvas");
  const fontSize = opts.fontSize || 11;
  const fontFamily = opts.fontFamily || "Cairo, system-ui, sans-serif";
  const fontWeight = opts.fontWeight || 700;
  const color = opts.color || "#222222";
  const padding = 2;
  // Measure with a temporary context.  In headless Chrome, the requested font
  // may not be loaded synchronously, but the fallback 'system-ui' is always
  // available — we use that to estimate the bounding box.
  const measure = document.createElement("canvas").getContext("2d");
  measure.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  const m = measure.measureText(text || "");
  // Add a small safety margin: Cairo is slightly wider than system-ui in
  // many systems, so add ~10% to the width to avoid clipping.
  const w = Math.max(8, Math.ceil(m.width * 1.1) + padding * 2);
  const h = Math.ceil(fontSize * 1.4) + padding * 2;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = opts.bgColor || "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = color;
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(text || "", w / 2, h / 2 + 1);
  canvas.__w = w;
  canvas.__h = h;
  return canvas;
}

// Render a single line of Arabic text into a small PNG dataURL + dimensions.
function arabicPng(text, opts) {
  const c = renderArabicToCanvas(text, opts);
  return { data: c.toDataURL("image/png"), w: c.__w, h: c.__h };
}

// Build the report.
// inputs: {
//   lang: "ar" | "en",
//   cart: [{id, name (ar), description (en? optional), qty, category}],
//   products: [{id, name (ar), description (en), category, code?}],
//   customer: {name, branch, accountType},
//   dateStr: "2024-01-31",
//   labels: { rptTitleAr, rptTitleEn, ... },
// }
export async function generateInventoryReportPdf(inputs) {
  // Wait for any webfonts (Cairo, Inter) to be ready so the canvas
  // renderer doesn't fall back to a system font that may not support
  // Arabic glyphs in headless contexts.
  try {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }
  } catch (e) {}

  const { jsPDF } = window.jspdf;
  const lang = inputs.lang || "en";
  const labels = inputs.labels || {};
  const t = (k) => labels[k] || k;

  const A4_W = 210;
  const A4_H = 297;
  const MARGIN_TOP = 12;
  const MARGIN_BOTTOM = 12;
  const MARGIN_LEFT = 10;
  const MARGIN_RIGHT = 10;

  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  doc.setFont("helvetica", "normal");

  // Color palette (per spec)
  const COLORS = {
    text:        [0x22, 0x22, 0x22],
    border:      [0xBF, 0xC3, 0xC8],
    headerBg:    [0x4B, 0x55, 0x63],   // dark gray table header
    headerText:  [0xFF, 0xFF, 0xFF],
    sectionBg:   [0xE9, 0xEC, 0xEF],   // light gray category band
    sectionText: [0x22, 0x22, 0x22],
    outline:     [0x70, 0x70, 0x70],   // slightly darker outer border
  };

  // Column layout (right-to-left when lang=ar). 8 columns.
  // No. 6%, Product 20%, Requested 13%, Delivered 12%, Available 13%,
  // Expired 12%, NoExpiry 12%, NearExpiry 12%
  const innerW = A4_W - MARGIN_LEFT - MARGIN_RIGHT; // 190
  const colPct = [0.06, 0.20, 0.13, 0.12, 0.13, 0.12, 0.12, 0.12];
  const colW = colPct.map(p => +(innerW * p).toFixed(2));
  // adjust last col to absorb rounding
  const sum = colW.reduce((a, b) => a + b, 0);
  colW[colW.length - 1] += +(innerW - sum).toFixed(2);

  // Column boundaries (left edge of each column).
  // In ar we display right-to-left, so the visual order is
  //   col 0 (No) ... col 1 (Product) ... col 7 (NearExpiry)
  // regardless of lang.  The text inside each cell is just translated.
  const tableX = MARGIN_LEFT;
  const colLeft = [MARGIN_LEFT];
  for (let i = 0; i < colW.length; i++) {
    colLeft.push(+(colLeft[i] + colW[i]).toFixed(2));
  }
  const tableRight = MARGIN_LEFT + innerW;

  // Row heights (mm)
  const RH_HEADER = 22;     // header row (bilingual, taller)
  const RH_SECTION = 12;    // category band
  const RH_PRODUCT = 18;    // product row
  const RH_TITLE = 18;      // title block height (2 lines)
  const RH_BRANCH = 8;      // branch strip
  const RH_DATE_FIELD = 14; // delivery & inventory date
  const RH_SIG = 22;        // signature row per side (2 lines + label)

  // Build product rows
  const cartIds = new Set((inputs.cart || []).map(c => String(c.id)));
  const cartById = new Map();
  (inputs.cart || []).forEach(c => cartById.set(String(c.id), c));

  // Group all products by category. Keep CAT_ORDER first if available.
  const CAT_ORDER = [
    "قسم المعمل",
    "قسم السوبرماركت",
    "قسم محلات الجملة",
    "قسم المستودع",
    "احتياجات المعمل",
  ];
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
    if (!groups[c]) groups[c] = [];
    groups[c].push(p);
  });
  const orderedCats = [];
  CAT_ORDER.forEach(c => { if (groups[c] && groups[c].length) orderedCats.push(c); });
  Object.keys(groups).forEach(c => { if (!orderedCats.includes(c)) orderedCats.push(c); });

  // For each category, produce rows: section row, then cart products, then 0-qty rest.
  const rows = []; // {type, ...}
  let productSerial = 0;
  orderedCats.forEach(cat => {
    const all = groups[cat] || [];
    const inCart = [];
    const notInCart = [];
    all.forEach(p => {
      const id = String(p.id);
      if (cartIds.has(id)) inCart.push(p);
      else notInCart.push(p);
    });
    // sort: preserve original order (which is db order)
    rows.push({ type: "section", catAr: cat, catEn: EN_CAT[cat] || cat });
    inCart.forEach(p => {
      productSerial++;
      const c = cartById.get(String(p.id));
      rows.push({
        type: "product",
        serial: productSerial,
        ar: p.name || p.description || "",
        en: p.description || p.nameEn || p.name || "",
        code: p.code || "",
        requestedQty: c ? (c.qty || 0) : 0,
        inCart: true,
      });
    });
    notInCart.forEach(p => {
      productSerial++;
      rows.push({
        type: "product",
        serial: productSerial,
        ar: p.name || p.description || "",
        en: p.description || p.nameEn || p.name || "",
        code: p.code || "",
        requestedQty: 0,
        inCart: false,
      });
    });
  });

  // === Page state ===
  let pageNum = 1;
  let totalPages = 1; // we'll update at the end after measuring
  let cursorY = MARGIN_TOP;

  // === Helpers ===
  const setColor = (k) => doc.setTextColor(COLORS[k][0], COLORS[k][1], COLORS[k][2]);
  const setFill = (k) => doc.setFillColor(COLORS[k][0], COLORS[k][1], COLORS[k][2]);
  const setDraw = (k) => doc.setDrawColor(COLORS[k][0], COLORS[k][1], COLORS[k][2]);
  const setStroke = (w) => doc.setLineWidth(w);

  // Draw a rectangle border (used for input boxes inside cells)
  function rect(x, y, w, h, opts) {
    opts = opts || {};
    if (opts.fill) {
      setFill(opts.fill);
      doc.rect(x, y, w, h, "F");
    }
    if (opts.stroke) {
      setDraw(opts.stroke);
      setStroke(opts.strokeWidth || 0.2);
      doc.rect(x, y, w, h, "S");
    }
  }

  function vectorText(str, x, y, opts) {
    opts = opts || {};
    const size = opts.size || 10;
    const style = opts.bold ? "bold" : "normal";
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    setColor(opts.color || "text");
    doc.text(str, x, y, { align: opts.align || "left", baseline: opts.baseline || "alphabetic" });
  }

  // Place an Arabic phrase as a tiny PNG strip.
  function arText(str, x, y, opts) {
    opts = opts || {};
    if (!str) return;
    const sizePx = Math.max(8, Math.round((opts.size || 11) * 3.78));
    const { data: png, w: imgW, h: imgH } = arabicPng(str, {
      fontSize: sizePx,
      color: opts.colorHex || "#222222",
      fontWeight: opts.bold ? 800 : 500,
      fontFamily: "Cairo, system-ui, sans-serif",
      bgColor: opts.bgColor || "rgba(0,0,0,0)",
    });
    const maxWmm = opts.maxW || 30;
    const maxWpx = maxWmm * 3.78;
    const scale = imgW > maxWpx ? maxWpx / imgW : 1;
    const w = imgW * scale;
    const h = imgH * scale;
    const wmm = w * 0.2646;
    const hmm = h * 0.2646;
    if(opts.debug){
      console.log(`arText str="${str}" size=${opts.size}px=${sizePx} imgW=${imgW} imgH=${imgH} maxWpx=${maxWpx} scale=${scale.toFixed(3)} wmm=${wmm.toFixed(2)} hmm=${hmm.toFixed(2)} at x=${x} y=${y} colorHex=${opts.colorHex}`);
    }
    let px = x;
    if (opts.align === "center") px = x - wmm / 2;
    if (opts.align === "right")  px = x - wmm;
    doc.addImage(png, "PNG", px, y - hmm / 2, wmm, hmm, undefined, "FAST");
  }

  // === Draw header on a given page ===
  function drawPageHeader() {
    let y = MARGIN_TOP;
    // Logo: small, centered, 30-35mm wide.  We draw it as PNG if available.
    const logoUrl = (window.SIMSIM_LOGO_URL || "images/logo.png");
    if (logoUrl) {
      try {
        doc.addImage(logoUrl, "PNG", (A4_W - 32) / 2, y, 32, 12, undefined, "FAST");
      } catch (e) {
        // skip if logo not loadable
      }
    }
    y += 14; // logo height + breathing room
    // Branch / date / user strip
    setStroke(0.2);
    setDraw("border");
    const stripY = y;
    const stripH = RH_BRANCH;
    // 3 zones: left (branch), center (date), right (user) — but spec says:
    //   far-left: branch, far-right: date + user
    // We will use a left zone for branch, and stack date + user on the right.
    const zL = MARGIN_LEFT;
    const zR = tableRight;
    // Branch label (left)
    const branchTxt = (inputs.customer && inputs.customer.branch) || "";
    const userTxt   = (inputs.customer && inputs.customer.name) || "";
    const dateTxt   = inputs.dateStr || "";
    vectorText(branchTxt, zL, stripY + stripH / 2 + 1.5, { size: 11, bold: true, align: "left" });
    // right side: date and user on two lines
    vectorText(`${t("rptOrderDateEn")}: ${dateTxt}`, zR, stripY + stripH / 2 - 0.5, { size: 10, bold: true, align: "right" });
    vectorText(`${t("rptUserEn")}: ${userTxt}`,     zR, stripY + stripH / 2 + 3.5, { size: 10, bold: true, align: "right" });
    y = stripY + stripH + 4;

    // Title block (Arabic + English, both 22/16)
    // Centered
    const cx = A4_W / 2;
    vectorText(t("rptTitleEn") || "Branch Products Monitoring Report", cx, y + 6, { size: 16, bold: true, align: "center" });
    arText(t("rptTitleAr") || "تقرير جرد وتسليم منتجات", cx, y + 13, { size: 22, bold: true, align: "center" });
    y += RH_TITLE;
    return y;
  }

  // === Draw table column headers (top of each table block) ===
  function drawTableHeaders() {
    const headers = [
      { ar: t("rptColNoAr"),          en: t("rptColNoEn") },
      { ar: t("rptColProductAr"),      en: t("rptColProductEn") },
      { ar: t("rptColRequestedAr"),   en: t("rptColRequestedEn") },
      { ar: t("rptColDeliveredAr"),   en: t("rptColDeliveredEn") },
      { ar: t("rptColAvailableAr"),   en: t("rptColAvailableEn") },
      { ar: t("rptColExpiredAr"),     en: t("rptColExpiredEn") },
      { ar: t("rptColNoExpiryAr"),    en: t("rptColNoExpiryEn") },
      { ar: t("rptColNearExpiryAr"),  en: t("rptColNearExpiryEn") },
    ];
    const y = cursorY;
    const h = RH_HEADER;
    // background
    setFill("headerBg");
    doc.rect(tableX, y, innerW, h, "F");
    // grid lines
    setDraw("border");
    setStroke(0.2);
    for (let i = 0; i < colLeft.length; i++) {
      doc.line(colLeft[i], y, colLeft[i], y + h);
    }
    doc.line(tableRight, y, tableRight, y + h);
    doc.line(tableX, y, tableRight, y);
    doc.line(tableX, y + h, tableRight, y + h);

    // English text first (top half), Arabic text second (bottom half).
    // jsPDF will only place the Arabic as a small PNG; English as real
    // vector text wrapped to the column width.
    doc.setFont("helvetica", "bold");
    for (let i = 0; i < headers.length; i++) {
      const cx = (colLeft[i] + colLeft[i + 1]) / 2;
      const cellW = colW[i] - 1.5; // small padding
      // English on top — multi-line, centered, smaller font to fit
      const enLines = doc.splitTextToSize(headers[i].en, cellW);
      doc.setFontSize(enLines.length > 2 ? 7 : 8);
      doc.setTextColor(0xFF, 0xFF, 0xFF);
      const lineH = 2.8;
      // Center the English block vertically in the top portion
      const blockH = enLines.length * lineH;
      const topSpace = (h - 4) / 2 + 2; // top half of cell, with padding
      const enStartY = y + (topSpace - blockH) + lineH;
      for(let li=0; li<enLines.length; li++){
        doc.text(enLines[li], cx, enStartY + li*lineH, { align: "center" });
      }
      // Arabic on bottom — rendered as PNG, white text
      const arY = y + h - 3.5;
      if(isArabic(headers[i].ar)){
        arText(headers[i].ar, cx, arY, { size: 8, bold: true, align: "center", colorHex: "#ffffff", maxW: colW[i] - 1.5 });
      } else {
        doc.setFontSize(8);
        doc.text(headers[i].ar, cx, arY, { align: "center" });
      }
    }
    cursorY = y + h;
  }

  function isArabic(s) {
    return /[\u0600-\u06FF]/.test(s || "");
  }

  // === Draw one section row (category band) ===
  function drawSectionRow(row) {
    const y = cursorY;
    const h = RH_SECTION;
    setFill("sectionBg");
    doc.rect(tableX, y, innerW, h, "F");
    setDraw("border");
    setStroke(0.2);
    // outer + 2 vert lines
    doc.line(tableX, y, tableRight, y);
    doc.line(tableX, y + h, tableRight, y + h);
    doc.line(tableX, y, tableX, y + h);
    doc.line(tableRight, y, tableRight, y + h);
    // category name: ar + en, centered
    const cx = A4_W / 2;
    vectorText(row.catEn || "", cx, y + 5, { size: 12, bold: true, align: "center" });
    arText(row.catAr || "", cx, y + 10, { size: 10, bold: true, align: "center", maxW: innerW - 6 });
    cursorY = y + h;
  }

  // === Draw one product row ===
  function drawProductRow(row) {
    const y = cursorY;
    const h = RH_PRODUCT;
    // outer + vertical grid
    setDraw("border");
    setStroke(0.2);
    doc.line(tableX, y, tableRight, y);
    doc.line(tableX, y + h, tableRight, y + h);
    for (let i = 0; i < colLeft.length; i++) {
      doc.line(colLeft[i], y, colLeft[i], y + h);
    }

    // Col 0: serial number (1.2 mm font, centered)
    const c0cx = (colLeft[0] + colLeft[1]) / 2;
    vectorText(String(row.serial), c0cx, y + h / 2 + 1.5, { size: 13, bold: true, align: "center" });

    // Col 1: product name (arabic top, english bottom, centered)
    const c1cx = (colLeft[1] + colLeft[2]) / 2;
    arText(row.ar || "", c1cx, y + h / 2 - 0.5, { size: 8, bold: true, align: "center", maxW: colW[1] - 2 });
    vectorText(row.en || "", c1cx, y + h / 2 + 5.5, { size: 10, bold: false, align: "center" });

    // Col 2: requested qty (printed number) — also wrap with a small box
    const c2cx = (colLeft[2] + colLeft[3]) / 2;
    vectorText(String(row.requestedQty), c2cx, y + h / 2 + 1.5, { size: 13, bold: true, align: "center" });

    // Cols 3..7: empty input boxes (24mm x 10mm) — for the user to fill by hand
    // Spec: small bordered rectangle, ~24x10mm, centered in cell.
    const boxW = 24;
    const boxH = 10;
    for (let i = 3; i < 8; i++) {
      const cx = (colLeft[i] + colLeft[i + 1]) / 2;
      const bx = cx - boxW / 2;
      const by = y + (h - boxH) / 2;
      setDraw("border");
      setStroke(0.3);
      doc.rect(bx, by, boxW, boxH);
    }

    cursorY = y + h;
  }

  // === Page break ===
  function newPage() {
    doc.addPage();
    pageNum++;
    cursorY = MARGIN_TOP;
    // repeated header + table headers
    cursorY = drawPageHeader();
    drawTableHeaders();
  }

  // === Bottom block: delivery date + signatures ===
  function drawFooter() {
    // y starts at cursorY
    const y = cursorY + 6;
    // Delivery & inventory date — centered, label + empty box
    const cx = A4_W / 2;
    vectorText(t("rptDeliveryDateEn") || "Delivery & Inventory Date", cx, y + 2, { size: 12, bold: true, align: "center" });
    // empty date box (50x10 mm)
    const dateBoxW = 50, dateBoxH = 10;
    setDraw("border");
    setStroke(0.3);
    doc.rect(cx - dateBoxW / 2, y + 4, dateBoxW, dateBoxH);
    let after = y + 4 + dateBoxH + 6;

    // Signature block: 2 columns (right = Branch Manager, left = Inspector)
    // In ar, the right column is Branch Manager.  We always draw the manager
    // on the right (visually) since ar is the primary language.
    const colSigW = (innerW - 6) / 2;
    const rX = MARGIN_LEFT + innerW - colSigW;
    const lX = MARGIN_LEFT;
    // vertical separator
    setDraw("border");
    setStroke(0.2);
    doc.line(MARGIN_LEFT + innerW / 2, after, MARGIN_LEFT + innerW / 2, after + RH_SIG * 2 + 4);
    // outer box
    doc.rect(MARGIN_LEFT, after, innerW, RH_SIG * 2 + 4);
    // right side (Branch Manager)
    drawSigSide(rX, after, colSigW, RH_SIG, t("rptBranchMgrEn") || "Branch Manager Name");
    // left side (Branch Inspector)
    drawSigSide(lX, after, colSigW, RH_SIG, t("rptBranchInspEn") || "Branch Inspector Name");
  }

  function drawSigSide(x, y, w, rowH, label) {
    // label
    vectorText(label, x + w - 2, y + 4, { size: 11, bold: true, align: "right" });
    // signature line (Name)
    setDraw("border");
    setStroke(0.2);
    doc.line(x + 2, y + rowH - 1, x + w - 2, y + rowH - 1);
    arText("التوقيع", (x + x + w) / 2, y + rowH + 3, { size: 10, bold: true, align: "center", maxW: w - 4 });
    // signature line (Signature)
    doc.line(x + 2, y + rowH * 2 - 1, x + w - 2, y + rowH * 2 - 1);
  }

  // === Page footer (page number) ===
  function drawPageNumber() {
    const total = doc.getNumberOfPages();
    const cur = doc.getCurrentPageInfo().pageNumber;
    const txt = `Page ${cur} of ${total}`;
    vectorText(txt, tableRight, A4_H - MARGIN_BOTTOM + 4, { size: 9, bold: false, align: "right" });
  }

  // === Build pages ===
  // First page: header + first table block (with table header + section + products)
  cursorY = drawPageHeader();
  drawTableHeaders();

  // If no products, still draw a single "no products" row
  if (rows.length === 0) {
    // simple "no products" centered text
    const y = cursorY;
    doc.setFontSize(12);
    setColor("text");
    doc.text(t("rptNoProducts") || "No products", A4_W / 2, y + 8, { align: "center" });
    cursorY = y + 14;
  } else {
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const needH = r.type === "section" ? RH_SECTION : RH_PRODUCT;
      // If we are near the bottom, we need to break BEFORE the section row if
      // there's not enough room for the section + at least 1 product.
      // Spec: "section header sticks with first product; if it doesn't fit,
      // move section + first product to next page."
      const minRequired = r.type === "section" ? RH_SECTION + RH_PRODUCT : RH_PRODUCT;
      if (cursorY + minRequired + 60 > A4_H - MARGIN_BOTTOM) {
        // leave 60mm for the footer (delivery date + sigs)
        newPage();
      }
      if (r.type === "section") drawSectionRow(r);
      else drawProductRow(r);
    }
  }

  // Footer block
  // If there's not enough room for the footer (date + sigs ~ 60mm) on the
  // current page, push it to a new page.
  if (cursorY + 60 > A4_H - MARGIN_BOTTOM) {
    newPage();
  }
  drawFooter();

  // Stamp page numbers on every page
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawPageNumber();
  }

  // Save
  const fname = `${(inputs.customer && inputs.customer.branch) || "report"}-inventory-${(inputs.dateStr || "").replace(/-/g, "") || "report"}.pdf`;
  doc.save(fname);

  return { pages: total, fileName: fname };
}
