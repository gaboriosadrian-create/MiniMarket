import * as XLSX from 'xlsx';
import { Product, ExcelImportRow, ExcelImportSummary } from '../types';

/**
 * Downloads a sample Excel template for importing products
 */
export function downloadExcelTemplate() {
  const sampleData = [
    {
      'Código de barras': '7791234567890',
      'Producto': 'Alfajor Chocolate 50g',
      'Costo': 800,
      'Precio de venta': 1200,
      'Stock': 30,
      'Categoría': 'Alfajores'
    },
    {
      'Código de barras': '7799876543210',
      'Producto': 'Gaseosa Cola 500ml',
      'Costo': 1000,
      'Precio de venta': 1500,
      'Stock': 24,
      'Categoría': 'Bebidas'
    },
    {
      'Código de barras': '',
      'Producto': 'Empanada de Carne (Sin Código)',
      'Costo': 900,
      'Precio de venta': 1400,
      'Stock': 15,
      'Categoría': 'Comida'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  
  // Set column widths for nice formatting
  worksheet['!cols'] = [
    { wch: 20 }, // Código de barras
    { wch: 30 }, // Producto
    { wch: 12 }, // Costo
    { wch: 16 }, // Precio de venta
    { wch: 10 }, // Stock
    { wch: 18 }  // Categoría
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos');

  XLSX.writeFile(workbook, 'Plantilla_Productos_MiniMarket.xlsx');
}

/**
 * Parses uploaded .xlsx file and validates against existing products
 */
export async function parseAndValidateExcel(
  file: File, 
  existingProducts: Product[]
): Promise<ExcelImportSummary> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });

  if (workbook.SheetNames.length === 0) {
    throw new Error('El archivo Excel no contiene hojas válidas.');
  }

  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows: any[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

  if (!rawRows || rawRows.length === 0) {
    throw new Error('El archivo Excel está vacío o no contiene filas de datos.');
  }

  const existingBarcodeMap = new Map<string, Product>();
  existingProducts.forEach((p) => {
    if (p.barcode && p.barcode.trim()) {
      existingBarcodeMap.set(p.barcode.trim(), p);
    }
  });

  const fileBarcodesSeen = new Set<string>();
  const parsedRows: ExcelImportRow[] = [];

  let newCount = 0;
  let updateCount = 0;
  let errorCount = 0;

  rawRows.forEach((row, index) => {
    const rowNumber = index + 2; // Accounting for 1-based header row

    // Helper to find column value flexibly
    const getValue = (possibleKeys: string[]): string => {
      for (const k of Object.keys(row)) {
        const cleanKey = k.toLowerCase().trim();
        if (possibleKeys.some(pk => cleanKey.includes(pk.toLowerCase()))) {
          return String(row[k]).trim();
        }
      }
      return '';
    };

    const rawBarcode = getValue(['código', 'codigo', 'barcode', 'código de barras']);
    const rawName = getValue(['producto', 'nombre', 'descripcion', 'description', 'title']);
    const rawCost = getValue(['costo', 'cost', 'precio costo', 'costprice']);
    const rawSalePrice = getValue(['precio de venta', 'precio venta', 'saleprice', 'precio', 'price']);
    const rawStock = getValue(['stock', 'cantidad', 'qty', 'existencia']);
    const rawCategory = getValue(['categoría', 'categoria', 'category']) || 'General';

    const barcode = rawBarcode ? String(rawBarcode).trim() : null;
    const name = rawName ? String(rawName).trim() : '';

    const costPrice = parseFloat(rawCost.replace(/[^0-9.-]+/g, '')) || 0;
    const salePrice = parseFloat(rawSalePrice.replace(/[^0-9.-]+/g, '')) || 0;
    const stock = parseInt(rawStock.replace(/[^0-9-]+/g, ''), 10) || 0;

    let status: 'NEW' | 'UPDATE' | 'ERROR' = 'NEW';
    let errorReason: string | undefined = undefined;
    let existingProductId: string | undefined = undefined;
    let stockIgnoredMessage: string | undefined = undefined;

    // VALIDATION 1: Product Name Mandatory
    if (!name) {
      status = 'ERROR';
      errorReason = 'Falta el nombre del producto';
    } 
    // VALIDATION 2: Valid Prices
    else if (isNaN(costPrice) || costPrice < 0) {
      status = 'ERROR';
      errorReason = 'Precio de costo inválido';
    } else if (isNaN(salePrice) || salePrice < 0) {
      status = 'ERROR';
      errorReason = 'Precio de venta inválido';
    } else if (isNaN(stock) || stock < 0) {
      status = 'ERROR';
      errorReason = 'Stock inválido';
    } 
    // VALIDATION 3: Duplicate barcode within uploaded file
    else if (barcode && fileBarcodesSeen.has(barcode)) {
      status = 'ERROR';
      errorReason = `Código de barras "${barcode}" duplicado dentro del archivo Excel`;
    }

    if (barcode && status !== 'ERROR') {
      fileBarcodesSeen.add(barcode);
    }

    // CHECK MATCH WITH EXISTING PRODUCTS
    if (status !== 'ERROR') {
      if (barcode && existingBarcodeMap.has(barcode)) {
        status = 'UPDATE';
        const existingProd = existingBarcodeMap.get(barcode)!;
        existingProductId = existingProd.id;
        stockIgnoredMessage = 'Stock del Excel ignorado para no alterar el inventario actual';
        updateCount++;
      } else {
        status = 'NEW';
        newCount++;
      }
    } else {
      errorCount++;
    }

    parsedRows.push({
      rowNumber,
      barcode,
      name,
      costPrice,
      salePrice,
      stock,
      category: rawCategory || 'General',
      status,
      errorReason,
      existingProductId,
      stockIgnoredMessage
    });
  });

  return {
    newCount,
    updateCount,
    errorCount,
    rows: parsedRows
  };
}
