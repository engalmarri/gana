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
const FOOTER_BAND_H = 46;   // delivery date + signature block (last page)

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

// ---------- Arabic shaping ----------
//
// The embedded Tajawal TTF ships the *connected* presentation forms
// (initial/medial/final) but omits the isolated presentation forms (and the
// Persian letters).  PDF readers render the stored glyphs as-is — they do
// NOT apply OpenType GSUB at PDF-view time — so unshaped Arabic would appear
// as disconnected isolated letters.  We therefore pre-shape every Arabic run
// to presentation forms (falling back to the base letter for the isolated
// form, whose outline is identical) and reverse the run for RTL display.

const AR_JOIN = {
  // [baseChar, initial, medial, final] — the isolated form is the base char
  0x0621: [0x0621, null, null, null],
  0x0622: [0x0622, null, null, 0xFE82],
  0x0623: [0x0623, null, null, 0xFE84],
  0x0624: [0x0624, null, null, 0xFE86],
  0x0625: [0x0625, null, null, 0xFE88],
  0x0626: [0x0626, 0xFE8B, 0xFE8C, 0xFE8A],
  0x0627: [0x0627, null, null, 0xFE8E],
  0x0628: [0x0628, 0xFE91, 0xFE92, 0xFE90],
  0x0629: [0x0629, null, null, 0xFE94],
  0x062A: [0x062A, 0xFE97, 0xFE98, 0xFE96],
  0x062B: [0x062B, 0xFE9B, 0xFE9C, 0xFE9A],
  0x062C: [0x062C, 0xFE9F, 0xFEA0, 0xFE9E],
  0x062D: [0x062D, 0xFEA3, 0xFEA4, 0xFEA2],
  0x062E: [0x062E, 0xFEA7, 0xFEA8, 0xFEA6],
  0x062F: [0x062F, null, null, 0xFEAA],
  0x0630: [0x0630, null, null, 0xFEAC],
  0x0631: [0x0631, null, null, 0xFEAE],
  0x0632: [0x0632, null, null, 0xFEB0],
  0x0633: [0x0633, 0xFEB3, 0xFEB4, 0xFEB2],
  0x0634: [0x0634, 0xFEB7, 0xFEB8, 0xFEB6],
  0x0635: [0x0635, 0xFEBB, 0xFEBC, 0xFEBA],
  0x0636: [0x0636, 0xFEBF, 0xFEC0, 0xFEBE],
  0x0637: [0x0637, 0xFEC3, 0xFEC4, 0xFEC2],
  0x0638: [0x0638, 0xFEC7, 0xFEC8, 0xFEC6],
  0x0639: [0x0639, 0xFECB, 0xFECC, 0xFECA],
  0x063A: [0x063A, 0xFECF, 0xFED0, 0xFECE],
  0x0640: [0x0640, 0x0640, 0x0640, 0x0640],
  0x0641: [0x0641, 0xFED3, 0xFED4, 0xFED2],
  0x0642: [0x0642, 0xFED7, 0xFED8, 0xFED6],
  0x0643: [0x0643, 0xFEDB, 0xFEDC, 0xFEDA],
  0x0644: [0x0644, 0xFEDF, 0xFEE0, 0xFEDE],
  0x0645: [0x0645, 0xFEE3, 0xFEE4, 0xFEE2],
  0x0646: [0x0646, 0xFEE7, 0xFEE8, 0xFEE6],
  0x0647: [0x0647, 0xFEEB, 0xFEEC, 0xFEEA],
  0x0648: [0x0648, null, null, 0xFEEE],
  0x0649: [0x0649, 0xFBE8, 0xFBE9, 0x0649], // final FBFD absent in Tajawal -> base
  0x064A: [0x064A, 0xFEF3, 0xFEF4, 0xFEF2],
};
const AR_COMB = [
  [[0x0644, 0x0622], 0xFEF5, 0xFEF6], // LAM_ALEF_MADDA
  [[0x0644, 0x0623], 0xFEF7, 0xFEF8], // LAM_ALEF_HAMZA_ABOVE
  [[0x0644, 0x0625], 0xFEF9, 0xFEFA], // LAM_ALEF_HAMZA_BELOW
  [[0x0644, 0x0627], 0xFEFB, 0xFEFC], // LAM_ALEF
];
const AR_TRANSPARENT = new Set([
  0x064B, 0x064C, 0x064D, 0x064E, 0x064F, 0x0650, 0x0651, 0x0652,
  0x0653, 0x0654, 0x0655, 0x0656, 0x0657, 0x0658, 0x0670,
]);
const AR_PERSIAN = { 0x067E: 0x0628, 0x0686: 0x062C, 0x0698: 0x0632, 0x06AF: 0x0643, 0x06A9: 0x0643, 0x06CC: 0x064A };

