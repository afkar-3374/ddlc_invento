import JsBarcode from 'jsbarcode';
import { jsPDF } from 'jspdf';
import { Product } from '../types';

export interface LabelSizeOption {
  id: string;
  name: string;
  description: string;
  widthMm: number;
  heightMm: number;
  isSheet?: boolean;
  cols?: number;
  rows?: number;
}

export const LABEL_SIZES: LabelSizeOption[] = [
  {
    id: 'standard-50-25',
    name: 'Standard Lab Bin (50 × 25 mm)',
    description: 'Perfect for component bins, anti-static bags, and modules',
    widthMm: 50,
    heightMm: 25,
  },
  {
    id: 'compact-38-19',
    name: 'Compact Component (38 × 19 mm)',
    description: 'Ideal for small sensor bags, IC chips, and headers',
    widthMm: 38,
    heightMm: 19,
  },
  {
    id: 'cable-70-36',
    name: 'Cable & Equipment (70 × 36 mm)',
    description: 'For cables, adapters, development boards, and instruments',
    widthMm: 70,
    heightMm: 36,
  },
  {
    id: 'a4-sheet-24',
    name: 'A4 Multi-Label Sheet (3 × 8 = 24 labels)',
    description: 'Standard laser/inkjet A4 sticker sheet (70 × 37 mm per label)',
    widthMm: 70,
    heightMm: 37,
    isSheet: true,
    cols: 3,
    rows: 8,
  },
];

/**
 * Generate a crisp Code 128 barcode as a data URL (PNG)
 */
export function generateBarcodeDataUrl(
  value: string,
  options: {
    width?: number;
    height?: number;
    displayValue?: boolean;
    fontSize?: number;
    background?: string;
    lineColor?: string;
  } = {}
): string {
  const canvas = document.createElement('canvas');
  try {
    JsBarcode(canvas, value, {
      format: 'CODE128',
      width: options.width || 2,
      height: options.height || 45,
      displayValue: options.displayValue ?? false,
      fontSize: options.fontSize || 12,
      font: 'monospace',
      background: options.background || '#ffffff',
      lineColor: options.lineColor || '#000000',
      margin: 4,
    });
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn(`Barcode generation failed for "${value}", fallback to CODE39 or text:`, err);
    // If Code 128 failed due to unencodable chars, fallback or sanitize
    try {
      const sanitized = value.replace(/[^A-Za-z0-9_-]/g, '');
      JsBarcode(canvas, sanitized, {
        format: 'CODE128',
        width: 2,
        height: 40,
        displayValue: false,
        margin: 4,
      });
      return canvas.toDataURL('image/png');
    } catch (e) {
      console.error('Fatal barcode render error:', e);
      return '';
    }
  }
}

/**
 * Generate a standalone SVG string for the barcode
 */
export function generateBarcodeSvg(value: string): string {
  const svgNode = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  try {
    JsBarcode(svgNode, value, {
      format: 'CODE128',
      width: 2,
      height: 45,
      displayValue: true,
      font: 'monospace',
      fontSize: 12,
      margin: 4,
    });
    return new XMLSerializer().serializeToString(svgNode);
  } catch (err) {
    console.error('Barcode SVG render failed:', err);
    return '';
  }
}

/**
 * Download a single barcode label as PNG
 */
export function downloadSingleLabelPng(product: Product, size: LabelSizeOption = LABEL_SIZES[0]): void {
  const canvas = document.createElement('canvas');
  // DPI scale: 300 DPI (approx 11.8 pixels per mm)
  const dpmm = 11.81;
  const widthPx = Math.round(size.widthMm * dpmm);
  const heightPx = Math.round(size.heightMm * dpmm);

  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, widthPx, heightPx);

  // Border (subtle cutting guideline)
  ctx.strokeStyle = '#e0e0e0';
  ctx.lineWidth = 1;
  ctx.strokeRect(1, 1, widthPx - 2, heightPx - 2);

  // DDLC AI Header
  ctx.fillStyle = '#0a0d0f';
  ctx.font = `bold ${Math.round(heightPx * 0.08)}px sans-serif`;
  ctx.fillText('DDLC AI INVENTORY', Math.round(widthPx * 0.05), Math.round(heightPx * 0.14));

  // Product Name
  ctx.fillStyle = '#111827';
  ctx.font = `bold ${Math.round(heightPx * 0.11)}px sans-serif`;
  const maxTitleWidth = widthPx * 0.9;
  let title = product.name;
  if (ctx.measureText(title).width > maxTitleWidth) {
    while (title.length > 5 && ctx.measureText(title + '...').width > maxTitleWidth) {
      title = title.slice(0, -1);
    }
    title += '...';
  }
  ctx.fillText(title, Math.round(widthPx * 0.05), Math.round(heightPx * 0.28));

  // Render barcode image
  const codeValue = product.barcode || product.sku;
  const barcodeDataUrl = generateBarcodeDataUrl(codeValue, {
    width: 2,
    height: Math.round(heightPx * 0.38),
    displayValue: false,
  });

  const img = new Image();
  img.onload = () => {
    const bcX = Math.round(widthPx * 0.05);
    const bcY = Math.round(heightPx * 0.33);
    const bcW = Math.round(widthPx * 0.9);
    const bcH = Math.round(heightPx * 0.38);
    ctx.drawImage(img, bcX, bcY, bcW, bcH);

    // SKU text beneath barcode
    ctx.fillStyle = '#000000';
    ctx.font = `bold ${Math.round(heightPx * 0.1)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(product.sku, widthPx / 2, Math.round(heightPx * 0.82));

    // Footer info: Location & Project
    ctx.textAlign = 'left';
    ctx.fillStyle = '#4b5563';
    ctx.font = `${Math.round(heightPx * 0.07)}px sans-serif`;
    const locText = product.storageLocation ? `Loc: ${product.storageLocation}` : '';
    const projText = product.projectId ? `Proj: ${product.projectId}` : '';
    const footer = [locText, projText].filter(Boolean).join(' • ');
    if (footer) {
      ctx.fillText(footer, Math.round(widthPx * 0.05), Math.round(heightPx * 0.94));
    }

    // Trigger download
    const link = document.createElement('a');
    link.download = `label_${product.sku}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };
  img.src = barcodeDataUrl;
}

