import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  RecurringExpenseTemplate, 
  RecurringExpenseStatus, 
  RecurringExpenseFrequency, 
  RecurringExpenseAmountType,
  ExpenseCategory,
  PurchasePaymentMethod,
  FundSource,
  UserProfile,
  PaymentObligation
} from '../types';
import { sanitizeString, sanitizeNumber } from './securityUtils';
import { createPaymentObligation, getPaymentObligationsByBusiness } from './obligationService';
import { createNotification } from './notificationService';

export interface CreateRecurringTemplateInput {
  businessId: string;
  name?: string;
  concept?: string;
  description?: string;
  category: ExpenseCategory | string;
  supplierName?: string;
  beneficiary?: string;
  amount: number;
  amountType?: RecurringExpenseAmountType;
  type?: RecurringExpenseAmountType;
  frequency?: RecurringExpenseFrequency;
  dueDay: number;
  startDate?: string;
  endDate?: string;
  usualPaymentMethod?: PurchasePaymentMethod;
  fundSource?: FundSource;
  notes?: string;
  createdBy: string;
  creatorName?: string;
}

/**
 * Fetches all recurring expense templates for a business.
 */
export async function getRecurringTemplates(businessId: string): Promise<RecurringExpenseTemplate[]> {
  const cleanBusinessId = sanitizeString(businessId, 64);
  if (!cleanBusinessId) return [];

  const ref = collection(db, 'recurring_expense_templates');
  const q = query(ref, where('businessId', '==', cleanBusinessId));
  const snap = await getDocs(q);

  const list: RecurringExpenseTemplate[] = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data();
    list.push({
      id: docSnap.id,
      name: data.name || data.concept || 'Gasto Recurrente',
      concept: data.concept || data.name || 'Gasto Recurrente',
      description: data.description || '',
      category: data.category || 'Servicios',
      supplierName: data.supplierName || data.beneficiary || 'Beneficiario',
      beneficiary: data.beneficiary || data.supplierName || 'Beneficiario',
      amount: Number(data.amount || 0),
      amountType: data.amountType || data.type || 'FIXED',
      type: data.type || data.amountType || 'FIXED',
      frequency: data.frequency || 'MONTHLY',
      dueDay: Number(data.dueDay || 1),
      startDate: data.startDate || undefined,
      endDate: data.endDate || undefined,
      usualPaymentMethod: data.usualPaymentMethod || 'EFECTIVO',
      fundSource: data.fundSource || 'CASH',
      status: data.status || 'ACTIVE',
      lastGeneratedPeriod: data.lastGeneratedPeriod || undefined,
      notes: data.notes || undefined,
      createdBy: data.createdBy || '',
      creatorName: data.creatorName || undefined,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || undefined,
      businessId: cleanBusinessId
    } as RecurringExpenseTemplate);
  });

  list.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === 'ACTIVE' ? -1 : 1;
    }
    return (a.dueDay || 1) - (b.dueDay || 1);
  });

  return list;
}

/**
 * Creates a new recurring expense template.
 */
export async function createRecurringTemplate(input: CreateRecurringTemplateInput): Promise<RecurringExpenseTemplate> {
  const cleanBusinessId = sanitizeString(input.businessId, 64);
  if (!cleanBusinessId) throw new Error('businessId es requerido');

  const title = (input.name || input.concept || '').trim();
  if (!title) throw new Error('El nombre o concepto de la plantilla es obligatorio');

  const supplier = (input.supplierName || input.beneficiary || '').trim();
  if (!supplier) throw new Error('El proveedor o beneficiario es obligatorio');

  const amountType: RecurringExpenseAmountType = input.amountType || input.type || 'FIXED';
  const rawAmount = Number(input.amount || 0);
  const amount = sanitizeNumber(rawAmount, 0, 999999999, 0);

  const now = new Date().toISOString();
  const templateRef = doc(collection(db, 'recurring_expense_templates'));
  const id = templateRef.id;

  const template: RecurringExpenseTemplate = {
    id,
    businessId: cleanBusinessId,
    name: title,
    concept: title,
    description: input.description?.trim() || undefined,
    category: input.category || 'Servicios',
    supplierName: supplier,
    beneficiary: supplier,
    amount,
    amountType,
    type: amountType,
    frequency: input.frequency || 'MONTHLY',
    dueDay: Math.min(31, Math.max(1, Number(input.dueDay) || 1)),
    startDate: input.startDate?.trim() || undefined,
    endDate: input.endDate?.trim() || undefined,
    usualPaymentMethod: input.usualPaymentMethod || 'EFECTIVO',
    fundSource: input.fundSource || 'CASH',
    status: 'ACTIVE',
    notes: input.notes?.trim() || undefined,
    createdBy: input.createdBy,
    creatorName: input.creatorName || undefined,
    createdAt: now,
    updatedAt: now
  };

  const payload: Record<string, any> = {};
  Object.entries(template).forEach(([k, v]) => {
    if (v !== undefined) payload[k] = v;
  });

  await setDoc(templateRef, payload);
  return template;
}

