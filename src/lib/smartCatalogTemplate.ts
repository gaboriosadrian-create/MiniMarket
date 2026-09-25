import * as XLSX from 'xlsx';

/**
 * Generates and triggers download of the official uwi Product Catalog Excel template.
 * Includes a formatted "Productos" sheet with realistic examples and an "Instrucciones" sheet.
 */
export function downloadOfficialUwiTemplate(): void {
  // 1. Sample products sheet data
  const sampleProducts = [
    {
      'Código': 'ALF-001',
      'Código de barras': '7791234567890',
      'Producto': 'Alfajor Triple Chocolate 60g',
      'Categoría': 'Golosinas',
      'Marca': 'Guaymallén',
      'Precio de costo': 450,
      'Precio de venta': 850,
      'Stock': 48,
      'Unidad': 'Unidad',
      'Proveedor': 'Distribuidora Dulce S.A.',
      'Sin control de stock': 'NO'
    },
    {
      'Código': 'BEB-012',
      'Código de barras': '7799876543210',
      'Producto': 'Gaseosa Cola 500ml',
      'Categoría': 'Bebidas',
      'Marca': 'Coca-Cola',
      'Precio de costo': 850,
      'Precio de venta': 1400,
      'Stock': 24,
      'Unidad': 'Unidad',
      'Proveedor': 'Bebidas del Centro',
      'Sin control de stock': 'NO'
    },
    {
      'Código': 'SNK-005',
      'Código de barras': '7795554443332',
      'Producto': 'Papas Fritas Clásicas 120g',
      'Categoría': 'Snacks / Galletitas',
      'Marca': 'Lays',
      'Precio de costo': 1100,
      'Precio de venta': 1800,
      'Stock': 18,
      'Unidad': 'Unidad',
      'Proveedor': 'Snacks Express',
      'Sin control de stock': 'NO'
    },
    {
      'Código': 'LAC-003',
      'Código de barras': '7792223334445',
      'Producto': 'Leche Entera 1 Litro',
      'Categoría': 'Lácteos',
      'Marca': 'La Serenísima',
      'Precio de costo': 900,
      'Precio de venta': 1300,
      'Stock': 30,
      'Unidad': 'Litro',
      'Proveedor': 'Distribuidora Láctea',
      'Sin control de stock': 'NO'
    },
    {
      'Código': 'COM-001',
      'Código de barras': '',
      'Producto': 'Empanada de Carne Casera (Sin código)',
      'Categoría': 'Panadería',
      'Marca': 'Elaboración Propia',
      'Precio de costo': 600,
      'Precio de venta': 1200,
      'Stock': 25,
      'Unidad': 'Unidad',
      'Proveedor': '',
      'Sin control de stock': 'NO'
    },
    {
      'Código': 'SER-001',
      'Código de barras': '',
      'Producto': 'Recarga Virtual / Servicio',
      'Categoría': 'Servicios',
      'Marca': '',
      'Precio de costo': 0,
      'Precio de venta': 100,
      'Stock': 0,
      'Unidad': 'Servicio',
      'Proveedor': '',
      'Sin control de stock': 'SI'
    }
  ];

  const productsWorksheet = XLSX.utils.json_to_sheet(sampleProducts);

  // Column widths formatting
  productsWorksheet['!cols'] = [
    { wch: 12 }, // Código
    { wch: 18 }, // Código de barras
    { wch: 38 }, // Producto
    { wch: 22 }, // Categoría
    { wch: 18 }, // Marca
    { wch: 14 }, // Precio de costo
    { wch: 14 }, // Precio de venta
    { wch: 10 }, // Stock
    { wch: 12 }, // Unidad
    { wch: 26 }, // Proveedor
    { wch: 20 }  // Sin control de stock
  ];

  // 2. Instructions Sheet
  const instructions = [
    {
      'Columna': 'Código',
      'Obligatorio': 'Opcional',
      'Descripción': 'Código interno o SKU propio de tu negocio. Si no tienes, puedes dejarlo vacío.'
    },
    {
      'Columna': 'Código de barras',
      'Obligatorio': 'Opcional',
      'Descripción': 'Código EAN-13, UPC o numérico del envase para escanear con lector de código de barras o cámara.'
    },
    {
      'Columna': 'Producto',
      'Obligatorio': 'SÍ (Requerido)',
      'Descripción': 'Nombre comercial del producto. Ej: "Alfajor Triple Chocolate 60g".'
    },
    {
      'Columna': 'Categoría',
      'Obligatorio': 'Recomendado',
      'Descripción': 'Rubro o categoría para organizar el catálogo y los botones rápidos del punto de venta (Bebidas, Golosinas, Almacén, etc.).'
    },
    {
      'Columna': 'Marca',
      'Obligatorio': 'Opcional',
      'Descripción': 'Marca o fabricante del producto.'
    },
    {
      'Columna': 'Precio de costo',
      'Obligatorio': 'Recomendado',
      'Descripción': 'Precio de compra al proveedor. Permite calcular tus márgenes de ganancia y rentabilidad.'
    },
    {
      'Columna': 'Precio de venta',
      'Obligatorio': 'SÍ (Requerido)',
      'Descripción': 'Precio al público que se cobrará al cliente en el punto de venta (POS).'
    },
    {
      'Columna': 'Stock',
      'Obligatorio': 'Recomendado',
      'Descripción': 'Cantidad física actual en depósito o estantes. Se creará automáticamente el movimiento de stock inicial.'
    },
    {
      'Columna': 'Unidad',
      'Obligatorio': 'Opcional',
      'Descripción': 'Unidad de medida (Unidad, Kg, Litro, Pack, etc.).'
    },
    {
      'Columna': 'Proveedor',
      'Obligatorio': 'Opcional',
      'Descripción': 'Nombre del proveedor habitual. Si ya existe en uwi se vinculará automáticamente.'
    },
    {
      'Columna': 'Sin control de stock',
      'Obligatorio': 'Opcional',
      'Descripción': 'Escribe "SI" si es un servicio o producto que no descuenta stock en caja. Por defecto es "NO".'
    }
  ];

  const instructionsWorksheet = XLSX.utils.json_to_sheet(instructions);
  instructionsWorksheet['!cols'] = [
    { wch: 22 },
    { wch: 16 },
    { wch: 75 }
  ];

  // 3. Assemble Workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, productsWorksheet, 'Productos');
  XLSX.utils.book_append_sheet(workbook, instructionsWorksheet, 'Instrucciones');

  // Trigger download
  XLSX.writeFile(workbook, 'Plantilla_Catalogo_uwi.xlsx');
}