/**
 * Download a single barcode label as SVG
 */
export function downloadSingleLabelSvg(product: Product, size: LabelSizeOption = LABEL_SIZES[0]): void {
  const codeValue = product.barcode || product.sku;
  const barcodeSvgRaw = generateBarcodeSvg(codeValue);

  const cleanName = product.name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cleanSku = product.sku.replace(/&/g, '&amp;');
  const cleanLoc = (product.storageLocation || '').replace(/&/g, '&amp;');

  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${size.widthMm}mm" height="${size.heightMm}mm" viewBox="0 0 ${size.widthMm * 10} ${size.heightMm * 10}">
  <rect width="100%" height="100%" fill="#ffffff" stroke="#dddddd" stroke-width="1"/>
  <text x="15" y="25" font-family="system-ui, sans-serif" font-size="14" font-weight="bold" fill="#000000">DDLC AI</text>
  <text x="15" y="50" font-family="system-ui, sans-serif" font-size="18" font-weight="bold" fill="#111827">${cleanName.slice(0, 32)}</text>
  <g transform="translate(15, 60) scale(0.9)">
    ${barcodeSvgRaw}
  </g>
  <text x="${(size.widthMm * 10) / 2}" y="${size.heightMm * 10 - 25}" font-family="monospace" font-size="16" font-weight="bold" text-anchor="middle" fill="#000000">${cleanSku}</text>
  ${cleanLoc ? `<text x="15" y="${size.heightMm * 10 - 10}" font-family="system-ui, sans-serif" font-size="11" fill="#4b5563">Loc: ${cleanLoc}</text>` : ''}
</svg>`;

  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.download = `label_${product.sku}.svg`;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Generate and download PDF containing labels
 * Supports single-label printers (roll labels) as well as A4 multi-label sheets
 */
export async function generateLabelsPdf(
  itemsWithCopies: Array<{ product: Product; copies: number }>,
  size: LabelSizeOption = LABEL_SIZES[0]
): Promise<Blob> {
  const isA4Sheet = size.isSheet;

  // Flatten items according to copy counts
  const labelQueue: Product[] = [];
  for (const item of itemsWithCopies) {
    const count = Math.max(1, item.copies || 1);
    for (let i = 0; i < count; i++) {
      labelQueue.push(item.product);
    }
  }

  if (labelQueue.length === 0) {
    throw new Error('No items selected for label generation');
  }

  if (isA4Sheet) {
    // Standard A4: 210 x 297 mm
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = 210;
    const pageHeight = 297;
    const cols = size.cols || 3;
    const rows = size.rows || 8;
    const labelW = size.widthMm; // e.g. 70mm
    const labelH = size.heightMm; // e.g. 37mm
    const marginX = (pageWidth - cols * labelW) / 2; // balanced margin
    const marginY = (pageHeight - rows * labelH) / 2;

    const labelsPerPage = cols * rows;

    for (let i = 0; i < labelQueue.length; i++) {
      const pageIndex = Math.floor(i / labelsPerPage);
      const slotIndex = i % labelsPerPage;

      if (slotIndex === 0 && pageIndex > 0) {
        doc.addPage('a4', 'portrait');
      }

      const col = slotIndex % cols;
      const row = Math.floor(slotIndex / cols);

      const x = marginX + col * labelW;
      const y = marginY + row * labelH;

      drawSingleLabelOnPdf(doc, labelQueue[i], x, y, labelW, labelH);
    }

    const pdfBlob = doc.output('blob');
    return pdfBlob;
  } else {
    // Individual label roll / page mode
    // Create doc with exact label dimensions
    const orientation = size.widthMm >= size.heightMm ? 'landscape' : 'portrait';
    const doc = new jsPDF({
      orientation,
      unit: 'mm',
      format: [size.widthMm, size.heightMm],
    });

    for (let i = 0; i < labelQueue.length; i++) {
      if (i > 0) {
        doc.addPage([size.widthMm, size.heightMm], orientation);
      }
      drawSingleLabelOnPdf(doc, labelQueue[i], 0, 0, size.widthMm, size.heightMm);
    }

    const pdfBlob = doc.output('blob');
    return pdfBlob;
  }
}

/**
 * Draw a single label on a jsPDF instance at (x, y) with size (w, h) in mm
 */
function drawSingleLabelOnPdf(
  doc: jsPDF,
  product: Product,
  x: number,
  y: number,
  w: number,
  h: number
) {
  // Border guideline (subtle gray)
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.2);
  doc.rect(x + 0.5, y + 0.5, w - 1, h - 1);

  // Header: DDLC AI branding
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(50, 50, 50);
  doc.text('DDLC AI', x + 2.5, y + 3.8);

  // Category / Project tag on top right
  const tagText = product.projectId ? product.projectId.slice(0, 10) : product.category.slice(0, 10);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 100, 100);
  doc.text(tagText, x + w - 2.5, y + 3.8, { align: 'right' });

  // Product Name (truncated to fit)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(h > 22 ? 8.5 : 7.5);
  doc.setTextColor(15, 23, 42);
  const maxTitleWidth = w - 5;
  let title = product.name;
  if (doc.getTextWidth(title) > maxTitleWidth) {
    while (title.length > 5 && doc.getTextWidth(title + '...') > maxTitleWidth) {
      title = title.slice(0, -1);
    }
    title += '...';
  }
  doc.text(title, x + 2.5, y + (h > 22 ? 7.8 : 7.0));

  // Barcode Generation
  const codeValue = product.barcode || product.sku;
  const barcodeDataUrl = generateBarcodeDataUrl(codeValue, {
    width: 2,
    height: 40,
    displayValue: false,
  });

  const barcodeY = y + (h > 22 ? 9.5 : 8.5);
  const barcodeH = h > 22 ? h * 0.42 : h * 0.38;
  const barcodeW = w - 6;

  if (barcodeDataUrl) {
    try {
      doc.addImage(barcodeDataUrl, 'PNG', x + 3, barcodeY, barcodeW, barcodeH, undefined, 'FAST');
    } catch (e) {
      console.warn('Could not add barcode image to PDF:', e);
    }
  }

  // SKU printed bold beneath barcode
  doc.setFont('courier', 'bold');
  doc.setFontSize(h > 22 ? 8 : 7);
  doc.setTextColor(0, 0, 0);
  doc.text(product.sku, x + w / 2, barcodeY + barcodeH + 3.2, { align: 'center' });

  // Optional Footer: Storage Location
  if (h >= 24 && product.storageLocation) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(100, 100, 100);
    doc.text(`Loc: ${product.storageLocation}`, x + 2.5, y + h - 1.8);
  }
}

/**
 * Filter products by SKU range
 * Handles formats like DDLC-CMP-00010 to DDLC-CMP-00025, or ITEM-001 to ITEM-020
 */
export function filterProductsBySkuRange(
  allProducts: Product[],
  startSku: string,
  endSku: string
): {
  matchedProducts: Product[];
  missingSkus: string[];
} {
  const cleanStart = startSku.trim().toUpperCase();
  const cleanEnd = endSku.trim().toUpperCase();

  if (!cleanStart && !cleanEnd) {
    return { matchedProducts: [...allProducts], missingSkus: [] };
  }

  // Extract numeric suffix if both have matching prefixes
  const numRegex = /^(.*?)(\d+)$/;
  const startMatch = cleanStart.match(numRegex);
  const endMatch = cleanEnd.match(numRegex);

  // If both have prefix + number and same prefix
  if (startMatch && endMatch && startMatch[1] === endMatch[1]) {
    const prefix = startMatch[1];
    const startNum = parseInt(startMatch[2], 10);
    const endNum = parseInt(endMatch[2], 10);
    const minNum = Math.min(startNum, endNum);
    const maxNum = Math.max(startNum, endNum);
    const padLen = Math.max(startMatch[2].length, endMatch[2].length);

    const expectedSkus: string[] = [];
    for (let n = minNum; n <= maxNum; n++) {
      expectedSkus.push(`${prefix}${String(n).padStart(padLen, '0')}`);
    }

    const matchedProducts: Product[] = [];
    const foundSkus = new Set<string>();

    for (const exp of expectedSkus) {
      const match = allProducts.find(
        (p) => p.sku.toUpperCase() === exp || (p.itemNumber && `${prefix}${String(p.itemNumber).padStart(padLen, '0')}` === exp)
      );
      if (match) {
        matchedProducts.push(match);
        foundSkus.add(exp);
      }
    }

    const missingSkus = expectedSkus.filter((sku) => !foundSkus.has(sku));

    return { matchedProducts, missingSkus };
  }

  // Fallback to lexicographical comparison
  const matchedProducts = allProducts.filter((p) => {
    const pSku = p.sku.toUpperCase();
    if (cleanStart && pSku < cleanStart) return false;
    if (cleanEnd && pSku > cleanEnd) return false;
    return true;
  }).sort((a, b) => a.sku.localeCompare(b.sku));

  return { matchedProducts, missingSkus: [] };
}
