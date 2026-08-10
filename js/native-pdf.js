// Branch Products Monitoring (Inventory) Report — vector PDF generator.
//
// Produces a fully vector A4 PDF using jsPDF native APIs.  Arabic text is
// rendered with the embedded Tajawal TTF (regular + bold).
//
// NOTE: like every Arabic-capable TTF, this font ships the *connected*
// presentation forms (initial/medial/final) but omits the isolated
// presentation forms (and the Persian letters).  PDF readers render the
// stored glyphs as-is — they do NOT apply OpenType GSUB at PDF-view time —
// so unshaped Arabic would appear as disconnected isolated letters.  We
// therefore pre-shape every Arabic run to presentation forms (falling back
// to the base letter for the isolated form, whose outline is identical) and
// reverse the run for RTL display.  This is the root-cause fix: Arabic is
// correct regardless of which viewer opens the PDF.
//
// Layout: corporate inventory form, drawn manually (no html2canvas).

const FONT_REG_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/tajawal/Tajawal-Regular.ttf";
const FONT_BOLD_URL = "https://raw.githubusercontent.com/google/fonts/main/ofl/tajawal/Tajawal-Bold.ttf";
const FONT_FAMILY = "Tajawal";
const LOGO_URL = "images/logo.png";

// A4 portrait, mm
const A4_W = 210;
const A4_H = 297;
const MARGIN_TOP = 6;
const MARGIN_BOTTOM = 10;   // page-number strip at the very bottom
const MARGIN_LEFT = 6;
const MARGIN_RIGHT = 6;
const INNER_W = A4_W - MARGIN_LEFT - MARGIN_RIGHT; // 198 mm

// Palette
const COLOR_TEXT       = [0x22, 0x22, 0x22]; // #222222
const COLOR_BORDER     = [0xBF, 0xC3, 0xC8]; // #BFC3C8
const COLOR_OUTER      = [0x70, 0x70, 0x70]; // #707070
const COLOR_HEADER_BG  = [0x4B, 0x55, 0x63]; // #4B5563
const COLOR_HEADER_FG  = [0xFF, 0xFF, 0xFF];
const COLOR_SECTION_BG = [0xE9, 0xEC, 0xEF]; // #E9ECEF
const COLOR_PAGE_BG    = [0xFF, 0xFF, 0xFF];

// Column widths (mm) — order: No., Product, Category, Requested, Delivered,
// Available, Expired, No Expiry, Near Expiry.  Total == INNER_W.
// The last three numeric columns are the widest because their bilingual
// headers are long (the values themselves are just numbers / empty).
const COL_W = [7, 42, 16, 14, 14, 20, 16, 22, 47];
const RH_PRODUCT = 9.5;   // product row height — compact, fits 11pt AR + EN name
const FOOTER_BAND_H = 48; // delivery date + signature block (last page)

// Header font metrics (header cells wrap Arabic + English across lines)
const AR_HDR_SIZE  = 6;
const EN_HDR_SIZE  = 4.8;
const AR_HDR_LINE  = 2.25;  // vertical step per Arabic header line (mm)
const EN_HDR_LINE  = 1.85;  // vertical step per English header line (mm)
const MIN_HDR      = 8;

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