/**
 * Updates a recurring expense template.
 * CRITICAL: Modifications do NOT alter past historical payment obligations already created.
 */
export async function updateRecurringTemplate(
  templateId: string,
  updates: Partial<RecurringExpenseTemplate>
): Promise<void> {
  const templateRef = doc(db, 'recurring_expense_templates', templateId);
  const now = new Date().toISOString();

  const cleanUpdates: Record<string, any> = { updatedAt: now };

  if (updates.name !== undefined || updates.concept !== undefined) {
    const val = (updates.name || updates.concept || '').trim();
    cleanUpdates.name = val;
    cleanUpdates.concept = val;
  }
  if (updates.description !== undefined) cleanUpdates.description = updates.description.trim();
  if (updates.category !== undefined) cleanUpdates.category = updates.category;
  if (updates.supplierName !== undefined || updates.beneficiary !== undefined) {
    const val = (updates.supplierName || updates.beneficiary || '').trim();
    cleanUpdates.supplierName = val;
    cleanUpdates.beneficiary = val;
  }
  if (updates.amount !== undefined) {
    cleanUpdates.amount = sanitizeNumber(updates.amount, 0, 999999999, 0);
  }
  if (updates.amountType !== undefined || updates.type !== undefined) {
    const at = updates.amountType || updates.type || 'FIXED';
    cleanUpdates.amountType = at;
    cleanUpdates.type = at;
  }
  if (updates.frequency !== undefined) cleanUpdates.frequency = updates.frequency;
  if (updates.dueDay !== undefined) {
    cleanUpdates.dueDay = Math.min(31, Math.max(1, Number(updates.dueDay) || 1));
  }
  if (updates.startDate !== undefined) cleanUpdates.startDate = updates.startDate ? updates.startDate.trim() : null;
  if (updates.endDate !== undefined) cleanUpdates.endDate = updates.endDate ? updates.endDate.trim() : null;
  if (updates.usualPaymentMethod !== undefined) cleanUpdates.usualPaymentMethod = updates.usualPaymentMethod;
  if (updates.fundSource !== undefined) cleanUpdates.fundSource = updates.fundSource;
  if (updates.status !== undefined) cleanUpdates.status = updates.status;
  if (updates.notes !== undefined) cleanUpdates.notes = updates.notes?.trim() || '';

  await updateDoc(templateRef, cleanUpdates);
}

/**
 * Activates or deactivates a recurring template (Non-destructive).
 * Disabling a template stops future generation without modifying historical obligations.
 */
export async function toggleRecurringTemplateStatus(
  templateId: string,
  newStatus: RecurringExpenseStatus
): Promise<void> {
  const templateRef = doc(db, 'recurring_expense_templates', templateId);
  await updateDoc(templateRef, {
    status: newStatus,
    updatedAt: new Date().toISOString()
  });
}

/**
 * Checks all active templates and generates pending obligations for the specified or current period.
 * 
 * STRICT IDEMPOTENCY:
 * - Deterministic sourceId: `rec_${template.id}_${period}`
 * - Query check in payment_obligations to guarantee zero duplicates.
 * 
 * NO CASH MOVEMENT:
 * - Generated obligations are purely `status = 'PENDING'` and `pendingAmount = amount`.
 * - No cash_movement is created, preserving cash box integrity until actual settlement.
 */