function isArabicCode(c){
  if(c >= 0x0660 && c <= 0x0669) return false; // Arabic-Indic digits stay numeric
  return (c >= 0x0600 && c <= 0x06FF) || (c >= 0x0750 && c <= 0x077F) ||
         (c >= 0x08A0 && c <= 0x08FF) || (c >= 0xFB50 && c <= 0xFDFF) ||
         (c >= 0xFE70 && c <= 0xFEFF);
}

function shapeArabicRun(str){
  let out = "";
  for(let i = 0; i < str.length; i++){
    let cc = str.charCodeAt(i);
    if(AR_PERSIAN[cc]) cc = AR_PERSIAN[cc];
    const rep = AR_JOIN[cc];
    if(!rep){ out += String.fromCharCode(cc); continue; }

    let p = i - 1;
    while(p >= 0 && AR_TRANSPARENT.has(str.charCodeAt(p))) p--;
    let prev = null;
    if(p >= 0){
      let pc = str.charCodeAt(p);
      if(AR_PERSIAN[pc]) pc = AR_PERSIAN[pc];
      const pre = AR_JOIN[pc];
      if(pre && (pre[1] !== null || pre[2] !== null)) prev = pc;
    }

    let n = i + 1;
    while(n < str.length && AR_TRANSPARENT.has(str.charCodeAt(n))) n++;
    let next = null;
    if(n < str.length){
      let nc = str.charCodeAt(n);
      if(AR_PERSIAN[nc]) nc = AR_PERSIAN[nc];
      const nre = AR_JOIN[nc];
      if(nre && (nre[2] !== null || nre[3] !== null)) next = nc;
    }

    // Lam-Alef ligatures
    if(cc === 0x0644 && next !== null && (next === 0x0622 || next === 0x0623 || next === 0x0625 || next === 0x0627)){
      const combo = AR_COMB.find(c => c[0][0] === cc && c[0][1] === next);
      if(combo){
        out += String.fromCharCode(prev !== null ? combo[2] : combo[1]);
        i++;
        continue;
      }
    }

    if(prev !== null && next !== null && rep[2] !== null){
      out += String.fromCharCode(rep[2]); // medial
    } else if(prev !== null && rep[3] !== null){
      out += String.fromCharCode(rep[3]); // final
    } else if(next !== null && rep[1] !== null){
      out += String.fromCharCode(rep[1]); // initial
    } else {
      out += String.fromCharCode(cc); // isolated -> base char
    }
  }
  return out;
}

