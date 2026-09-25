import jsPDF from 'jspdf';
import { ReplenishmentList } from '../types';

/**
 * Formats a raw list ID into a clean, legible request number.
 * Example: 'SOL-000127'
 */
export function formatRequestCode(id: string): string {
  if (!id) return 'SOL-000001';
  if (id.startsWith('SOL-')) return id;
  if (id.startsWith('REP-')) return id.replace(/^REP-/, 'SOL-');
  const clean = id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const suffix = clean.length <= 6 ? clean.padStart(6, '0') : clean.slice(-6);
  return `SOL-${suffix}`;
}

export interface GeneratedPdfResult {
  doc: jsPDF;
  file: File;
  blob: Blob;
  fileName: string;
  reqCode: string;
  cleanBusiness: string;
}

/**
 * Central engine: builds the jsPDF instance and creates the File/Blob
 * without duplicating any PDF layout logic.
 */
export function generateReplenishmentPdfFile(
  list: ReplenishmentList,
  businessName: string
): GeneratedPdfResult {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  let y = margin;

  // Header Data Setup
  const cleanBusiness = (businessName || 'MINIMARKET').trim();
  const reqCode = formatRequestCode(list.id);
  const requester = list.exporterName || list.creatorName || 'Vendedor';

  const dateSource = list.exportedAt || list.createdAt || new Date().toISOString();
  const dateObj = new Date(dateSource);

  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');

  const formattedDate = `${day}/${month}/${year}`;
  const formattedTime = `${hours}:${minutes}`;

  // ==========================================
  // 1. HEADER / ENCABEZADO
  // ==========================================
  // Business Name
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.text(cleanBusiness.toUpperCase(), margin, y);

  y += 7;

  // Title
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(79, 70, 229); // Indigo 600
  doc.text('PEDIDO DE MERCADERÍA', margin, y);

  y += 4;

  // Header divider line
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  y += 6;

  // Metadata Block
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(51, 65, 85); // Slate 700
  doc.text(`Solicitado por: ${requester}`, margin, y);

  // Request Code (Right aligned, prominent)
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59); // Slate 800
  doc.text(`Solicitud N.º ${reqCode}`, pageWidth - margin, y, { align: 'right' });

  y += 5;

  // Date and Time
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text(`${formattedDate} · ${formattedTime}`, margin, y);

  if (list.supplierName && list.supplierName.trim()) {
    doc.text(`Proveedor: ${list.supplierName.trim()}`, pageWidth - margin, y, { align: 'right' });
  }

  y += 8;

  // Sub-divider line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  y += 6;

  // ==========================================
  // 2. ITEMS GROUPED & SORTED BY CATEGORY
  // ==========================================
  const itemsByCategory: Record<string, typeof list.items> = {};

  (list.items || []).forEach((item) => {
    const rawCat = (item.category && item.category.trim()) ? item.category.trim() : 'VARIOS';
    const cat = rawCat.toUpperCase();
    if (!itemsByCategory[cat]) {
      itemsByCategory[cat] = [];
    }
    itemsByCategory[cat].push(item);
  });

  // Sort categories alphabetically
  const sortedCategories = Object.keys(itemsByCategory).sort((a, b) => a.localeCompare(b, 'es'));

  // Sort items within each category alphabetically by product name
  sortedCategories.forEach((cat) => {
    itemsByCategory[cat].sort((a, b) => a.productName.localeCompare(b.productName, 'es'));
  });

  const totalProducts = list.items ? list.items.length : 0;
  let totalUnits = 0;

  sortedCategories.forEach((category) => {
    const catItems = itemsByCategory[category];

    // Check page break before printing Category Header
    if (y > pageHeight - 35) {
      doc.addPage();
      y = margin;
    }

    // Category Header Banner
    doc.setFillColor(241, 245, 249); // Slate 100
    doc.roundedRect(margin, y, pageWidth - margin * 2, 7.5, 1, 1, 'F');

    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59); // Slate 800
    doc.text(category, margin + 4, y + 5);

    y += 10;

    // Items under Category
    catItems.forEach((item) => {
      const qtyNum = Number(item.requestedQuantity) || 0;
      totalUnits += qtyNum;

      // Check page break before item row
      if (y > pageHeight - 18) {
        doc.addPage();
        y = margin;
      }

      // Checkbox: Large, high contrast 4.5mm x 4.5mm rounded box
      const cbSize = 4.5;
      const cbX = margin + 2;
      const cbY = y + 1;
      doc.setDrawColor(100, 116, 139); // Slate 500
      doc.setLineWidth(0.4);
      doc.roundedRect(cbX, cbY, cbSize, cbSize, 0.8, 0.8, 'S');

      // Quantity Text
      const qtyX = margin + 11;
      const unitStr = qtyNum === 1 ? 'unidad' : 'unidades';
      const qtyText = `${qtyNum} ${unitStr}`;

      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(79, 70, 229); // Indigo 600
      doc.text(qtyText, qtyX, y + 4.5);

      // Product Name Text
      const prodX = margin + 46;
      doc.setFontSize(10.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42); // Slate 900

      const maxProdWidth = pageWidth - margin - prodX;
      const splitName = doc.splitTextToSize(item.productName, maxProdWidth);

      doc.text(splitName[0], prodX, y + 4.5);

      if (splitName.length > 1) {
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'normal');
        doc.text(splitName[1], prodX, y + 8.5);
        y += 4;
      }

      // Bottom border for row
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.3);
      doc.line(margin, y + 7, pageWidth - margin, y + 7);

      y += 8.5;
    });

    y += 3;
  });

  // ==========================================
  // 3. SUMMARY SECTION (RESUMEN)
  // ==========================================
  if (y > pageHeight - 40) {
    doc.addPage();
    y = margin;
  }

  y += 2;
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);

  y += 5;

  doc.setFillColor(248, 250, 252); // Slate 50
  doc.setDrawColor(203, 213, 225); // Slate 300
  doc.roundedRect(margin, y, pageWidth - margin * 2, 14, 1.5, 1.5, 'FD');

  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);

  doc.text(`TOTAL PRODUCTOS: ${totalProducts}`, margin + 5, y + 9);
  doc.text(`TOTAL UNIDADES: ${totalUnits}`, pageWidth - margin - 5, y + 9, { align: 'right' });

  y += 20;

  // ==========================================
  // 4. NOTES & OBSERVATIONS SECTION
  // ==========================================
  if (y > pageHeight - 42) {
    doc.addPage();
    y = margin;
  }

  if (list.notes && list.notes.trim()) {
    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(71, 85, 105);
    doc.text('NOTAS DEL PEDIDO:', margin, y);
    y += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    const noteLines = doc.splitTextToSize(list.notes.trim(), pageWidth - margin * 2);
    doc.text(noteLines, margin, y);

    y += noteLines.length * 4.5 + 4;
  }

  // Reservation space for Supplier Observations
  if (y > pageHeight - 28) {
    doc.addPage();
    y = margin;
  }

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('OBSERVACIONES DEL PROVEEDOR:', margin, y);

  y += 6;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(margin, y + 2, pageWidth - margin, y + 2);
  doc.line(margin, y + 9, pageWidth - margin, y + 9);

  // ==========================================
  // 5. FOOTER
  // ==========================================
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.text(
      `Pedido N.º ${reqCode} · ${cleanBusiness.toUpperCase()} | Página ${i} de ${pageCount}`,
      pageWidth / 2,
      pageHeight - 7,
      { align: 'center' }
    );
  }

  // Friendly file name: Pedido-[NombreNegocio]-[CodigoSolicitud].pdf
  const cleanBusinessSlug = cleanBusiness.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '') || 'Negocio';
  const fileName = `Pedido-${cleanBusinessSlug}-${reqCode}.pdf`;

  // Output as Blob and File
  const blob = doc.output('blob');
  const file = new File([blob], fileName, { type: 'application/pdf' });

  return {
    doc,
    file,
    blob,
    fileName,
    reqCode,
    cleanBusiness
  };
}