export async function checkAndGenerateRecurringObligations(
  businessId: string,
  user: UserProfile,
  targetPeriod?: string,
  variableAmounts?: Record<string, number>
): Promise<number> {
  const cleanBusinessId = sanitizeString(businessId, 64);
  if (!cleanBusinessId) return 0;

  try {
    const templates = await getRecurringTemplates(cleanBusinessId);
    const activeTemplates = templates.filter(t => t.status === 'ACTIVE');
    if (activeTemplates.length === 0) return 0;

    const today = new Date();
    const currentPeriod = targetPeriod || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    let generatedCount = 0;

    // Parse target period year & month for due date calculation and date constraints
    const [periodYearStr, periodMonthStr] = currentPeriod.split('-');
    const periodYear = Number(periodYearStr) || today.getFullYear();
    const periodMonth = (Number(periodMonthStr) || (today.getMonth() + 1)) - 1; // 0-indexed

    for (const template of activeTemplates) {
      // 1. Check startDate / endDate constraints if defined
      if (template.startDate) {
        const start = new Date(template.startDate);
        const periodStart = new Date(periodYear, periodMonth, 1);
        if (periodStart < start && `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}` > currentPeriod) {
          continue; // Period is before template start
        }
      }
      if (template.endDate) {
        const end = new Date(template.endDate);
        const periodEnd = new Date(periodYear, periodMonth, 28);
        if (periodEnd > end && `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}` < currentPeriod) {
          continue; // Period is after template end
        }
      }

      const deterministicSourceId = `rec_${template.id}_${currentPeriod}`;

      // 2. IDEMPOTENCY CHECK: Check if an obligation already exists for this template & period
      const existingQuery = query(
        collection(db, 'payment_obligations'),
        where('businessId', '==', cleanBusinessId),
        where('sourceType', '==', 'RECURRING_EXPENSE'),
        where('sourceId', '==', deterministicSourceId)
      );
      const existingSnap = await getDocs(existingQuery);

      if (!existingSnap.empty) {
        // Already generated, sync template lastGeneratedPeriod if needed
        if (template.lastGeneratedPeriod !== currentPeriod) {
          await updateDoc(doc(db, 'recurring_expense_templates', template.id), {
            lastGeneratedPeriod: currentPeriod,
            updatedAt: new Date().toISOString()
          });
        }
        continue;
      }

      // 3. Compute final amount (support variable amount override if provided)
      let finalAmount = template.amount;
      if (template.amountType === 'VARIABLE' && variableAmounts && variableAmounts[template.id] !== undefined) {
        finalAmount = sanitizeNumber(variableAmounts[template.id], 0, 999999999, template.amount);
      }

      // 4. Calculate exact due date (e.g. 2026-08-05)
      const lastDayOfMonth = new Date(periodYear, periodMonth + 1, 0).getDate();
      const targetDay = Math.min(Math.max(1, template.dueDay || 1), lastDayOfMonth);
      const dueDateObj = new Date(periodYear, periodMonth, targetDay);
      const dueDateIso = `${dueDateObj.getFullYear()}-${String(dueDateObj.getMonth() + 1).padStart(2, '0')}-${String(dueDateObj.getDate()).padStart(2, '0')}`;

      const title = template.name || template.concept || 'Gasto Recurrente';
      const supplier = template.supplierName || template.beneficiary || 'Beneficiario';

      // 5. Create Payment Obligation in PENDING status (NO cash_movement!)
      const obl = await createPaymentObligation({
        businessId: cleanBusinessId,
        sourceType: 'RECURRING_EXPENSE',
        sourceId: deterministicSourceId,
        sourceCode: `REC-${template.id.slice(0, 4).toUpperCase()}`,
        supplierName: supplier,
        beneficiary: supplier,
        category: template.category || 'Servicios',
        description: `${title} (${currentPeriod})`,
        amount: finalAmount,
        dueDate: dueDateIso,
        paymentMethod: template.usualPaymentMethod || 'EFECTIVO',
        fundSource: template.fundSource || 'CASH',
        notes: template.notes ? `Gasto recurrente: ${template.notes}` : `Gasto recurrente programado (${currentPeriod})`,
        createdBy: user.uid,
        creatorName: user.displayName || user.email || 'Sistema',
        notifyAdmin: false // Handled cleanly below with anti-spam eventId
      });

      // 6. Update template lastGeneratedPeriod
      await updateDoc(doc(db, 'recurring_expense_templates', template.id), {
        lastGeneratedPeriod: currentPeriod,
        updatedAt: new Date().toISOString()
      });

      generatedCount++;

      // 7. Dispatch info event notification with strict anti-spam / idempotency
      await createNotification({
        businessId: cleanBusinessId,
        targetRole: 'ADMIN',
        type: 'GASTO_RECURRENTE_GENERADO',
        title: `🟢 Obligación generada: ${title}`,
        message: `${supplier} — $${finalAmount.toLocaleString('es-AR')} (Vto: ${dueDateIso})`,
        eventId: `notif_rec_gen_${template.id}_${currentPeriod}`,
        linkTab: 'obligations',
        metadata: {
          templateId: template.id,
          obligationId: obl.id,
          period: currentPeriod,
          amount: finalAmount,
          supplierName: supplier
        }
      });
    }

    return generatedCount;
  } catch (e) {
    console.warn('[recurringExpenseService] Error generando obligaciones recurrentes:', e);
    return 0;
  }
}