// jsPDF 2.x ships its own Arabic shaper: a standalone base Arabic letter is
// rewritten to its ISOLATED presentation form (e.g. م -> U+FEE1), a codepoint
// Tajawal deliberately omits (see the note atop this file), so jsPDF then
// drops the glyph and emits an empty text run for that letter.  A lone Mekka
// letter in a header (the "م" row-number column) must therefore be emitted in
// a form that exists in both Tajawal faces: every joinable letter ships its
// FINAL presentation form, which for a standalone letter is visually
// identical to the isolated form.
function safeArabicDisplay(text){
  const disp = arabicToDisplay(String(text));
  const cps = Array.from(disp);
  if(cps.length !== 1) return disp;
  const cc = cps[0].codePointAt(0);
  if(cc >= 0x0600 && cc <= 0x06FF){
    const rep = AR_JOIN[cc];
    if(rep && rep[3] !== null && rep[3] !== cc) return String.fromCharCode(rep[3]);
  }
  return disp;
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

// Write Latin text using the embedded Tajawal font.  If the string actually
// contains Arabic, route it through the shaping pipeline.  For a "left"
// anchored cell we clamp the physical LEFT edge of the RTL (pre-reversed)
// string so Arabic never spills off the page.
function textLatin(doc, str, x, y, opts){
  str = String(str);
  if(/[\u0600-\u06FF]/.test(str)){
    opts = opts || {};
    const align = opts.align || "left";
    if(align === "left"){
      const w = arabicWidth(doc, str, opts.size || 10, opts.bold);
      return textArabic(doc, str, x + w, y, Object.assign({}, opts, { align: "right" }));
    }
    return textArabic(doc, str, x, y, opts);
  }
  opts = opts || {};
  const style = opts.bold ? "bold" : "normal";
  doc.setFont(FONT_FAMILY, style);
  doc.setFontSize(opts.size || 10);
  setRgb(doc, opts.color || "text");
  doc.text(str, x, y, { align: opts.align || "left" });
}

// Write Arabic text using Tajawal (pre-shaped + reversed, RTL-ready).  The
// x anchor is the RIGHT edge when aligned "right" / the CENTER when "center".
function textArabic(doc, str, x, y, opts){
  opts = opts || {};
  if(!str) return;
  const shaped = safeArabicDisplay(str);
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

function measureText(doc, str, size, bold){
  doc.setFont(FONT_FAMILY, bold ? "bold" : "normal");
  doc.setFontSize(size);
  return doc.getTextWidth(str);
}

// ---------- Line wrapping (for the long bilingual column headers) ----------

// Latin: let jsPDF split into wrapped lines.
function latinLines(doc, text, size, maxW){
  doc.setFont(FONT_FAMILY, "normal");
  doc.setFontSize(size);
  const lines = doc.splitTextToSize(String(text), Math.max(maxW, 4));
  return (lines && lines.length) ? lines : [""];
}

// Arabic: greedy word-wrap over the *visual* (pre-reversed) string.
function arabicLines(doc, text, size, maxW){
  const disp = safeArabicDisplay(String(text));
  doc.setFont(FONT_FAMILY, "bold");
  doc.setFontSize(size);
  const words = disp.split(" ");
  if(words.length <= 1) return [disp];
  const lines = [];
  let cur = "";
  for(const w of words){
    const trial = cur ? cur + " " + w : w;
    if(cur && doc.getTextWidth(trial) > maxW){
      lines.push(cur);
      cur = w;
    } else {
      cur = trial;
    }
  }
  if(cur) lines.push(cur);
  return lines;
}

// Required table-header height given the current labels and column widths.
function computeHeaderHeight(doc, ctx){
  let max = 0;
  ctx.headers.forEach((h, i) => {
    const cellW = ctx.geom.cols[i].w - 1.6;
    const isAr = /[\u0600-\u06FF]/.test(String(h.ar));
    const arN = isAr ? arabicLines(doc, h.ar, AR_HDR_SIZE, cellW).length : 0;
    const enN = latinLines(doc, h.en, EN_HDR_SIZE, cellW).length;
    const mm = (isAr ? arN * AR_HDR_LINE : 0) + enN * EN_HDR_LINE + 1.4;
    if(mm > max) max = mm;
  });
  return Math.max(MIN_HDR, Math.ceil(max));
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

// ---------- First-page header (logo + bilingual title + info band) ----------

function drawFirstPageHeader(doc, ctx){
  const cx = A4_W / 2;
  let y = MARGIN_TOP;

  // Logo centered, max width 22 mm
  if(ctx.logoDataUrl){
    try { doc.addImage(ctx.logoDataUrl, "PNG", cx - 11, y, 22, 6.9, undefined, "FAST"); }
    catch(e){ /* ignore */ }
  }
  y += 10.5; // logo zone

  // Bilingual title — professional, not oversized
  textArabic(doc, ctx.titleAr, cx, y, { size: 14, bold: true, align: "center" });
  textLatin(doc, ctx.titleEn, cx, y + 3.8, { size: 11, bold: true, align: "center" });

  // Decorative rule under the title
  const ruleY = y + 5.8;
  setRgb(doc, "outer");
  setLine(doc, 0.4);
  line(doc, MARGIN_LEFT + 15, ruleY, A4_W - MARGIN_RIGHT - 15, ruleY);

  // Info band: branch (left) | creation date + requester name (right)
  const bandY = ruleY + 1.8;
  const bandH = 15;
  rect(doc, MARGIN_LEFT, bandY, INNER_W, bandH, "sectionBg");
  setRgb(doc, "border");
  setLine(doc, 0.25);
  doc.rect(MARGIN_LEFT, bandY, INNER_W, bandH);

  const lx = MARGIN_LEFT + 3;
  textArabic(doc, ctx.branchLabelAr, lx, bandY + 2.4, { size: 6.5, bold: true, align: "left" });
  textLatin(doc, ctx.branchLabelEn, lx, bandY + 4.7, { size: 6, bold: true, align: "left" });
  // Branch value (may be Arabic) — physically left-clamped inside the band
  textLatin(doc, ctx.branch, lx, bandY + 9.6, { size: 10.5, bold: true, align: "left" });

  const rx = A4_W - MARGIN_RIGHT - 3;
  // Report creation date
  textArabic(doc, ctx.dateLabelAr, rx, bandY + 2.4, { size: 6.5, bold: true, align: "right" });
  textLatin(doc, ctx.dateLabelEn, rx, bandY + 4.4, { size: 6, bold: true, align: "right" });
  textLatin(doc, ctx.orderDate, rx, bandY + 7.2, { size: 9.5, bold: true, align: "right" });
  // Requester name
  textArabic(doc, ctx.userLabelAr, rx, bandY + 9.6, { size: 6.5, bold: true, align: "right" });
  textLatin(doc, ctx.userLabelEn, rx, bandY + 11.6, { size: 6, bold: true, align: "right" });
  textLatin(doc, ctx.user, rx, bandY + 14.4, { size: 9.5, bold: true, align: "right" });

  return bandY + bandH + 1; // cursorY for the table
}

// ---------- Subsequent-page header (tiny: title + rule only) ----------

function drawSubPageHeader(doc, ctx){
  const y = MARGIN_TOP;
  textLatin(doc, ctx.subHeaderEn, MARGIN_LEFT, y + 3.5, { size: 8.5, bold: true, align: "left" });
  setRgb(doc, "border");
  setLine(doc, 0.2);
  line(doc, MARGIN_LEFT, y + 7, A4_W - MARGIN_RIGHT, y + 7);
  return y + 10; // cursorY for the table
}

// ---------- Table column header (bilingual, wrapped) ----------

function drawTableHeader(doc, ctx, y){
  const { cols, left, right } = ctx.geom;
  const headers = ctx.headers;
  const rh = ctx.rh_header;
  // Background
  rect(doc, MARGIN_LEFT, y, INNER_W, rh, "headerBg");
  // Vertical + horizontal rules
  setRgb(doc, "headerFg");
  setLine(doc, 0.3);
  for(const x of left){ line(doc, x, y, x, y + rh); }
  line(doc, MARGIN_LEFT, y, right, y);
  line(doc, MARGIN_LEFT, y + rh, right, y + rh);

  doc.setTextColor(COLOR_HEADER_FG[0], COLOR_HEADER_FG[1], COLOR_HEADER_FG[2]);
  for(let i=0; i<cols.length; i++){
    const midX = (left[i] + left[i+1]) / 2;
    const cellW = cols[i].w - 1.6;
    const h = headers[i];
    let by = y + 1.4;
    const isAr = /[\u0600-\u06FF]/.test(String(h.ar));
    if(isAr){
      const lines = arabicLines(doc, h.ar, AR_HDR_SIZE, cellW);
      doc.setFont(FONT_FAMILY, "bold");
      doc.setFontSize(AR_HDR_SIZE);
      for(const ln of lines){ doc.text(ln, midX, by, { align: "center" }); by += AR_HDR_LINE; }
    }
    const enLines = latinLines(doc, String(h.en), EN_HDR_SIZE, cellW);
    doc.setFont(FONT_FAMILY, "normal");
    doc.setFontSize(EN_HDR_SIZE);
    for(const ln of enLines){ doc.text(ln, midX, by, { align: "center" }); by += EN_HDR_LINE; }
  }
  return y + rh;
}

// ---------- Category separator line (drawn when the category changes) ----------

function drawCategorySeparator(doc, ctx, y){
  const { right } = ctx.geom;
  setRgb(doc, "outer");
  setLine(doc, 0.45);
  line(doc, MARGIN_LEFT, y, right, y);
  return y;
}

// ---------- Product row ----------

function drawProductRow(doc, ctx, y, row){
  const { cols, left, right } = ctx.geom;
  // Row borders
  setRgb(doc, "border");
  setLine(doc, 0.2);
  line(doc, MARGIN_LEFT, y, right, y);
  for(const x of left){ line(doc, x, y, x, y + RH_PRODUCT); }
  line(doc, MARGIN_LEFT, y + RH_PRODUCT, right, y + RH_PRODUCT);

  const midY = y + RH_PRODUCT / 2;

  // Col 0: serial (centered)
  const c0cx = (left[0] + left[1]) / 2;
  textLatin(doc, String(row.serial), c0cx, midY + 1.3, { size: 11, bold: true, align: "center" });

  // Col 1: product name — Arabic FIRST (top, regular), English below
  const c1cx = (left[1] + left[2]) / 2;
  const productCellW = left[2] - left[1] - 1.4;
  let arSize = 11;
  doc.setFont(FONT_FAMILY, "normal"); doc.setFontSize(arSize);
  while(arSize > 6.5 && arabicWidth(doc, row.ar, arSize, false) > productCellW){ arSize -= 0.5; doc.setFontSize(arSize); }
  textArabic(doc, row.ar, c1cx, y + 4.2, { size: arSize, bold: false, align: "center" });
  // English name (second line, regular, shrink to fit one line)
  let enSize = 9;
  doc.setFont(FONT_FAMILY, "normal"); doc.setFontSize(enSize);
  const enStr = row.en;
  while(enSize > 6 && doc.getTextWidth(enStr) > productCellW){ enSize -= 0.5; doc.setFontSize(enSize); }
  textLatin(doc, enStr, c1cx, y + 8.2, { size: enSize, align: "center" });

  // Col 2: category (English, centered)
  const c2cx = (left[2] + left[3]) / 2;
  textLatin(doc, row.catEn, c2cx, midY + 1.2, { size: 8.5, align: "center" });

  // Col 3: requested qty — system data, printed automatically when > 0
  if(row.requestedQty > 0){
    const c3cx = (left[3] + left[4]) / 2;
    textLatin(doc, String(row.requestedQty), c3cx, midY + 1.3, { size: 11, bold: true, align: "center" });
  }

  // Cols 4..5 (Delivered, Available): left empty for manual handwriting.
  // Cols 6..8 (Expired, No Expiry, Near Expiry): empty for manual entry,
  // or "-" for products flagged as having no expiry date.
  if(row.noExpiry){
    for(let i=6; i<9; i++){
      const cxc = (left[i] + left[i+1]) / 2;
      textLatin(doc, "-", cxc, midY + 1.3, { size: 10, bold: true, align: "center" });
    }
  }

  return y + RH_PRODUCT;
}

// ---------- Footer (last page only): delivery date + signature frame ----------

function drawFooter(doc, ctx){
  let y = ctx.cursorY + 5;
  const cx = A4_W / 2;

  // Delivery & inventory date — bilingual label + empty handwriting box
  textArabic(doc, ctx.deliveryDateLabelAr, cx, y, { size: 10, bold: true, align: "center" });
  textLatin(doc, ctx.deliveryDateLabelEn, cx, y + 3.4, { size: 8, align: "center" });
  const boxW = 60, boxH = 8;
  setRgb(doc, "border");
  setLine(doc, 0.3);
  doc.rect(cx - boxW/2, y + 4.6, boxW, boxH);

  // Signature frame: single outer rectangle, split in two by a vertical
  // rule.  RIGHT half = Branch Manager, LEFT half = Branch Inspector.
  y += 14.2;
  const frameX = MARGIN_LEFT;
  const frameW = INNER_W;
  const frameH = 27;
  setRgb(doc, "outer");
  setLine(doc, 0.5);
  doc.rect(frameX, y, frameW, frameH);
  const midX = frameX + frameW / 2;
  setLine(doc, 0.35);
  line(doc, midX, y, midX, y + frameH);

  const rightCx = frameX + frameW * 0.75;
  const leftCx  = frameX + frameW * 0.25;
  drawSigHalf(doc, ctx, ctx.signMgrLabelAr, ctx.signMgrLabelEn, midX + 2, y, frameW/2 - 2, rightCx);
  drawSigHalf(doc, ctx, ctx.signInspLabelAr, ctx.signInspLabelEn, frameX + 2, y, frameW/2 - 2, leftCx);
}

function drawSigHalf(doc, ctx, nameAr, nameEn, x, y, w, centerX){
  // Name label (bilingual)
  textArabic(doc, nameAr, centerX, y + 7, { size: 10.5, bold: true, align: "center" });
  textLatin(doc, nameEn, centerX, y + 10.5, { size: 7.5, align: "center" });
  // Signature area label (bilingual) — "beside/under the name"
  textArabic(doc, ctx.signatureLabelAr, centerX, y + 18.5, { size: 9, align: "center" });
  textLatin(doc, ctx.signatureLabelEn, centerX, y + 21.5, { size: 7, align: "center" });
  // Name line + signature line
  setRgb(doc, "border");
  setLine(doc, 0.3);
  line(doc, x + 8, y + 14.5, x + w - 8, y + 14.5);
  line(doc, x + 8, y + 25.5, x + w - 8, y + 25.5);
}

// ---------- Page number (bottom-right: "1 of 6") ----------

function drawPageNumber(doc, total, cur){
  setRgb(doc, "text");
  textLatin(doc, `${cur} of ${total}`, A4_W - MARGIN_RIGHT, A4_H - MARGIN_BOTTOM + 8, { size: 9, align: "right" });
}

// ---------- Main build ----------

export async function generateInventoryReportPdf(inputs){
  await loadFonts();

  const { jsPDF } = window.jspdf;
  const labels = inputs.labels || {};
  const t = (k) => labels[k] || k;

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
        noExpiry: !!p.noExpiry,
      });
    }
  }

  // === PDF setup ===
  const doc = new jsPDF({ unit:"mm", format:"a4", orientation:"portrait", putOnlyUsedFonts:true });
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
    titleEn: t("rptTitleEn") || "Products Inventory & Delivery Report",
    subHeaderEn: t("rptSubHeaderEn") || "Products Inventory & Delivery Report",
    branch: (inputs.customer && inputs.customer.branch) || "",
    orderDate: inputs.dateStr || "",
    user: (inputs.customer && inputs.customer.name) || "",
    branchLabelAr: t("rptBranchAr")   || "اسم الفرع",
    branchLabelEn: t("rptBranchEn")   || "Branch Name",
    dateLabelAr:   t("rptOrderDateAr")|| "تاريخ إنشاء التقرير",
    dateLabelEn:   t("rptOrderDateEn")|| "Report Creation Date",
    userLabelAr:   t("rptUserAr")     || "اسم صاحب الطلب",
    userLabelEn:   t("rptUserEn")     || "Requester Name",
    deliveryDateLabelAr: t("rptDeliveryDateAr") || "تاريخ التسليم والجرد",
    deliveryDateLabelEn: t("rptDeliveryDateEn") || "Delivery & Inventory Date",
    signMgrLabelAr:  t("rptBranchMgrAr")  || "اسم مدير الفرع",
    signMgrLabelEn:  t("rptBranchMgrEn")  || "Branch Manager Name",
    signInspLabelAr: t("rptBranchInspAr") || "اسم مفتش الفرع",
    signInspLabelEn: t("rptBranchInspEn") || "Branch Inspector Name",
    signatureLabelAr: t("rptSignatureAr") || "التوقيع",
    signatureLabelEn: t("rptSignatureEn") || "Signature",
    headers: [
      { ar: t("rptColNoAr")        || "م",                            en: t("rptColNoEn")        || "No." },
      { ar: t("rptColProductAr")   || "المنتج",                       en: t("rptColProductEn")   || "Product" },
      { ar: t("rptColCategoryAr")  || "القسم",                        en: t("rptColCategoryEn")  || "Category" },
      { ar: t("rptColRequestedAr") || "عدد المنتجات التي طلبها الفرع",en: t("rptColRequestedEn") || "Number of Products Requested by Branch" },
      { ar: t("rptColDeliveredAr") || "عدد المنتجات المسلمة للفرع",   en: t("rptColDeliveredEn") || "Number of Products Delivered to Branch" },
      { ar: t("rptColAvailableAr") || "عدد المنتجات الموجودة بالفرع بعد التسليم", en: t("rptColAvailableEn") || "Number of Products Available in Branch After Delivery" },
      { ar: t("rptColExpiredAr")   || "عدد المنتجات المنتهية الصلاحية", en: t("rptColExpiredEn")   || "Number of Expired Products" },
      { ar: t("rptColNoExpiryAr")  || "عدد المنتجات التي لا تحمل تاريخ صلاحية", en: t("rptColNoExpiryEn")  || "Number of Products Without Expiry Date" },
      { ar: t("rptColNearExpiryAr")|| "عدد المنتجات التي بقي على صلاحيتها أقل من أسبوع", en: t("rptColNearExpiryEn") || "Number of Products with Less Than One Week Until Expiry" },
    ],
    logoDataUrl,
  };
  ctx.rh_header = computeHeaderHeight(doc, ctx);

  // First page
  let cursorY = drawFirstPageHeader(doc, ctx);
  cursorY = drawTableHeader(doc, ctx, cursorY);

  const bottomLimit = A4_H - MARGIN_BOTTOM;

  // If we have no rows, leave a "no products" note
  if(rows.length === 0){
    setRgb(doc, "text");
    textLatin(doc, t("rptNoProducts") || "No products", A4_W/2, cursorY + 6, { size: 10, align: "center" });
    cursorY += 10;
  } else {
    let prevCat = null;
    for(let i=0; i<rows.length; i++){
      const r = rows[i];
      if(cursorY + RH_PRODUCT > bottomLimit){
        doc.addPage();
        cursorY = drawSubPageHeader(doc, ctx);
        cursorY = drawTableHeader(doc, ctx, cursorY);
        prevCat = null;
      }
      if(prevCat !== null && prevCat !== r.catEn){
        cursorY = drawCategorySeparator(doc, ctx, cursorY);
      }
      prevCat = r.catEn;
      cursorY = drawProductRow(doc, ctx, cursorY, r);
    }
  }

  // Footer — last page only.  If there is no room, push it to its own page.
  ctx.cursorY = cursorY;
  if(cursorY + FOOTER_BAND_H > bottomLimit){
    doc.addPage();
    cursorY = drawSubPageHeader(doc, ctx);
    ctx.cursorY = cursorY;
  }
  drawFooter(doc, ctx);

  // Page numbers — bottom right on every page, "1 of N".
  const total = doc.getNumberOfPages();
  for(let p = 1; p <= total; p++){
    doc.setPage(p);
    drawPageNumber(doc, total, p);
  }

  // Save
  const branch = String((inputs.customer && inputs.customer.branch) || "report").replace(/[^0-9A-Za-z _-]/g, "") || "report";
  const dateStr = (inputs.dateStr || "").replace(/[^0-9A-Za-z-]/g, "") || "report";
  const fname = `${branch}-inventory-${dateStr}.pdf`;
  doc.save(fname);

  return { pages: total, fileName: fname };
}