// Convert logical-order mixed text into a LTR visual string for jsPDF.
function arabicToDisplay(text){
  if(!text) return text;
  text = String(text);
  if(!/[\u0600-\u06FF]/.test(text)) return text;

  const runs = [];
  let cur = "", curAr = null;
  for(const ch of text){
    const ar = isArabicCode(ch.codePointAt(0));
    if(curAr === null){ curAr = ar; cur = ch; }
    else if(ar === curAr){ cur += ch; }
    else { runs.push({ text: cur, ar: curAr }); cur = ch; curAr = ar; }
  }
  runs.push({ text: cur, ar: curAr });

  const shaped = runs.map(r => {
    if(!r.ar) return r.text;
    const shaped = shapeArabicRun(r.text);
    return Array.from(shaped).reverse().join("");
  });
  shaped.reverse();
  return shaped.join("");
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
// If the string actually contains Arabic, route it through the shaping
// pipeline so stray Arabic (e.g. unmapped category names) still renders
// correctly joined and in RTL order.
function textLatin(doc, str, x, y, opts){
  if(str && /[\u0600-\u06FF]/.test(String(str))){
    return textArabic(doc, str, x, y, opts);
  }
  opts = opts || {};
  const style = opts.bold ? "bold" : "normal";
  doc.setFont(FONT_FAMILY, style);
  doc.setFontSize(opts.size || 10);
  setRgb(doc, opts.color || "text");
  doc.text(str, x, y, { align: opts.align || "left" });
}

// Write Arabic text using Tajawal.  The string is pre-shaped to presentation
// forms and reversed (see arabicToDisplay) so that every PDF reader — which
// renders stored glyphs without applying GSUB — displays correctly joined
// Arabic in the right visual order.
function textArabic(doc, str, x, y, opts){
  opts = opts || {};
  if(!str) return;
  const shaped = arabicToDisplay(str);
  const style = opts.bold ? "bold" : "normal";
  doc.setFont(FONT_FAMILY, style);
  doc.setFontSize(opts.size || 10);
  setRgb(doc, opts.color || "text");
  doc.text(shaped, x, y, { align: opts.align || "right" });
}

// Arabic width measurement (shaped form has the real glyph widths).
function arabicWidth(doc, str, size, bold){
  doc.setFont(FONT_FAMILY, bold ? "bold" : "normal");
  doc.setFontSize(size);
  return doc.getTextWidth(arabicToDisplay(str));
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
    while(arSize > 5.5 && arabicWidth(doc, arStr, arSize, true) > cellW){ arSize -= 0.5; doc.setFontSize(arSize); }
    doc.text(arabicToDisplay(arStr), midX, y + 2.8, { align: "center" });

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

  // Col 2: product name (English top, Arabic bottom, centered)
  const c2cx = (left[2] + left[3]) / 2;
  const productCellW = left[3] - left[2] - 1;
  // English name first (top): single line, centered
  doc.setFont(FONT_FAMILY, "normal");
  let enSize = 6.5;
  doc.setFontSize(enSize);
  const enStr = row.en;
  while(enSize > 5 && doc.getTextWidth(enStr) > productCellW){ enSize -= 0.5; doc.setFontSize(enSize); }
  doc.text(enStr, c2cx, y + 2.8, { align: "center" });
  // Arabic name (bottom): shrink to fit if needed
  doc.setFont(FONT_FAMILY, "bold");
  let arSize = 8;
  doc.setFontSize(arSize);
  while(arSize > 6 && arabicWidth(doc, row.ar, arSize, true) > productCellW){ arSize -= 0.5; doc.setFontSize(arSize); }
  textArabic(doc, row.ar, c2cx, y + 6, { size: arSize, bold: true, align: "center" });

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

  // Signature area: 2 columns — smaller boxes, no outer rectangle
  const blockW = INNER_W;
  const blockH = 22;
  // Vertical separator between the two signature columns
  const midX = MARGIN_LEFT + blockW/2;
  setRgb(doc, "border");
  setLine(doc, 0.25);
  line(doc, midX, y, midX, y + blockH);

  // Right column (Branch Manager)
  drawSignatureColumn(doc, ctx.signMgrLabel, ctx.signatureLabel, MARGIN_LEFT, y, blockW/2, blockH, /*rtl*/ true);
  // Left column (Branch Inspector)
  drawSignatureColumn(doc, ctx.signInspLabel, ctx.signatureLabel, midX, y, blockW/2, blockH, /*rtl*/ false);
}

function drawSignatureColumn(doc, nameLabel, sigLabel, x, y, w, h, rtl){
  // Name label (bold)
  if(rtl){
    textArabic(doc, nameLabel, x + w - 2, y + 4, { size: 10, bold: true, align: "right" });
  } else {
    textLatin(doc, nameLabel, x + 2, y + 4, { size: 10, bold: true, align: "left" });
  }
  // Name line
  setRgb(doc, "border");
  setLine(doc, 0.25);
  const nameY = y + 9;
  line(doc, x + 4, nameY, x + w - 4, nameY);

  // Signature label
  const sigY = y + 12;
  if(rtl){
    textArabic(doc, sigLabel, x + w - 2, sigY, { size: 9, align: "right" });
  } else {
    textLatin(doc, sigLabel, x + 2, sigY, { size: 9, align: "left" });
  }
  // Signature line
  const sigLineY = y + 17;
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
    "المعمل":            "Lab",
    "قسم السوبرماركت":   "Supermarket",
    "قسم محلات الجملة":  "Wholesale",
    "قسم المستودع":      "Warehouse",
    "المستودع":          "Warehouse",
    "البوكسات":          "Boxes",
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
    const catEn = EN_CAT[cat] || (cat ? cat : "Other");
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
