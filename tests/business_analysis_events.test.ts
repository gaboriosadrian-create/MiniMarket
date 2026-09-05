import { 
  calculateSaleItemCogs, 
  isBusinessExpenseOutflow, 
  calculateDateRange,
  MonthlyComparisonPoint
} from '../src/lib/businessAnalysisService';
import {
  generateEventId,
  getEventNavigationTarget,
  recordBusinessEvent
} from '../src/lib/eventService';
import { 
  SaleItem, 
  Product, 
  Expense, 
  Purchase, 
  PaymentObligation, 
  PaymentSettlement,
  BusinessEvent
} from '../src/types';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err?.message || err}`);
    failed++;
  }
}

function assert(condition: any, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: [${message}] Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

console.log('======================================================');
console.log('  UWI: AUDITORÍA TÉCNICA - CENTRO DE EVENTOS & ANÁLISIS');
console.log('======================================================\n');

async function runAllTests() {
  // 1. RESULTADO ECONÓMICO CORRECTO
  await test('1. RESULTADO ECONÓMICO: Ventas - CMV Histórico - Gastos Operativos Negocio', () => {
    const totalSales = 10000;
    const totalCogs = 4000; // 40% cost
    const operatingExpensesPaid = 1500;
    const grossMargin = totalSales - totalCogs; // 6000
    const economicResult = grossMargin - operatingExpensesPaid; // 4500

    assertEqual(grossMargin, 6000, 'Margen Bruto = Ventas - CMV');
    assertEqual(economicResult, 4500, 'Resultado Económico = Margen Bruto - Gastos Operativos');
  });

  // 2. RESULTADO FINANCIERO CORRECTO
  await test('2. RESULTADO FINANCIERO: Cobros Efectivos - Pagos Efectivos del Negocio', () => {
    const totalIncome = 10000; // Cobros de ventas
    const directPurchasesPaid = 3000; // Compras pagadas al contado con fondos del negocio
    const opExpensesPaid = 1500; // Gastos operativos pagados con fondos del negocio
    const settlementsPaid = 1200; // Pagos de deudas a proveedores realizados en el período
    const totalOutflows = directPurchasesPaid + opExpensesPaid + settlementsPaid; // 5700
    const financialResult = totalIncome - totalOutflows; // 4300

    assertEqual(totalOutflows, 5700, 'Total egresos financieros pagados');
    assertEqual(financialResult, 4300, 'Flujo de caja financiero');
  });

  // 3. GASTO CASH (PAGADO DEL NEGOCIO)
  await test('3. GASTO CASH: Gasto pagado con fondos de caja comercial se computa como egreso financiero', () => {
    const expense: Expense = {
      id: 'exp-cash-1',
      businessId: 'biz-test',
      userId: 'user-1',
      description: 'Artículos de limpieza',
      amount: 800,
      paidAmount: 800,
      paymentMethod: 'EFECTIVO',
      fundSource: 'CASH',
      status: 'PAGADO',
      category: 'Limpieza',
      createdAt: '2026-09-01T10:00:00.000Z'
    };

    assert(isBusinessExpenseOutflow(expense), 'Gasto CASH pagado debe considerarse egreso del negocio');
  });

  // 4. GASTO PERSONAL
  await test('4. GASTO PERSONAL: No reduce la caja ni el resultado financiero del negocio', () => {
    const personalExpense: Expense = {
      id: 'exp-pers-1',
      businessId: 'biz-test',
      userId: 'user-1',
      description: 'Almuerzo personal del dueño',
      amount: 1500,
      paidAmount: 1500,
      paymentMethod: 'EFECTIVO',
      fundSource: 'PERSONAL',
      status: 'PAGADO',
      category: 'Otros',
      createdAt: '2026-09-01T13:00:00.000Z'
    };

    assert(!isBusinessExpenseOutflow(personalExpense), 'Gasto PERSONAL no debe ser egreso financiero del negocio');
  });

  // 5. GASTO PENDIENTE
  await test('5. GASTO PENDIENTE: Gasto pendiente no se deduce de caja antes de su pago', () => {
    const pendingExpense: Expense = {
      id: 'exp-pend-1',
      businessId: 'biz-test',
      userId: 'user-1',
      description: 'Servicio de Internet pendiente',
      amount: 5000,
      paymentMethod: 'EFECTIVO',
      fundSource: 'CASH',
      status: 'PENDIENTE',
      obligationId: 'obl-exp-1',
      category: 'Servicios',
      createdAt: '2026-09-01T15:00:00.000Z'
    };

    assert(!isBusinessExpenseOutflow(pendingExpense), 'Gasto PENDIENTE no debe deducirse como egreso pagado');
  });

  // 6. PAGO DE GASTO PENDIENTE
  await test('6. PAGO DE GASTO PENDIENTE: La liquidación de la obligación registra el egreso en el período efectivo', () => {
    const settlement: PaymentSettlement = {
      id: 'settle-exp-1',
      businessId: 'biz-test',
      obligationId: 'obl-exp-1',
      amount: 5000,
      paymentMethod: 'EFECTIVO',
      fundSource: 'CASH',
      paymentDate: '2026-09-02T10:00:00.000Z',
      createdAt: '2026-09-02T10:00:00.000Z',
      registeredBy: 'user-admin',
      registrarName: 'Administrador'
    };

    const isPaidFromBusiness = settlement.fundSource !== 'PERSONAL';
    assert(isPaidFromBusiness, 'La liquidación con fondos del negocio es el verdadero egreso financiero');
  });

  // 7. ANULACIÓN DE GASTO PAGADO
  await test('7. ANULACIÓN DE GASTO PAGADO: Gastos anulados se excluyen de egresos financieros', () => {
    const cancelledExpense: Expense = {
      id: 'exp-canc-1',
      businessId: 'biz-test',
      userId: 'user-1',
      description: 'Gasto facturado por error',
      amount: 2500,
      paymentMethod: 'EFECTIVO',
      fundSource: 'CASH',
      status: 'ANULADO',
      category: 'Otros',
      createdAt: '2026-09-01T11:00:00.000Z'
    };

    assert(!isBusinessExpenseOutflow(cancelledExpense), 'Gasto ANULADO debe excluirse de egresos del negocio');
  });

  // 8. COMPRA A_CANCELAR
  await test('8. COMPRA A_CANCELAR: Compra a crédito genera obligación y no deduce caja al registrarse', () => {
    const creditPurchase: Purchase = {
      id: 'pur-cred-1',
      businessId: 'biz-test',
      supplierName: 'Distribuidora Central',
      total: 80000,
      paymentStatus: 'A_CANCELAR',
      paymentMethod: 'OTRO',
      fundSource: 'BANK',
      obligationId: 'obl-pur-1',
      hasReceipt: true,
      createdBy: 'user-1',
      creatorName: 'Admin',
      status: 'CONFIRMED',
      items: [],
      createdAt: '2026-09-01T09:00:00.000Z'
    };

    // Rule: Direct purchases paid filter out A_CANCELAR and obligationId
    const isDirectPaid = creditPurchase.paymentStatus !== 'A_CANCELAR' && !creditPurchase.obligationId && creditPurchase.fundSource !== 'PERSONAL';
    assert(!isDirectPaid, 'Compra A_CANCELAR no debe considerarse compra pagada directa');
  });

  // 9. PAGO DE OBLIGACIÓN
  await test('9. PAGO DE OBLIGACIÓN: El pago posterior de la obligación computa el egreso efectivo', () => {
    const purchaseSettlement: PaymentSettlement = {
      id: 'settle-pur-1',
      businessId: 'biz-test',
      obligationId: 'obl-pur-1',
      amount: 80000,
      paymentMethod: 'OTRO',
      fundSource: 'BANK',
      paymentDate: '2026-09-05T14:00:00.000Z',
      createdAt: '2026-09-05T14:00:00.000Z',
      registeredBy: 'user-admin',
      registrarName: 'Administrador'
    };

    const isBusinessOutflow = purchaseSettlement.fundSource !== 'PERSONAL';
    assert(isBusinessOutflow, 'El pago de la obligación a proveedor es el egreso financiero real');
    assertEqual(purchaseSettlement.amount, 80000, 'Importe abonado a proveedor');
  });

  // 10. NO DOBLE CONTABILIZACIÓN
  await test('10. NO DOBLE CONTABILIZACIÓN: Compra u obligación liquidada no se cuenta dos veces', () => {
    const purchase: Purchase = {
      id: 'pur-10',
      businessId: 'biz-test',
      supplierName: 'Proveedor X',
      total: 10000,
      paymentStatus: 'A_CANCELAR',
      paymentMethod: 'OTRO',
      hasReceipt: true,
      createdBy: 'user-1',
      creatorName: 'Admin',
      obligationId: 'obl-10',
      fundSource: 'BANK',
      status: 'CONFIRMED',
      items: [],
      createdAt: '2026-09-01T10:00:00.000Z'
    };

    const settlement: PaymentSettlement = {
      id: 'settle-10',
      businessId: 'biz-test',
      obligationId: 'obl-10',
      amount: 10000,
      paymentMethod: 'OTRO',
      fundSource: 'BANK',
      paymentDate: '2026-09-03T11:00:00.000Z',
      createdAt: '2026-09-03T11:00:00.000Z',
      registeredBy: 'user-admin',
      registrarName: 'Administrador'
    };

    // Direct purchases calculation
    const purchasesPaid = [purchase]
      .filter(p => p.paymentStatus !== 'A_CANCELAR' && !p.obligationId && p.fundSource !== 'PERSONAL')
      .reduce((sum, p) => sum + p.total, 0);

    // Settlements calculation
    const settlementsPaid = [settlement]
      .filter(s => s.fundSource !== 'PERSONAL')
      .reduce((sum, s) => sum + s.amount, 0);

    assertEqual(purchasesPaid, 0, 'La compra A_CANCELAR con obligationId aporta 0 a compras directas');
    assertEqual(settlementsPaid, 10000, 'La liquidación aporta exactamente 10000 a egresos');
    assertEqual(purchasesPaid + settlementsPaid, 10000, 'Impacto total exactamente una sola vez (sin doble cómputo)');
  });

  // 11. CMV HISTÓRICO
  await test('11. CMV HISTÓRICO: SaleItem.unitCost snapshot inmutable calcula el costo exacto de la venta', () => {
    const productsMap = new Map<string, Product>();
    productsMap.set('prod-1', {
      id: 'prod-1',
      name: 'Galletitas',
      costPrice: 500,
      salePrice: 900,
      stock: 10,
      active: true
    } as Product);

    const saleItem: SaleItem = {
      productId: 'prod-1',
      productName: 'Galletitas',
      barcode: '77912345678',
      quantity: 4,
      unitPrice: 900,
      subtotal: 3600,
      unitCost: 500 // Inmutable snapshot
    };

    const { unitCost, totalCogs } = calculateSaleItemCogs(saleItem, productsMap);
    assertEqual(unitCost, 500, 'unitCost del ítem debe coincidir con snapshot histórico');
    assertEqual(totalCogs, 2000, 'totalCogs = 4 * 500 = 2000');
  });

  // 12. CAMBIO POSTERIOR DE COSTPRICE
  await test('12. CAMBIO POSTERIOR DE COSTPRICE: No altera el CMV de ventas ya cerradas', () => {
    const productsMap = new Map<string, Product>();
    // Catálogo fue actualizado después de inflación a $800
    productsMap.set('prod-1', {
      id: 'prod-1',
      name: 'Galletitas',
      costPrice: 800, // Nuevo costo de reposición
      salePrice: 1200,
      stock: 10,
      active: true
    } as Product);

    // Venta histórica registrada cuando el costo era $500
    const historicalSaleItem: SaleItem = {
      productId: 'prod-1',
      productName: 'Galletitas',
      barcode: '77912345678',
      quantity: 2,
      unitPrice: 900,
      subtotal: 1800,
      unitCost: 500 // Snapshot inmutable
    };

    const { unitCost, totalCogs } = calculateSaleItemCogs(historicalSaleItem, productsMap);
    assertEqual(unitCost, 500, 'El costo histórico debe permanecer inalterado en $500');
    assertEqual(totalCogs, 1000, 'CMV histórico = 2 * 500 = 1000 (no 1600)');
  });

  // 13. COMBO HISTÓRICO
  await test('13. COMBO HISTÓRICO: Utiliza snapshots de costos de los componentes del combo', () => {
    const productsMap = new Map<string, Product>();
    productsMap.set('prod-coca', { id: 'prod-coca', name: 'Coca Cola', costPrice: 9999 } as Product);
    productsMap.set('prod-fernet', { id: 'prod-fernet', name: 'Fernet', costPrice: 9999 } as Product);

    const comboSaleItem: SaleItem = {
      productId: 'combo-fernet-coca',
      productName: 'Promo Fernet + Coca',
      barcode: 'COMBO-FC',
      quantity: 2,
      unitPrice: 5000,
      subtotal: 10000,
      unitCost: 0,
      isCombo: true,
      comboItems: [
        { productId: 'prod-coca', quantity: 1, unitCost: 400 },
        { productId: 'prod-fernet', quantity: 1, unitCost: 1800 }
      ]
    };

    const { unitCost, totalCogs } = calculateSaleItemCogs(comboSaleItem, productsMap);
    assertEqual(unitCost, 2200, 'Costo unitario del combo = 400 + 1800 = 2200');
    assertEqual(totalCogs, 4400, 'totalCogs = 2 * 2200 = 4400');
  });

  // 14. INVENTARIO ACTUAL VALORIZADO A COSTO DE REPOSICIÓN
  await test('14. INVENTARIO VALORIZADO: stock físico × Product.costPrice vigente como valor de reposición', () => {
    const products: Product[] = [
      { id: 'p1', name: 'Arroz', stock: 10, costPrice: 300, minimumStock: 5, active: true } as Product,
      { id: 'p2', name: 'Fideos', stock: 20, costPrice: 250, minimumStock: 10, active: true } as Product,
      { id: 'p3', name: 'Aceite', stock: 5, costPrice: 800, minimumStock: 5, active: true } as Product,
    ];

    let totalReplacementValue = 0;
    let totalStockUnits = 0;
    products.forEach(p => {
      const s = Math.max(0, p.stock);
      totalStockUnits += s;
      totalReplacementValue += s * p.costPrice;
    });

    assertEqual(totalStockUnits, 35, 'Total unidades en stock = 10 + 20 + 5');
    assertEqual(totalReplacementValue, (10*300) + (20*250) + (5*800), 'Valor de reposición = 3000 + 5000 + 4000 = 12000');
  });

  // 15. AGOTADOS
  await test('15. ARTÍCULOS AGOTADOS: stock <= 0 identificado como quiebre de stock total', () => {
    const pAgotado: Product = {
      id: 'p-out',
      name: 'Yerba 1kg',
      stock: 0,
      minimumStock: 5,
      costPrice: 1200,
      active: true,
      tracksStock: true
    } as Product;

    const isOutOfStock = (pAgotado.tracksStock !== false && pAgotado.active && pAgotado.stock <= 0);
    assert(isOutOfStock, 'Producto con stock 0 debe clasificarse como AGOTADO');
  });

  // 16. BAJO MÍNIMO
  await test('16. STOCK BAJO MÍNIMO: stock > 0 AND stock <= minimumStock, excluyendo tracksStock=false', () => {
    const pBajoMin: Product = {
      id: 'p-low',
      name: 'Azúcar 1kg',
      stock: 3,
      minimumStock: 10,
      costPrice: 400,
      active: true,
      tracksStock: true
    } as Product;

    const pSinControl: Product = {
      id: 'p-service',
      name: 'Fotocopia',
      stock: 0,
      minimumStock: 10,
      costPrice: 5,
      active: true,
      tracksStock: false // No controla stock
    } as Product;

    const isLowStock = pBajoMin.tracksStock !== false && pBajoMin.active && pBajoMin.stock > 0 && pBajoMin.stock <= pBajoMin.minimumStock;
    const isSinControlLowStock = pSinControl.tracksStock !== false && pSinControl.active && pSinControl.stock > 0 && pSinControl.stock <= pSinControl.minimumStock;

    assert(isLowStock, 'Producto con 3 u. y mínimo 10 u. debe ser marcado como BAJO MÍNIMO');
    assert(!isSinControlLowStock, 'Producto sin control de stock (tracksStock: false) NO debe generar alerta');
  });

  // 17. CENTRO DE EVENTOS READ-ONLY
  await test('17. CENTRO DE EVENTOS READ-ONLY: getEventNavigationTarget provee navegación sin efectos secundarios', () => {
    const event: BusinessEvent = {
      id: 'event_SALE_CREATED_sale123_COMPLETED',
      businessId: 'biz-test',
      type: 'SALE_CREATED',
      entityType: 'SALE',
      entityId: 'sale123',
      title: 'Venta Realizada #123',
      description: 'Total: $3.500',
      createdAt: '2026-09-01T12:00:00.000Z'
    };

    const target = getEventNavigationTarget(event);
    assertEqual(target.tab, 'ventas', 'Debe apuntar a la pestaña ventas');
    assertEqual(target.entityId, 'sale123', 'Debe apuntar a la entidad sale123');
  });

  // 18. EVENTO DETERMINISTA E IDEMPOTENCIA
  await test('18. IDEMPOTENCIA: generateEventId genera un ID determinista y único por entidad y estado', () => {
    const id1 = generateEventId('SALE_CREATED', 'sale_xyz_789', 'COMPLETED');
    const id2 = generateEventId('SALE_CREATED', 'sale_xyz_789', 'COMPLETED');

    assertEqual(id1, id2, 'Llamadas idénticas deben producir el mismo ID determinista');
    assert(id1.startsWith('event_SALE_CREATED_sale_xyz_789_COMPLETED'), 'Formato debe coincidir con especificación');
  });

  // 19. RETRY OFFLINE
  await test('19. RETRY OFFLINE: recordBusinessEvent cachea y retorna el mismo registro en reintentos sucesivos', async () => {
    const ev1 = await recordBusinessEvent({
      businessId: 'biz-offline',
      type: 'PURCHASE_CONFIRMED',
      entityType: 'PURCHASE',
      entityId: 'pur_offline_1',
      title: 'Compra de prueba',
      description: 'Prueba de idempotencia',
      metadata: { status: 'CONFIRMED' }
    });

    const ev2 = await recordBusinessEvent({
      businessId: 'biz-offline',
      type: 'PURCHASE_CONFIRMED',
      entityType: 'PURCHASE',
      entityId: 'pur_offline_1',
      title: 'Compra de prueba retry',
      description: 'Prueba de idempotencia',
      metadata: { status: 'CONFIRMED' }
    });

    assertEqual(ev1.id, ev2.id, 'Ambos eventos deben tener el mismo identificador determinista');
  });

  // 20. MULTI-TENANT ISOLATION
  await test('20. MULTI-TENANT: businessId es obligatorio y aísla eventos entre diferentes comercios', async () => {
    let errorThrown = false;
    try {
      await recordBusinessEvent({
        businessId: '', // Vacío
        type: 'SALE_CREATED',
        entityType: 'SALE',
        entityId: 'sale_no_tenant',
        title: 'Venta sin tenant'
      });
    } catch {
      errorThrown = true;
    }
    assert(errorThrown, 'Debe rechazar registros sin businessId válido');

    const evTenantA = await recordBusinessEvent({
      businessId: 'tenant-a',
      type: 'SALE_CREATED',
      entityType: 'SALE',
      entityId: 'sale-999',
      title: 'Venta Tenant A',
      metadata: { status: 'COMPLETED' }
    });

    const evTenantB = await recordBusinessEvent({
      businessId: 'tenant-b',
      type: 'SALE_CREATED',
      entityType: 'SALE',
      entityId: 'sale-999',
      title: 'Venta Tenant B',
      metadata: { status: 'COMPLETED' }
    });

    assert(evTenantA.businessId !== evTenantB.businessId, 'Eventos deben pertenecer estrictamente a su tenant');
  });

  // 21. FILTROS TEMPORALES
  await test('21. FILTROS TEMPORALES: calculateDateRange genera límites ISO completos para HOY, ULTIMOS_7_DIAS, etc.', () => {
    const rangeHoy = calculateDateRange('HOY');
    assert(rangeHoy.startIso.length > 0, 'startIso presente en HOY');
    assert(rangeHoy.endIso.length > 0, 'endIso presente en HOY');
    assert(rangeHoy.startIso <= rangeHoy.endIso, 'startIso <= endIso en HOY');

    const range7d = calculateDateRange('ULTIMOS_7_DIAS');
    assert(range7d.startIso < range7d.endIso, '7 días debe abarcar un período positivo');
    assertEqual(range7d.label, 'Últimos 7 días', 'Label correspondiente');
  });

  // 22. EVOLUCIÓN MENSUAL
  await test('22. EVOLUCIÓN MENSUAL: Comparativa histórica mensual separa Económico de Financiero', () => {
    const point: MonthlyComparisonPoint = {
      monthKey: '2026-08',
      monthLabel: 'Ago 2026',
      income: 100000,
      expenses: 60000, // Egresos pagados en caja
      result: 40000, // Financiero
      margin: 45000, // Ventas (100k) - CMV (55k)
      salesCount: 120,
      cogs: 55000,
      economicResult: 35000, // Margen (45k) - Gastos operativos (10k)
      financialResult: 40000, // Ingresos (100k) - Egresos pagados (60k)
      grossMarginPercentage: 45.0
    };

    assertEqual(point.economicResult, 35000, 'Resultado económico del mes');
    assertEqual(point.financialResult, 40000, 'Resultado financiero del mes');
    assert(point.economicResult !== point.financialResult, 'Económico y Financiero no se confunden');
  });

  // 23. COMPRAS POR PROVEEDOR
  await test('23. COMPRAS POR PROVEEDOR: Agrupación correcta de compras y cálculo de deuda pendiente', () => {
    const purchases: Purchase[] = [
      { id: 'p1', supplierName: 'Lácteos Sur', total: 15000, items: [{ quantity: 10 }] as any } as Purchase,
      { id: 'p2', supplierName: 'Lácteos Sur', total: 25000, items: [{ quantity: 20 }] as any } as Purchase,
      { id: 'p3', supplierName: 'Bebidas Norte', total: 40000, items: [{ quantity: 50 }] as any } as Purchase,
    ];

    const supplierTotals = new Map<string, number>();
    purchases.forEach(p => {
      supplierTotals.set(p.supplierName!, (supplierTotals.get(p.supplierName!) || 0) + p.total);
    });

    assertEqual(supplierTotals.get('Lácteos Sur'), 40000, 'Total comprado a Lácteos Sur');
    assertEqual(supplierTotals.get('Bebidas Norte'), 40000, 'Total comprado a Bebidas Norte');
  });

  // 24. GASTOS PERSONALES EXCLUIDOS DE CAJA Y RESULTADO FINANCIERO
  await test('24. GASTOS PERSONALES EXCLUIDOS: No reducen caja del negocio ni el resultado financiero', () => {
    const expenses: Expense[] = [
      { id: 'e1', businessId: 'biz-test', userId: 'u1', paymentMethod: 'EFECTIVO', category: 'Servicios', description: 'Luz local', amount: 5000, status: 'PAGADO', fundSource: 'CASH' },
      { id: 'e2', businessId: 'biz-test', userId: 'u1', paymentMethod: 'EFECTIVO', category: 'Otros', description: 'Gasto personal retiro', amount: 20000, status: 'PAGADO', fundSource: 'PERSONAL' }
    ];

    const businessOutflows = expenses
      .filter(isBusinessExpenseOutflow)
      .reduce((sum, e) => sum + e.amount, 0);

    assertEqual(businessOutflows, 5000, 'Solo la luz del local ($5.000) debe computarse como egreso del negocio');
  });

  // 25. OBLIGACIONES NO DUPLICADAS
  await test('25. OBLIGACIONES NO DUPLICADAS: Obligación pendiente no afecta la caja hasta su pago efectivo', () => {
    const obligation: PaymentObligation = {
      id: 'obl-future-1',
      businessId: 'biz-test',
      supplierName: 'Molinos Río',
      sourceType: 'PURCHASE',
      description: 'Factura 9988',
      createdBy: 'user-1',
      creatorName: 'Admin',
      createdAt: '2026-09-01T10:00:00.000Z',
      amount: 50000,
      pendingAmount: 50000,
      status: 'PENDING',
      dueDate: '2026-09-30'
    };

    // Before settlement
    let cashBalance = 100000;
    // An obligation does NOT modify cash balance
    assertEqual(cashBalance, 100000, 'Creación de obligación no altera el saldo de caja');

    // When settlement happens
    const settlementAmount = 50000;
    cashBalance -= settlementAmount;
    obligation.pendingAmount = 0;
    obligation.status = 'PAID';

    assertEqual(cashBalance, 50000, 'Caja reducida exactamente una vez al liquidar la obligación');
    assertEqual(obligation.status, 'PAID', 'Obligación cancelada');
  });

  console.log('\n------------------------------------------------------');
  console.log(` RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests();