/**
 * Checks all pending obligations and dispatches due date notifications to the Event Center.
 * 
 * - 🔴 ALTA PRIORIDAD: Obligación vencida (dueDate < hoy)
 * - 🟠 PRIORIDAD MEDIA: Próximo vencimiento (0 <= diffDays <= 3)
 * 
 * ANTI-SPAM IDEMPOTENCY:
 * - Uses structured `eventId` so running this check multiple times never produces duplicate events.
 */
export async function checkAndNotifyDueObligations(businessId: string): Promise<{ overdueCount: number; upcomingCount: number }> {
  const cleanBusinessId = sanitizeString(businessId, 64);
  if (!cleanBusinessId) return { overdueCount: 0, upcomingCount: 0 };

  try {
    const obligations = await getPaymentObligationsByBusiness(cleanBusinessId, { status: 'PENDING' });
    const pendingWithDue = obligations.filter(o => o.status === 'PENDING' && o.pendingAmount > 0 && o.dueDate);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let overdueCount = 0;
    let upcomingCount = 0;

    for (const obl of pendingWithDue) {
      if (!obl.dueDate) continue;

      const due = new Date(obl.dueDate + 'T00:00:00');
      const diffTime = due.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      const supplier = obl.supplierName || obl.beneficiary || 'Proveedor';
      const amountStr = `$${Number(obl.pendingAmount || obl.amount || 0).toLocaleString('es-AR')}`;

      if (diffDays < 0) {
        // 🔴 ALTA PRIORIDAD: VENCIDA
        overdueCount++;
        const daysPast = Math.abs(diffDays);
        await createNotification({
          businessId: cleanBusinessId,
          targetRole: 'ADMIN',
          type: 'OBLIGACION_VENCIDA',
          title: `🔴 PAGO VENCIDO: ${amountStr}`,
          message: `${supplier} — ${obl.description} (Venció hace ${daysPast} día${daysPast > 1 ? 's' : ''}, el ${obl.dueDate})`,
          eventId: `notif_due_overdue_${obl.id}_${obl.dueDate}`,
          linkTab: 'obligations',
          metadata: {
            obligationId: obl.id,
            supplierName: supplier,
            amount: obl.pendingAmount,
            dueDate: obl.dueDate,
            priority: 'HIGH'
          }
        });
      } else if (diffDays <= 3) {
        // 🟠 PRIORIDAD MEDIA: PRÓXIMO VENCIMIENTO (0 a 3 días)
        upcomingCount++;
        const isToday = diffDays === 0;
        const dueText = isToday ? 'Vence hoy' : `Vence en ${diffDays} día${diffDays > 1 ? 's' : ''}`;
        await createNotification({
          businessId: cleanBusinessId,
          targetRole: 'ADMIN',
          type: 'OBLIGACION_PROXIMO_VENCIMIENTO',
          title: isToday ? `🔴 VENCE HOY: ${amountStr}` : `🟠 PRÓXIMO VENCIMIENTO: ${amountStr}`,
          message: `${supplier} — ${obl.description} (${dueText}, fecha ${obl.dueDate})`,
          eventId: `notif_due_upcoming_${obl.id}_${obl.dueDate}_d${diffDays}`,
          linkTab: 'obligations',
          metadata: {
            obligationId: obl.id,
            supplierName: supplier,
            amount: obl.pendingAmount,
            dueDate: obl.dueDate,
            priority: 'MEDIUM'
          }
        });
      }
    }

    return { overdueCount, upcomingCount };
  } catch (e) {
    console.warn('[recurringExpenseService] Error notificando vencimientos de obligaciones:', e);
    return { overdueCount: 0, upcomingCount: 0 };
  }
}