/**
 * Downloads the replenishment PDF file directly to disk.
 */
export function downloadReplenishmentPDF(
  list: ReplenishmentList,
  businessName: string
): string {
  const { doc, fileName } = generateReplenishmentPdfFile(list, businessName);
  doc.save(fileName);
  return fileName;
}

/**
 * Backwards compatibility alias for downloadReplenishmentPDF
 */
export function generateReplenishmentPDF(
  list: ReplenishmentList,
  businessName: string
): void {
  downloadReplenishmentPDF(list, businessName);
}

export interface ShareResult {
  status: 'shared' | 'downloaded' | 'cancelled';
  message?: string;
  fileName: string;
  reqCode: string;
}

/**
 * Shares the replenishment order PDF using the Web Share API (native share menu).
 * If the Web Share API is not available or files are not shareable,
 * automatically falls back to downloading the PDF file.
 */
export async function shareReplenishmentPDF(
  list: ReplenishmentList,
  businessName: string
): Promise<ShareResult> {
  const { doc, file, fileName, reqCode, cleanBusiness } = generateReplenishmentPdfFile(list, businessName);

  const shareTitle = `Pedido de productos - ${reqCode}`;
  const shareText = `Pedido de productos de ${cleanBusiness} - Solicitud ${reqCode}`;

  const shareData = {
    title: shareTitle,
    text: shareText,
    files: [file]
  };

  // Check if navigator.share and file sharing are supported
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare(shareData)
  ) {
    try {
      await navigator.share(shareData);
      return {
        status: 'shared',
        fileName,
        reqCode
      };
    } catch (err: any) {
      // If user cancelled, don't show an error
      if (
        err?.name === 'AbortError' ||
        err?.message?.toLowerCase().includes('abort') ||
        err?.message?.toLowerCase().includes('cancel')
      ) {
        return {
          status: 'cancelled',
          fileName,
          reqCode
        };
      }
      // Other error during share: trigger download fallback
      doc.save(fileName);
      return {
        status: 'downloaded',
        message: 'No se pudo abrir el menú de compartir. El PDF fue descargado automáticamente.',
        fileName,
        reqCode
      };
    }
  } else {
    // Fallback: download PDF directly
    doc.save(fileName);
    return {
      status: 'downloaded',
      message: 'Este navegador no permite compartir archivos directamente. El PDF fue descargado.',
      fileName,
      reqCode
    };
  }
}
