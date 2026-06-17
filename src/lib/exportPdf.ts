import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { ALL_TABS } from './dashboardTabs';

// A4 landscape points
const PAGE_W = 841.89;
const PAGE_H = 595.28;
const MARGIN_X = 32;
const HEADER_H = 56;
const FOOTER_H = 24;
const CONTENT_TOP = HEADER_H + 12;
const CONTENT_BOTTOM = PAGE_H - FOOTER_H - 12;
const CONTENT_H = CONTENT_BOTTOM - CONTENT_TOP;
const CONTENT_W = PAGE_W - MARGIN_X * 2;

interface BrandInfo {
  clientName: string;
  weekLabel: string;
  primaryColor: string; // hsl(...) or hex
}

/** Convert any css color (hsl, hex, rgb) to rgb tuple via canvas. */
function colorToRgb(color: string): [number, number, number] {
  try {
    const ctx = document.createElement('canvas').getContext('2d')!;
    ctx.fillStyle = '#000';
    ctx.fillStyle = color;
    const computed = ctx.fillStyle as string; // normalized "#rrggbb" or "rgba(...)"
    if (computed.startsWith('#')) {
      const n = parseInt(computed.slice(1), 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    const m = computed.match(/(\d+(\.\d+)?)/g);
    if (m && m.length >= 3) return [parseInt(m[0]), parseInt(m[1]), parseInt(m[2])];
  } catch {}
  return [27, 43, 138];
}

function drawHeaderFooter(doc: jsPDF, brand: BrandInfo, pageNum: number, totalPages: number, sectionLabel: string, generatedAt: string) {
  const [r, g, b] = colorToRgb(brand.primaryColor);
  // Header bar
  doc.setFillColor(r, g, b);
  doc.rect(0, 0, PAGE_W, HEADER_H, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(brand.clientName.toUpperCase(), MARGIN_X, 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Intelligence Dashboard · ${brand.weekLabel}`, MARGIN_X, 40);
  // right side
  doc.setFontSize(8);
  const rightLine1 = sectionLabel;
  const rightLine2 = `Generated ${generatedAt}`;
  doc.text(rightLine1, PAGE_W - MARGIN_X, 24, { align: 'right' });
  doc.text(rightLine2, PAGE_W - MARGIN_X, 40, { align: 'right' });

  // Footer
  doc.setTextColor(120, 120, 120);
  doc.setFontSize(8);
  doc.text(`Page ${pageNum} of ${totalPages}`, PAGE_W / 2, PAGE_H - 12, { align: 'center' });
  doc.setTextColor(0, 0, 0);
}

async function captureElement(el: HTMLElement): Promise<HTMLCanvasElement> {
  return await html2canvas(el, {
    backgroundColor: '#ffffff',
    scale: 2,
    useCORS: true,
    logging: false,
    windowWidth: el.scrollWidth,
    windowHeight: el.scrollHeight,
    ignoreElements: (element) => {
      const rect = element.getBoundingClientRect();
      return rect.width === 0 || rect.height === 0;
    },
    onclone: (clonedDoc) => {
      clonedDoc.querySelectorAll('*').forEach((node) => {
        const clonedEl = node as HTMLElement;
        const style = window.getComputedStyle(clonedEl);
        if (style.backgroundImage !== 'none') {
          const rect = clonedEl.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) {
            clonedEl.style.backgroundImage = 'none';
          }
        }
      });
    },
  });
}

/** Slice a tall canvas vertically into pages and add to the PDF. */
function addCanvasPaginated(
  doc: jsPDF,
  canvas: HTMLCanvasElement,
  brand: BrandInfo,
  sectionLabel: string,
  generatedAt: string,
  startNewPage: boolean,
  pageRef: { num: number; total: number },
) {
  const pxPerPt = canvas.width / CONTENT_W;
  const pageHeightPx = Math.floor(CONTENT_H * pxPerPt);
  let offset = 0;
  let isFirst = true;
  while (offset < canvas.height) {
    if (!isFirst || startNewPage) doc.addPage();
    isFirst = false;
    const sliceHeight = Math.min(pageHeightPx, canvas.height - offset);
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = sliceHeight;
    const ctx = slice.getContext('2d')!;
    ctx.drawImage(canvas, 0, offset, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
    const img = slice.toDataURL('image/jpeg', 0.92);
    drawHeaderFooter(doc, brand, pageRef.num, pageRef.total, sectionLabel, generatedAt);
    const renderH = sliceHeight / pxPerPt;
    doc.addImage(img, 'JPEG', MARGIN_X, CONTENT_TOP, CONTENT_W, renderH, undefined, 'FAST');
    pageRef.num += 1;
    offset += sliceHeight;
  }
}

export interface ExportOptions {
  brand: BrandInfo;
  /** Element wrapping the KPI bar to capture for the executive summary. */
  kpiEl: HTMLElement | null;
  /** Returns the rendered tab content element for a given tab label.
   *  Called sequentially; implementation should set state and resolve once the tab is mounted+rendered. */
  renderTab: (tabLabel: string) => Promise<HTMLElement | null>;
  /** Optional progress callback (0..1). */
  onProgress?: (p: number, msg: string) => void;
}

export async function exportDashboardPdf(opts: ExportOptions): Promise<void> {
  const { brand, kpiEl, renderTab, onProgress } = opts;
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const generatedAt = new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });

  // We don't know total pages up front; we render with placeholder then re-stamp at end.
  // Track which (pageIndex 1-based, sectionLabel) we used.
  const stamps: { section: string }[] = [];
  const pageRef = { num: 1, total: 1 };

  // --- Cover / Executive Summary (KPI bar) ---
  onProgress?.(0.02, 'Building cover page');
  // Cover page first
  drawHeaderFooter(doc, brand, 1, 1, 'Executive Summary', generatedAt);
  stamps.push({ section: 'Executive Summary' });
  const [r, g, b] = colorToRgb(brand.primaryColor);
  doc.setTextColor(20, 20, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(28);
  doc.text('Intelligence Report', MARGIN_X, CONTENT_TOP + 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(90, 90, 90);
  doc.text(`${brand.clientName} · ${brand.weekLabel}`, MARGIN_X, CONTENT_TOP + 60);
  doc.setDrawColor(r, g, b);
  doc.setLineWidth(2);
  doc.line(MARGIN_X, CONTENT_TOP + 76, MARGIN_X + 80, CONTENT_TOP + 76);
  doc.setTextColor(0, 0, 0);

  if (kpiEl) {
    const kpiCanvas = await captureElement(kpiEl);
    const kpiHpt = (kpiCanvas.height / kpiCanvas.width) * CONTENT_W;
    const kpiTop = CONTENT_TOP + 100;
    const img = kpiCanvas.toDataURL('image/jpeg', 0.92);
    doc.addImage(img, 'JPEG', MARGIN_X, kpiTop, CONTENT_W, Math.min(kpiHpt, CONTENT_H - 110), undefined, 'FAST');
  }
  pageRef.num = 2;

  // --- Each tab section ---
  const tabs = ALL_TABS;
  for (let i = 0; i < tabs.length; i++) {
    const tab = tabs[i];
    onProgress?.(0.05 + 0.9 * (i / tabs.length), `Rendering ${tab.label}`);
    const el = await renderTab(tab.label);
    if (!el) continue;
    // give recharts/animations a beat to settle
    await new Promise((r) => setTimeout(r, 250));
    const canvas = await captureElement(el);
    stamps.push({ section: tab.label });
    addCanvasPaginated(doc, canvas, brand, tab.label, generatedAt, true, pageRef);
  }

  // Restamp footers with correct totals (overwriting needs we redo headers/footers per-page).
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    // overwrite footer Page x of y only
    doc.setFillColor(255, 255, 255);
    doc.rect(0, PAGE_H - FOOTER_H, PAGE_W, FOOTER_H, 'F');
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Page ${p} of ${totalPages}`, PAGE_W / 2, PAGE_H - 12, { align: 'center' });
  }

  // Filename
  const safeName = brand.clientName.replace(/[^A-Za-z0-9]/g, '');
  const safeWeek = brand.weekLabel.replace(/[^A-Za-z0-9]/g, '');
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  doc.save(`${safeName}_Intelligence_Dashboard_${safeWeek}_${ymd}.pdf`);
  onProgress?.(1, 'Done');
}
