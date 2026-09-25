import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../lib/authContext';
import { 
  PaymentObligation, 
  PaymentSettlement, 
  FundSource, 
  PurchasePaymentMethod,
  PaymentObligationStatus,
  RecurringExpenseTemplate,
  RecurringExpenseAmountType,
  RecurringExpenseFrequency,
  RecurringExpenseStatus
} from '../types';
import { 
  getPaymentObligationsByBusiness, 
  getPaymentSettlementsByBusiness, 
  settlePaymentObligation, 
  createPaymentObligation,
  updatePaymentObligation,
  groupObligationsBySupplier
} from '../lib/obligationService';
import { 
  getRecurringTemplates,
  createRecurringTemplate,
  updateRecurringTemplate,
  toggleRecurringTemplateStatus,
  checkAndGenerateRecurringObligations,
  checkAndNotifyDueObligations
} from '../lib/recurringExpenseService';
import { getCashBalance } from '../lib/purchaseService';
import { 
  CreditCard, 
  PlusCircle, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  DollarSign, 
  Calendar, 
  FileText, 
  TrendingDown, 
  Filter, 
  Search, 
  RefreshCw, 
  ArrowUpRight, 
  Wallet, 
  Building2,
  ChevronRight,
  ChevronDown,
  Layers,
  AlertCircle,
  Eye,
  History,
  Edit,
  Tag,
  ShieldCheck,
  Receipt,
  Check,
  X,
  Info,
  RotateCcw,
  Power,
  Play,
  CheckSquare,
  CalendarRange,
  Sparkles
} from 'lucide-react';

export const ObligationManagement: React.FC = () => {
  const { userProfile, business } = useAuth();
  const [obligations, setObligations] = useState<PaymentObligation[]>([]);
  const [settlements, setSettlements] = useState<PaymentSettlement[]>([]);
  const [templates, setTemplates] = useState<RecurringExpenseTemplate[]>([]);
  const [cashBalance, setCashBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // View & Tabs
  const [viewMode, setViewMode] = useState<'grouped' | 'list' | 'recurring' | 'settlements'>('grouped');
  const [expandedSuppliers, setExpandedSuppliers] = useState<Record<string, boolean>>({});

  // Filters State
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'PENDING' | 'PAID'>('PENDING');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [dueFilter, setDueFilter] = useState<'ALL' | 'OVERDUE' | 'TODAY' | 'NEXT_3_DAYS' | 'NEXT_7_DAYS' | 'NO_DUE'>('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Settlement / Payment Modal
  const [selectedObligation, setSelectedObligation] = useState<PaymentObligation | null>(null);
  const [settlementAmount, setSettlementAmount] = useState<number>(0);
  const [settlementDate, setSettlementDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [settlementFundSource, setSettlementFundSource] = useState<FundSource>('CASH');
  const [settlementPaymentMethod, setSettlementPaymentMethod] = useState<PurchasePaymentMethod>('EFECTIVO');
  const [settlementReceiptNumber, setSettlementReceiptNumber] = useState('');
  const [settlementNotes, setSettlementNotes] = useState('');
  const [settling, setSettling] = useState(false);
  const [settleError, setSettleError] = useState<string | null>(null);

  // Trace / History Modal for an Obligation
  const [viewingTraceObligation, setViewingTraceObligation] = useState<PaymentObligation | null>(null);
  const [traceSettlements, setTraceSettlements] = useState<PaymentSettlement[]>([]);
  const [loadingTrace, setLoadingTrace] = useState(false);

  // Edit Obligation Modal
  const [editingObligation, setEditingObligation] = useState<PaymentObligation | null>(null);
  const [editDueDate, setEditDueDate] = useState('');
  const [editReceiptNumber, setEditReceiptNumber] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // New Manual Obligation Modal
  const [showNewModal, setShowNewModal] = useState(false);
  const [newBeneficiary, setNewBeneficiary] = useState('');
  const [newCategory, setNewCategory] = useState('Proveedores');
  const [newDescription, setNewDescription] = useState('');
  const [newAmount, setNewAmount] = useState<number>(0);
  const [newDueDate, setNewDueDate] = useState('');
  const [newReceiptNumber, setNewReceiptNumber] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Recurring Templates Modal State
  const [templateModalMode, setTemplateModalMode] = useState<'CREATE' | 'EDIT' | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<RecurringExpenseTemplate | null>(null);
  const [tplName, setTplName] = useState('');
  const [tplSupplier, setTplSupplier] = useState('');
  const [tplCategory, setTplCategory] = useState('Servicios');
  const [tplAmount, setTplAmount] = useState<number>(0);
  const [tplAmountType, setTplAmountType] = useState<RecurringExpenseAmountType>('FIXED');
  const [tplFrequency, setTplFrequency] = useState<RecurringExpenseFrequency>('MONTHLY');
  const [tplDueDay, setTplDueDay] = useState<number>(5);
  const [tplStartDate, setTplStartDate] = useState('');
  const [tplEndDate, setTplEndDate] = useState('');
  const [tplUsualMethod, setTplUsualMethod] = useState<PurchasePaymentMethod>('EFECTIVO');
  const [tplFundSource, setTplFundSource] = useState<FundSource>('CASH');
  const [tplNotes, setTplNotes] = useState('');
  const [tplSaving, setTplSaving] = useState(false);
  const [tplError, setTplError] = useState<string | null>(null);

  // Generate Current Period Modal
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const todayPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [targetGeneratePeriod, setTargetGeneratePeriod] = useState(todayPeriod);
  const [variableAmountsInput, setVariableAmountsInput] = useState<Record<string, number>>({});
  const [generating, setGenerating] = useState(false);
  const [generateFeedback, setGenerateFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const isAdmin = userProfile?.role === 'ADMIN' || userProfile?.role === 'SUPER_ADMIN';

  const loadData = async () => {
    if (!business?.id) return;
    setLoading(true);
    try {
      const [obList, setList, tplList, cash] = await Promise.all([
        getPaymentObligationsByBusiness(business.id),
        getPaymentSettlementsByBusiness(business.id),
        getRecurringTemplates(business.id),
        getCashBalance(business.id)
      ]);
      setObligations(obList);
      setSettlements(setList);
      setTemplates(tplList);
      setCashBalance(cash);
    } catch (err) {
      console.error('Error loading obligations, settlements and cash balance:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [business?.id]);

  // Handle Event Center / Notification Navigation
  useEffect(() => {
    const handleNavigate = (event: any) => {
      const detail = event.detail;
      if (!detail) return;
      if (detail.tab === 'recurring') {
        setViewMode('recurring');
      } else if (detail.tab === 'list') {
        setViewMode('list');
      }
      if (detail.supplierName) {
        setSelectedSupplier(detail.supplierName);
        setFilterStatus('PENDING');
      }
      if (detail.priority === 'HIGH') {
        setDueFilter('OVERDUE');
        setFilterStatus('PENDING');
      } else if (detail.priority === 'MEDIUM') {
        setDueFilter('NEXT_3_DAYS');
        setFilterStatus('PENDING');
      }
      if (detail.obligationId) {
        setSearchTerm(detail.obligationId);
      }
    };

    window.addEventListener('minimarket:navigate-obligations', handleNavigate);
    return () => {
      window.removeEventListener('minimarket:navigate-obligations', handleNavigate);
    };
  }, []);

  // Unique list of suppliers for filter dropdown
  const supplierList = useMemo(() => {
    const set = new Set<string>();
    obligations.forEach(o => {
      const name = (o.supplierName || o.beneficiary || '').trim();
      if (name) set.add(name);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [obligations]);

  // Helper for checking due date status
  const getDueStatus = (dueDateStr?: string) => {
    if (!dueDateStr) return { status: 'NO_DUE', label: 'Sin vencimiento', color: 'text-stone-400', badgeBg: 'bg-stone-100 text-stone-600' };
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const due = new Date(dueDateStr + (dueDateStr.length === 10 ? 'T00:00:00' : ''));
    due.setHours(0, 0, 0, 0);
    
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { 
        status: 'OVERDUE', 
        label: `Vencida (${Math.abs(diffDays)}d)`, 
        color: 'text-rose-600 font-bold', 
        badgeBg: 'bg-rose-100 text-rose-800 border-rose-200' 
      };
    }
    if (diffDays === 0) {
      return { 
        status: 'TODAY', 
        label: 'Vence hoy', 
        color: 'text-amber-600 font-bold', 
        badgeBg: 'bg-amber-100 text-amber-900 border-amber-300' 
      };
    }
    if (diffDays <= 3) {
      return { 
        status: 'NEXT_3_DAYS', 
        label: `Vence en ${diffDays}d`, 
        color: 'text-amber-600 font-semibold', 
        badgeBg: 'bg-amber-50 text-amber-800 border-amber-200' 
      };
    }
    if (diffDays <= 7) {
      return { 
        status: 'NEXT_7_DAYS', 
        label: `Vence en ${diffDays}d`, 
        color: 'text-blue-600 font-medium', 
        badgeBg: 'bg-blue-50 text-blue-800 border-blue-200' 
      };
    }
    return { 
      status: 'FUTURE', 
      label: new Date(dueDateStr + (dueDateStr.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('es-AR'), 
      color: 'text-stone-500', 
      badgeBg: 'bg-stone-50 text-stone-600 border-stone-200' 
    };
  };

  // Calculations for Summary Cards & Alerts
  const summary = useMemo(() => {
    const pending = obligations.filter(o => o.status === 'PENDING');
    const totalPending = pending.reduce((sum, o) => sum + (Number(o.pendingAmount ?? o.amount) || 0), 0);
    
    // Unique suppliers with pending obligations
    const pendingSuppliersSet = new Set<string>();
    let overdueCount = 0;
    let overdueAmount = 0;
    let dueSoonCount = 0;
    let dueSoonAmount = 0;

    pending.forEach(o => {
      const sup = (o.supplierName || o.beneficiary || 'Varios').trim();
      pendingSuppliersSet.add(sup);
      
      const dueInfo = getDueStatus(o.dueDate);
      const pendingVal = Number(o.pendingAmount ?? o.amount) || 0;
      if (dueInfo.status === 'OVERDUE') {
        overdueCount++;
        overdueAmount += pendingVal;
      } else if (dueInfo.status === 'TODAY' || dueInfo.status === 'NEXT_3_DAYS') {
        dueSoonCount++;
        dueSoonAmount += pendingVal;
      }
    });

    const paid = obligations.filter(o => o.status === 'PAID');
    const totalPaidHistorical = settlements.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    const activeTemplatesCount = templates.filter(t => t.status === 'ACTIVE').length;
    
    return {
      pendingCount: pending.length,
      totalPending,
      pendingSuppliersCount: pendingSuppliersSet.size,
      overdueCount,
      overdueAmount,
      dueSoonCount,
      dueSoonAmount,
      paidCount: paid.length,
      totalPaidHistorical,
      activeTemplatesCount
    };
  }, [obligations, settlements, templates]);

  // Filtered Obligations List
  const filteredObligations = useMemo(() => {
    return obligations.filter(o => {
      // Status Filter
      if (filterStatus !== 'ALL' && o.status !== filterStatus) return false;
      
      // Supplier Filter
      if (selectedSupplier !== 'ALL') {
        const sup = (o.supplierName || o.beneficiary || '').trim();
        if (sup !== selectedSupplier) return false;
      }

      // Category Filter
      if (categoryFilter !== 'ALL') {
        if (categoryFilter === 'Mercadería') {
          if (o.category !== 'Mercadería' && o.category !== 'Proveedores' && o.sourceType !== 'PURCHASE') return false;
        } else if (o.category !== categoryFilter) {
          return false;
        }
      }

      // Due Date Filter
      if (dueFilter !== 'ALL') {
        const dueInfo = getDueStatus(o.dueDate);
        if (dueFilter === 'OVERDUE' && dueInfo.status !== 'OVERDUE') return false;
        if (dueFilter === 'TODAY' && dueInfo.status !== 'TODAY') return false;
        if (dueFilter === 'NEXT_3_DAYS' && dueInfo.status !== 'TODAY' && dueInfo.status !== 'NEXT_3_DAYS') return false;
        if (dueFilter === 'NEXT_7_DAYS' && dueInfo.status !== 'TODAY' && dueInfo.status !== 'NEXT_3_DAYS' && dueInfo.status !== 'NEXT_7_DAYS') return false;
        if (dueFilter === 'NO_DUE' && dueInfo.status !== 'NO_DUE') return false;
      }

      // Date Range Filter (Created At)
      if (startDate) {
        const itemDate = o.createdAt ? o.createdAt.slice(0, 10) : '';
        if (itemDate < startDate) return false;
      }
      if (endDate) {
        const itemDate = o.createdAt ? o.createdAt.slice(0, 10) : '';
        if (itemDate > endDate) return false;
      }

      // Text Search Filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchesName = (o.beneficiary || '').toLowerCase().includes(term) || (o.supplierName || '').toLowerCase().includes(term);
        const matchesDesc = (o.description || '').toLowerCase().includes(term);
        const matchesCode = (o.sourceCode || '').toLowerCase().includes(term);
        const matchesReceipt = (o.receiptNumber || '').toLowerCase().includes(term);
        if (!matchesName && !matchesDesc && !matchesCode && !matchesReceipt) return false;
      }

      return true;
    });
  }, [obligations, filterStatus, selectedSupplier, categoryFilter, dueFilter, startDate, endDate, searchTerm]);

  // Grouped Supplier structure for "Proveedores a Cancelar"
  const supplierGroups = useMemo(() => {
    return groupObligationsBySupplier(filteredObligations);
  }, [filteredObligations]);

  // Expand / Collapse Supplier Rows
  const toggleSupplier = (supplierName: string) => {
    setExpandedSuppliers(prev => ({
      ...prev,
      [supplierName]: !prev[supplierName]
    }));
  };

  const expandAllSuppliers = () => {
    const all: Record<string, boolean> = {};
    supplierGroups.forEach(g => { all[g.supplierName] = true; });
    setExpandedSuppliers(all);
  };

  const collapseAllSuppliers = () => {
    setExpandedSuppliers({});
  };

  // Open Settlement Modal
  const handleOpenSettle = (ob: PaymentObligation) => {
    setSelectedObligation(ob);
    const maxPending = Number(ob.pendingAmount ?? ob.amount);
    setSettlementAmount(maxPending);
    setSettlementDate(new Date().toISOString().slice(0, 10));
    setSettlementFundSource('CASH');
    setSettlementPaymentMethod('EFECTIVO');
    setSettlementReceiptNumber('');
    setSettlementNotes('');
    setSettleError(null);
  };

  // Submit Settlement
  const handleConfirmSettle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedObligation || !business?.id || !userProfile?.uid) return;
    
    if (userProfile.role === 'SELLER') {
      setSettleError('Los vendedores no tienen autorización para cancelar deudas.');
      return;
    }

    if (settlementAmount <= 0) {
      setSettleError('El monto debe ser mayor a 0');
      return;
    }
    const maxPending = Number(selectedObligation.pendingAmount ?? selectedObligation.amount);
    if (settlementAmount > maxPending) {
      setSettleError(`El monto a abonar ($${settlementAmount.toLocaleString('es-AR')}) no puede superar el saldo pendiente ($${maxPending.toLocaleString('es-AR')})`);
      return;
    }

    // Cash balance verification for CASH payments
    if (settlementFundSource === 'CASH') {
      if (settlementAmount > cashBalance) {
        setSettleError(`Saldo en caja insuficiente ($${cashBalance.toLocaleString('es-AR')}). Ingrese dinero en caja o seleccione "Fondos Personales".`);
        return;
      }
    }

    setSettling(true);
    setSettleError(null);
    try {
      await settlePaymentObligation({
        obligationId: selectedObligation.id,
        amount: settlementAmount,
        paymentDate: settlementDate,
        paymentMethod: settlementPaymentMethod,
        fundSource: settlementFundSource,
        notes: [settlementReceiptNumber ? `Recibo: ${settlementReceiptNumber}` : '', settlementNotes].filter(Boolean).join(' • ') || undefined,
        user: userProfile
      });

      setSelectedObligation(null);
      await loadData();
    } catch (err: any) {
      console.error('Error settling obligation:', err);
      setSettleError(err.message || 'Error al procesar el pago. Intente nuevamente.');
    } finally {
      setSettling(false);
    }
  };

  // Open Trace Modal
  const handleOpenTrace = (ob: PaymentObligation) => {
    setViewingTraceObligation(ob);
    const related = settlements.filter(s => s.obligationId === ob.id);
    related.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    setTraceSettlements(related);
  };

  // Open Edit Modal
  const handleOpenEdit = (ob: PaymentObligation) => {
    setEditingObligation(ob);
    setEditDueDate(ob.dueDate || '');
    setEditReceiptNumber(ob.receiptNumber || '');
    setEditCategory(ob.category || 'Proveedores');
    setEditDescription(ob.description || '');
    setEditNotes(ob.notes || '');
    setEditError(null);
  };

  // Save Edit Obligation
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingObligation || !business?.id || !userProfile) return;
    
    setSavingEdit(true);
    setEditError(null);
    try {
      await updatePaymentObligation(editingObligation.id, {
        dueDate: editDueDate || undefined,
        receiptNumber: editReceiptNumber.trim() || undefined,
        category: editCategory,
        description: editDescription.trim(),
        notes: editNotes.trim() || undefined
      }, userProfile);
      setEditingObligation(null);
      await loadData();
    } catch (err: any) {
      console.error('Error updating obligation:', err);
      setEditError(err.message || 'Error al actualizar el comprobante');
    } finally {
      setSavingEdit(false);
    }
  };

  // Create Manual Obligation
  const handleCreateObligation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business?.id || !userProfile?.uid) return;

    if (!newBeneficiary.trim()) {
      setCreateError('El beneficiario o proveedor es obligatorio');
      return;
    }
    if (newAmount <= 0) {
      setCreateError('El monto debe ser mayor a 0');
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      await createPaymentObligation({
        businessId: business.id,
        sourceType: 'OPERATING_EXPENSE',
        sourceCode: `MAN-${Date.now().toString().slice(-4)}`,
        supplierName: newBeneficiary.trim(),
        beneficiary: newBeneficiary.trim(),
        category: newCategory,
        description: newDescription.trim() || `Compromiso de pago a ${newBeneficiary.trim()}`,
        amount: newAmount,
        dueDate: newDueDate || undefined,
        receiptNumber: newReceiptNumber.trim() || undefined,
        paymentMethod: 'EFECTIVO',
        fundSource: 'CASH',
        notes: 'Generado manualmente por Administración',
        createdBy: userProfile.uid,
        creatorName: userProfile.displayName || userProfile.email || 'Admin',
        notifyAdmin: false
      });

      setShowNewModal(false);
      setNewBeneficiary('');
      setNewDescription('');
      setNewAmount(0);
      setNewDueDate('');
      setNewReceiptNumber('');
      await loadData();
    } catch (err: any) {
      console.error('Error creating manual obligation:', err);
      setCreateError(err.message || 'Error al crear la obligación');
    } finally {
      setCreating(false);
    }
  };

  // Open Template Modal (CREATE or EDIT)
  const handleOpenCreateTemplate = () => {
    setEditingTemplate(null);
    setTemplateModalMode('CREATE');
    setTplName('');
    setTplSupplier('');
    setTplCategory('Servicios');
    setTplAmount(0);
    setTplAmountType('FIXED');
    setTplFrequency('MONTHLY');
    setTplDueDay(5);
    setTplStartDate('');
    setTplEndDate('');
    setTplUsualMethod('EFECTIVO');
    setTplFundSource('CASH');
    setTplNotes('');
    setTplError(null);
  };

  const handleOpenEditTemplate = (tpl: RecurringExpenseTemplate) => {
    setEditingTemplate(tpl);
    setTemplateModalMode('EDIT');
    setTplName(tpl.name || tpl.concept || '');
    setTplSupplier(tpl.supplierName || tpl.beneficiary || '');
    setTplCategory(tpl.category || 'Servicios');
    setTplAmount(tpl.amount || 0);
    setTplAmountType(tpl.amountType || tpl.type || 'FIXED');
    setTplFrequency(tpl.frequency || 'MONTHLY');
    setTplDueDay(tpl.dueDay || 5);
    setTplStartDate(tpl.startDate || '');
    setTplEndDate(tpl.endDate || '');
    setTplUsualMethod(tpl.usualPaymentMethod || 'EFECTIVO');
    setTplFundSource(tpl.fundSource || 'CASH');
    setTplNotes(tpl.notes || '');
    setTplError(null);
  };

  // Save Recurring Template (Create / Update)
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business?.id || !userProfile?.uid) return;

    if (!tplName.trim()) {
      setTplError('El nombre o concepto es obligatorio');
      return;
    }
    if (!tplSupplier.trim()) {
      setTplError('El proveedor o beneficiario es obligatorio');
      return;
    }
    if (tplAmountType === 'FIXED' && tplAmount <= 0) {
      setTplError('Para gastos fijos, el importe debe ser mayor a 0');
      return;
    }

    setTplSaving(true);
    setTplError(null);

    try {
      if (templateModalMode === 'CREATE') {
        await createRecurringTemplate({
          businessId: business.id,
          name: tplName.trim(),
          concept: tplName.trim(),
          supplierName: tplSupplier.trim(),
          beneficiary: tplSupplier.trim(),
          category: tplCategory,
          amount: tplAmount,
          amountType: tplAmountType,
          frequency: tplFrequency,
          dueDay: Number(tplDueDay) || 1,
          startDate: tplStartDate || undefined,
          endDate: tplEndDate || undefined,
          usualPaymentMethod: tplUsualMethod,
          fundSource: tplFundSource,
          notes: tplNotes.trim() || undefined,
          createdBy: userProfile.uid,
          creatorName: userProfile.displayName || userProfile.email || 'Admin'
        });
      } else if (templateModalMode === 'EDIT' && editingTemplate) {
        await updateRecurringTemplate(editingTemplate.id, {
          name: tplName.trim(),
          concept: tplName.trim(),
          supplierName: tplSupplier.trim(),
          beneficiary: tplSupplier.trim(),
          category: tplCategory,
          amount: tplAmount,
          amountType: tplAmountType,
          frequency: tplFrequency,
          dueDay: Number(tplDueDay) || 1,
          startDate: tplStartDate || undefined,
          endDate: tplEndDate || undefined,
          usualPaymentMethod: tplUsualMethod,
          fundSource: tplFundSource,
          notes: tplNotes.trim() || undefined
        });
      }

      setTemplateModalMode(null);
      setEditingTemplate(null);
      await loadData();
    } catch (err: any) {
      console.error('Error saving recurring template:', err);
      setTplError(err.message || 'Error al guardar la plantilla');
    } finally {
      setTplSaving(false);
    }
  };

  // Toggle Template Status (Non-destructive)
  const handleToggleTemplateStatus = async (tpl: RecurringExpenseTemplate) => {
    const newStatus: RecurringExpenseStatus = tpl.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    try {
      await toggleRecurringTemplateStatus(tpl.id, newStatus);
      await loadData();
    } catch (err) {
      console.error('Error toggling template status:', err);
    }
  };

  // Open Generate Period Modal
  const handleOpenGenerateModal = () => {
    setTargetGeneratePeriod(todayPeriod);
    const initialVars: Record<string, number> = {};
    templates.filter(t => t.status === 'ACTIVE' && t.amountType === 'VARIABLE').forEach(t => {
      initialVars[t.id] = t.amount || 0;
    });
    setVariableAmountsInput(initialVars);
    setGenerateFeedback(null);
    setShowGenerateModal(true);
  };

  // Execute Generation
  const handleExecuteGeneration = async () => {
    if (!business?.id || !userProfile) return;
    setGenerating(true);
    setGenerateFeedback(null);

    try {
      const generatedCount = await checkAndGenerateRecurringObligations(
        business.id,
        userProfile,
        targetGeneratePeriod,
        variableAmountsInput
      );

      await checkAndNotifyDueObligations(business.id);
      await loadData();

      setGenerateFeedback({
        type: 'success',
        message: generatedCount > 0
          ? `¡Se generaron con éxito ${generatedCount} obligaciones pendientes para el período ${targetGeneratePeriod}! No se dedujo dinero de la caja.`
          : `El período ${targetGeneratePeriod} ya se encontraba al día o no requería nuevas obligaciones.`
      });

      setTimeout(() => {
        if (generatedCount > 0) {
          setShowGenerateModal(false);
          setViewMode('list');
        }
      }, 2000);
    } catch (err: any) {
      console.error('Error generating obligations:', err);
      setGenerateFeedback({
        type: 'error',
        message: err.message || 'Error al generar obligaciones del período'
      });
    } finally {
      setGenerating(false);
    }
  };

  const clearFilters = () => {
    setFilterStatus('PENDING');
    setSelectedSupplier('ALL');
    setCategoryFilter('ALL');
    setDueFilter('ALL');
    setStartDate('');
    setEndDate('');
    setSearchTerm('');
  };

  const hasActiveFilters = filterStatus !== 'ALL' || selectedSupplier !== 'ALL' || categoryFilter !== 'ALL' || dueFilter !== 'ALL' || startDate || endDate || searchTerm;

  return (
    <div className="space-y-4 pb-12">
      {/* Header Superior */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-stone-200 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-700">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-stone-900 tracking-tight">PROVEEDORES Y OBLIGACIONES</h1>
                <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                  Cuentas por Pagar
                </span>
              </div>
              <p className="text-xs text-stone-500 font-medium mt-0.5">
                Consolidación de compras diferidas, gastos recurrentes y cancelaciones
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Recargar datos"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>

          {isAdmin && (
            <>
              <button
                onClick={handleOpenGenerateModal}
                className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-stone-950 rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                title="Generar obligaciones de gastos recurrentes"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Generar Período</span>
              </button>

              <button
                onClick={() => setShowNewModal(true)}
                className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 text-amber-400" />
                <span>Nuevo Compromiso</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Alertas & Centro de Eventos */}
      {(summary.overdueCount > 0 || summary.dueSoonCount > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {summary.overdueCount > 0 && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 shadow-xs">
              <div className="p-2 bg-rose-100 rounded-lg text-rose-700 shrink-0 mt-0.5">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-rose-900 uppercase tracking-wider">🔴 Atención: Obligaciones Vencidas</h4>
                  <span className="text-xs font-black text-rose-700">${summary.overdueAmount.toLocaleString('es-AR')}</span>
                </div>
                <p className="text-xs text-rose-700 mt-0.5">
                  Hay <strong>{summary.overdueCount}</strong> comprobante(s) con fecha de vencimiento superada.
                </p>
                <button
                  onClick={() => { setViewMode('list'); setDueFilter('OVERDUE'); setFilterStatus('PENDING'); }}
                  className="mt-1.5 text-[11px] font-bold text-rose-800 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Ver comprobantes vencidos <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {summary.dueSoonCount > 0 && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 shadow-xs">
              <div className="p-2 bg-amber-100 rounded-lg text-amber-700 shrink-0 mt-0.5">
                <Clock className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-amber-900 uppercase tracking-wider">🟠 Próximos Vencimientos (3 días)</h4>
                  <span className="text-xs font-black text-amber-800">${summary.dueSoonAmount.toLocaleString('es-AR')}</span>
                </div>
                <p className="text-xs text-amber-700 mt-0.5">
                  <strong>{summary.dueSoonCount}</strong> comprobante(s) vencen hoy o en los próximos 3 días.
                </p>
                <button
                  onClick={() => { setViewMode('list'); setDueFilter('NEXT_3_DAYS'); setFilterStatus('PENDING'); }}
                  className="mt-1.5 text-[11px] font-bold text-amber-800 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  Ver próximos a vencer <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Resumen Superior — Cards Financieras */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Deuda Pendiente</span>
            <div className="p-1.5 bg-rose-50 rounded-lg text-rose-600">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-rose-600 tracking-tight">
              ${summary.totalPending.toLocaleString('es-AR')}
            </p>
            <p className="text-[11px] text-stone-500 font-medium mt-0.5">
              {summary.pendingCount} comprobantes por saldar
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Proveedores a Cancelar</span>
            <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-stone-900 tracking-tight">
              {summary.pendingSuppliersCount}
            </p>
            <p className="text-[11px] text-stone-500 font-medium mt-0.5">
              Proveedores con saldo exigible
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Deuda Vencida</span>
            <div className="p-1.5 bg-red-50 rounded-lg text-red-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-stone-900 tracking-tight">
              ${summary.overdueAmount.toLocaleString('es-AR')}
            </p>
            <p className="text-[11px] text-stone-500 font-medium mt-0.5">
              {summary.overdueCount} comprobantes vencidos
            </p>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Saldo de Caja Disponible</span>
            <div className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className={`text-2xl font-black tracking-tight ${cashBalance > 0 ? 'text-emerald-600' : 'text-stone-600'}`}>
              ${cashBalance.toLocaleString('es-AR')}
            </p>
            <p className="text-[11px] text-stone-500 font-medium mt-0.5">
              Efectivo disponible en caja chica
            </p>
          </div>
        </div>
      </div>

      {/* Tabs / Switcher de Vistas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setViewMode('grouped')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              viewMode === 'grouped'
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>🏢 Proveedores a Cancelar ({supplierGroups.length})</span>
          </button>

          <button
            onClick={() => setViewMode('list')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              viewMode === 'list'
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>📋 Comprobantes ({filteredObligations.length})</span>
          </button>

          <button
            onClick={() => setViewMode('recurring')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              viewMode === 'recurring'
                ? 'border-amber-600 text-amber-900 font-black'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <RotateCcw className="w-4 h-4 text-amber-600" />
            <span>🔄 Gastos Recurrentes ({templates.length})</span>
          </button>

          <button
            onClick={() => setViewMode('settlements')}
            className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              viewMode === 'settlements'
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>📜 Historial ({settlements.length})</span>
          </button>
        </div>

        {viewMode === 'grouped' && supplierGroups.length > 0 && (
          <div className="flex items-center gap-2 pb-2">
            <button
              onClick={expandAllSuppliers}
              className="text-[11px] font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-2.5 py-1 rounded transition-colors cursor-pointer"
            >
              Expandir todos
            </button>
            <button
              onClick={collapseAllSuppliers}
              className="text-[11px] font-semibold text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 px-2.5 py-1 rounded transition-colors cursor-pointer"
            >
              Colapsar todos
            </button>
          </div>
        )}
      </div>

      {/* VISTA 1 & 2: FILTROS (Solo en vista 'grouped' o 'list') */}
      {(viewMode === 'grouped' || viewMode === 'list') && (
        <div className="bg-white p-3.5 rounded-xl border border-stone-200 shadow-xs space-y-3">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5">
            {/* Search Box */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por proveedor, N° comprobante, remito, factura o detalle..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400 transition-all font-medium"
              />
            </div>

            {/* Status Buttons */}
            <div className="flex items-center bg-stone-100 p-0.5 rounded-lg text-xs font-semibold shrink-0">
              <button
                onClick={() => setFilterStatus('PENDING')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  filterStatus === 'PENDING' ? 'bg-white font-bold text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Pendientes
              </button>
              <button
                onClick={() => setFilterStatus('PAID')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  filterStatus === 'PAID' ? 'bg-white font-bold text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Cancelados
              </button>
              <button
                onClick={() => setFilterStatus('ALL')}
                className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                  filterStatus === 'ALL' ? 'bg-white font-bold text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Todos
              </button>
            </div>
          </div>

          {/* Selectores de Filtros Avanzados */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-stone-100 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Proveedor / Beneficiario</label>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full px-2 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 font-medium focus:bg-white focus:outline-none"
              >
                <option value="ALL">Todos ({supplierList.length})</option>
                {supplierList.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Categoría</label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-2 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 font-medium focus:bg-white focus:outline-none"
              >
                <option value="ALL">Todas las categorías</option>
                <option value="Mercadería">Mercadería / Compras</option>
                <option value="Servicios">Servicios</option>
                <option value="Alquiler">Alquiler</option>
                <option value="Sueldos">Sueldos</option>
                <option value="Impuestos">Impuestos</option>
                <option value="Mantenimiento">Mantenimiento</option>
                <option value="Otros">Otros</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Vencimiento</label>
              <select
                value={dueFilter}
                onChange={(e) => setDueFilter(e.target.value as any)}
                className="w-full px-2 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-stone-800 font-medium focus:bg-white focus:outline-none"
              >
                <option value="ALL">Cualquier fecha</option>
                <option value="OVERDUE">🔴 Vencidas</option>
                <option value="TODAY">🔴 Vence Hoy</option>
                <option value="NEXT_3_DAYS">🟠 Próximos 3 días</option>
                <option value="NEXT_7_DAYS">🔵 Próximos 7 días</option>
                <option value="NO_DUE">⚪ Sin fecha de vencimiento</option>
              </select>
            </div>

            <div className="flex items-end justify-between gap-1">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-stone-400 uppercase mb-1">Fecha Creación</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-2 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-[11px] focus:bg-white focus:outline-none"
                />
              </div>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="p-1.5 text-stone-400 hover:text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors cursor-pointer"
                  title="Limpiar filtros"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO PRINCIPAL SEGÚN VIEW MODE */}

      {/* 1. VISTA AGRUPADA POR PROVEEDOR (PROVEEDORES A CANCELAR) */}
      {viewMode === 'grouped' && (
        <div className="space-y-3">
          {supplierGroups.length === 0 ? (
            <div className="bg-white rounded-xl border border-stone-200 p-10 text-center text-stone-500 shadow-xs">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2.5" />
              <p className="text-base font-bold text-stone-800">¡Al día! No hay obligaciones pendientes</p>
              <p className="text-xs text-stone-400 mt-1">No se encontraron cuentas a cancelar con los filtros seleccionados</p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-3 text-xs font-bold text-stone-800 underline cursor-pointer"
                >
                  Restablecer filtros de búsqueda
                </button>
              )}
            </div>
          ) : (
            supplierGroups.map((group) => {
              const isExpanded = !!expandedSuppliers[group.supplierName];
              const overdueInGroup = group.obligations.filter(o => getDueStatus(o.dueDate).status === 'OVERDUE').length;
              const dueSoonInGroup = group.obligations.filter(o => {
                const s = getDueStatus(o.dueDate).status;
                return s === 'TODAY' || s === 'NEXT_3_DAYS';
              }).length;

              return (
                <div 
                  key={group.supplierName} 
                  className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden transition-all"
                >
                  {/* Supplier Card Header (Collapsible) */}
                  <div 
                    onClick={() => toggleSupplier(group.supplierName)}
                    className="p-4 bg-stone-50/70 hover:bg-stone-100/80 cursor-pointer flex items-center justify-between gap-3 border-b border-stone-200/80 select-none transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-stone-200/70 text-stone-700 rounded-xl">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-black text-stone-900">{group.supplierName}</h3>
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-stone-200 text-stone-700 rounded-full">
                            {group.count} {group.count === 1 ? 'comprobante' : 'comprobantes'}
                          </span>
                          {overdueInGroup > 0 && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-800 rounded-full border border-rose-200 flex items-center gap-1">
                              <AlertCircle className="w-2.5 h-2.5" />
                              {overdueInGroup} vencido{overdueInGroup > 1 ? 's' : ''}
                            </span>
                          )}
                          {dueSoonInGroup > 0 && overdueInGroup === 0 && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-full border border-amber-200 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {dueSoonInGroup} por vencer
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          Total original: ${group.totalOriginalAmount.toLocaleString('es-AR')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-[10px] uppercase font-bold text-stone-400">Total Pendiente</p>
                        <p className="text-lg font-black text-rose-600 tracking-tight">
                          ${group.totalPendingAmount.toLocaleString('es-AR')}
                        </p>
                      </div>

                      <div className="p-1.5 text-stone-400 bg-white rounded-lg border border-stone-200 shadow-2xs">
                        {isExpanded ? <ChevronDown className="w-4 h-4 text-stone-700" /> : <ChevronRight className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Vouchers List */}
                  {isExpanded && (
                    <div className="divide-y divide-stone-100 bg-white">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-stone-700">
                          <thead className="bg-stone-50/50 text-[10px] text-stone-500 uppercase tracking-wider font-bold border-b border-stone-100">
                            <tr>
                              <th className="px-4 py-2.5">Fecha</th>
                              <th className="px-3 py-2.5">Comprobante / N°</th>
                              <th className="px-3 py-2.5">Concepto / Categoría</th>
                              <th className="px-3 py-2.5">Imp. Original</th>
                              <th className="px-3 py-2.5">Imp. Pendiente</th>
                              <th className="px-3 py-2.5">Vencimiento</th>
                              <th className="px-3 py-2.5">Estado</th>
                              <th className="px-4 py-2.5 text-right">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-100">
                            {group.obligations.map((ob) => {
                              const dueInfo = getDueStatus(ob.dueDate);
                              const isPaid = ob.status === 'PAID';

                              return (
                                <tr key={ob.id} className="hover:bg-stone-50/80 transition-colors">
                                  <td className="px-4 py-2.5 whitespace-nowrap text-stone-500 font-mono text-[11px]">
                                    {ob.createdAt ? ob.createdAt.slice(0, 10) : 'S/D'}
                                  </td>
                                  <td className="px-3 py-2.5 whitespace-nowrap">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-stone-900 font-mono text-[11px]">
                                        {ob.receiptNumber ? `#${ob.receiptNumber}` : (ob.sourceCode || 'S/N')}
                                      </span>
                                      <span className="text-[10px] px-1.5 py-0.5 bg-stone-100 text-stone-600 rounded">
                                        {ob.sourceType === 'PURCHASE' ? 'COMPRA' : ob.sourceType === 'RECURRING_EXPENSE' ? 'RECURRENTE' : 'GASTO'}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5">
                                    <p className="font-semibold text-stone-800">{ob.description}</p>
                                    <p className="text-[10px] text-stone-400">{ob.category || 'Sin categoría'}</p>
                                  </td>
                                  <td className="px-3 py-2.5 whitespace-nowrap font-medium text-stone-600">
                                    ${(Number(ob.amount) || 0).toLocaleString('es-AR')}
                                  </td>
                                  <td className="px-3 py-2.5 whitespace-nowrap">
                                    <span className={`font-black ${isPaid ? 'text-stone-400 line-through' : 'text-rose-600'}`}>
                                      ${(Number(ob.pendingAmount ?? ob.amount) || 0).toLocaleString('es-AR')}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5 whitespace-nowrap">
                                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${dueInfo.badgeBg}`}>
                                      {dueInfo.label}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2.5 whitespace-nowrap">
                                    {isPaid ? (
                                      <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                                        Cancelado
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                                        Pendiente
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2.5 whitespace-nowrap text-right">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        onClick={() => handleOpenTrace(ob)}
                                        className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-colors cursor-pointer"
                                        title="Ver historial de pagos / trazabilidad"
                                      >
                                        <History className="w-3.5 h-3.5" />
                                      </button>

                                      {isAdmin && !isPaid && (
                                        <>
                                          <button
                                            onClick={() => handleOpenEdit(ob)}
                                            className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-colors cursor-pointer"
                                            title="Editar datos del comprobante"
                                          >
                                            <Edit className="w-3.5 h-3.5" />
                                          </button>

                                          <button
                                            onClick={() => handleOpenSettle(ob)}
                                            className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                                          >
                                            <DollarSign className="w-3.5 h-3.5" />
                                            <span>Abonar</span>
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 2. VISTA LISTADO DE COMPROBANTES */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
          {filteredObligations.length === 0 ? (
            <div className="p-12 text-center text-stone-500">
              <Layers className="w-10 h-10 text-stone-300 mx-auto mb-2" />
              <p className="text-base font-bold text-stone-800">No se encontraron comprobantes</p>
              <p className="text-xs text-stone-400 mt-1">Pruebe modificando los filtros de búsqueda</p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-3 text-xs font-bold text-stone-800 underline cursor-pointer"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-700">
                <thead className="bg-stone-50 text-[10px] text-stone-500 uppercase tracking-wider font-bold border-b border-stone-200">
                  <tr>
                    <th className="px-4 py-3">Fecha</th>
                    <th className="px-3 py-3">Proveedor / Beneficiario</th>
                    <th className="px-3 py-3">Comprobante #</th>
                    <th className="px-3 py-3">Detalle / Concepto</th>
                    <th className="px-3 py-3">Monto Original</th>
                    <th className="px-3 py-3">Saldo Pendiente</th>
                    <th className="px-3 py-3">Vencimiento</th>
                    <th className="px-3 py-3">Estado</th>
                    <th className="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filteredObligations.map((ob) => {
                    const dueInfo = getDueStatus(ob.dueDate);
                    const isPaid = ob.status === 'PAID';

                    return (
                      <tr key={ob.id} className="hover:bg-stone-50/80 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-stone-500 font-mono text-[11px]">
                          {ob.createdAt ? ob.createdAt.slice(0, 10) : 'S/D'}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <p className="font-bold text-stone-900">{ob.supplierName || ob.beneficiary}</p>
                          <span className="text-[10px] px-1.5 py-0.2 bg-stone-100 text-stone-600 rounded">
                            {ob.sourceType === 'PURCHASE' ? 'COMPRA' : ob.sourceType === 'RECURRING_EXPENSE' ? 'RECURRENTE' : 'GASTO'}
                          </span>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap font-mono font-bold text-stone-800 text-[11px]">
                          {ob.receiptNumber ? `#${ob.receiptNumber}` : (ob.sourceCode || 'S/N')}
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-semibold text-stone-800">{ob.description}</p>
                          <p className="text-[10px] text-stone-400">{ob.category || 'General'}</p>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap font-medium text-stone-600">
                          ${(Number(ob.amount) || 0).toLocaleString('es-AR')}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className={`font-black ${isPaid ? 'text-stone-400 line-through' : 'text-rose-600'}`}>
                            ${(Number(ob.pendingAmount ?? ob.amount) || 0).toLocaleString('es-AR')}
                          </span>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${dueInfo.badgeBg}`}>
                            {dueInfo.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {isPaid ? (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                              Cancelado
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded-full border border-amber-200">
                              Pendiente
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenTrace(ob)}
                              className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-colors cursor-pointer"
                              title="Trazabilidad"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>

                            {isAdmin && !isPaid && (
                              <>
                                <button
                                  onClick={() => handleOpenEdit(ob)}
                                  className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-colors cursor-pointer"
                                  title="Editar"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => handleOpenSettle(ob)}
                                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-2xs transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <DollarSign className="w-3.5 h-3.5" />
                                  <span>Abonar</span>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 3. VISTA GASTOS RECURRENTES / PLANTILLAS */}
      {viewMode === 'recurring' && (
        <div className="space-y-4">
          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-100 text-amber-800 rounded-lg shrink-0 mt-0.5">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-amber-950">Plantillas de Gastos Recurrentes</h3>
                <p className="text-xs text-amber-800 mt-0.5">
                  Permite programar alquileres, servicios, sueldos y abonos periódicos para generar automáticamente las obligaciones pendientes sin descontar caja chica hasta su efectivo pago.
                </p>
              </div>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleOpenCreateTemplate}
                  className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4 text-amber-400" />
                  <span>Nueva Plantilla</span>
                </button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
            {templates.length === 0 ? (
              <div className="p-12 text-center text-stone-500">
                <RotateCcw className="w-10 h-10 text-stone-300 mx-auto mb-2" />
                <p className="text-base font-bold text-stone-800">No hay plantillas de gastos recurrentes</p>
                <p className="text-xs text-stone-400 mt-1">Cree una plantilla para automatizar el registro de alquileres, servicios o sueldos</p>
                {isAdmin && (
                  <button
                    onClick={handleOpenCreateTemplate}
                    className="mt-4 px-4 py-2 bg-stone-900 text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Crear primera plantilla
                  </button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-stone-700">
                  <thead className="bg-stone-50 text-[10px] text-stone-500 uppercase tracking-wider font-bold border-b border-stone-200">
                    <tr>
                      <th className="px-4 py-3">Concepto / Nombre</th>
                      <th className="px-3 py-3">Beneficiario / Proveedor</th>
                      <th className="px-3 py-3">Categoría</th>
                      <th className="px-3 py-3">Importe</th>
                      <th className="px-3 py-3">Vencimiento / Frecuencia</th>
                      <th className="px-3 py-3">Último Período</th>
                      <th className="px-3 py-3">Estado</th>
                      <th className="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {templates.map((tpl) => {
                      const isActive = tpl.status === 'ACTIVE';

                      return (
                        <tr key={tpl.id} className={`hover:bg-stone-50/80 transition-colors ${!isActive ? 'opacity-60 bg-stone-50/40' : ''}`}>
                          <td className="px-4 py-3">
                            <p className="font-bold text-stone-900">{tpl.name || tpl.concept}</p>
                            {tpl.notes && <p className="text-[10px] text-stone-400">{tpl.notes}</p>}
                          </td>
                          <td className="px-3 py-3 font-semibold text-stone-800">
                            {tpl.supplierName || tpl.beneficiary}
                          </td>
                          <td className="px-3 py-3">
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-stone-100 text-stone-700 rounded-md">
                              {tpl.category}
                            </span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-stone-900">
                                ${(Number(tpl.amount) || 0).toLocaleString('es-AR')}
                              </span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                                tpl.amountType === 'VARIABLE' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                              }`}>
                                {tpl.amountType === 'VARIABLE' ? 'Variable' : 'Fijo'}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1 text-stone-700 font-medium">
                              <Calendar className="w-3.5 h-3.5 text-stone-400" />
                              <span>Día {tpl.dueDay || 1} ({tpl.frequency === 'MONTHLY' ? 'Mensual' : tpl.frequency})</span>
                            </div>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap font-mono text-[11px] text-stone-500">
                            {tpl.lastGeneratedPeriod ? (
                              <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-bold">
                                {tpl.lastGeneratedPeriod}
                              </span>
                            ) : (
                              <span className="text-stone-400 italic">No generado</span>
                            )}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            {isActive ? (
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                                Activo
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[10px] font-bold bg-stone-100 text-stone-500 rounded-full border border-stone-200">
                                Inactivo
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            {isAdmin && (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => handleToggleTemplateStatus(tpl)}
                                  className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                    isActive 
                                      ? 'bg-amber-50 hover:bg-amber-100 text-amber-700' 
                                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                                  }`}
                                  title={isActive ? 'Desactivar plantilla' : 'Activar plantilla'}
                                >
                                  <Power className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => handleOpenEditTemplate(tpl)}
                                  className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg transition-colors cursor-pointer"
                                  title="Editar plantilla"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. VISTA HISTORIAL DE CANCELACIONES */}
      {viewMode === 'settlements' && (
        <div className="bg-white rounded-xl border border-stone-200 shadow-xs overflow-hidden">
          {settlements.length === 0 ? (
            <div className="p-12 text-center text-stone-500">
              <History className="w-10 h-10 text-stone-300 mx-auto mb-2" />
              <p className="text-base font-bold text-stone-800">No hay cancelaciones registradas</p>
              <p className="text-xs text-stone-400 mt-1">Los pagos parciales o totales aparecerán en este historial</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-700">
                <thead className="bg-stone-50 text-[10px] text-stone-500 uppercase tracking-wider font-bold border-b border-stone-200">
                  <tr>
                    <th className="px-4 py-3">Fecha Pago</th>
                    <th className="px-3 py-3">Monto Abonado</th>
                    <th className="px-3 py-3">Origen de Fondos</th>
                    <th className="px-3 py-3">Medio de Pago</th>
                    <th className="px-3 py-3">Registrado Por</th>
                    <th className="px-3 py-3">Observaciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {settlements.map((s) => (
                    <tr key={s.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-stone-600 font-mono text-[11px]">
                        {s.paymentDate || (s.createdAt ? s.createdAt.slice(0, 10) : 'S/D')}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap font-black text-emerald-600">
                        ${(Number(s.amount) || 0).toLocaleString('es-AR')}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                          s.fundSource === 'CASH' 
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                            : 'bg-purple-100 text-purple-800 border border-purple-200'
                        }`}>
                          {s.fundSource === 'CASH' ? '💵 Caja Chica' : '👤 Fondos Propios'}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap font-semibold text-stone-800">
                        {s.paymentMethod || 'EFECTIVO'}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-stone-600">
                        {s.registrarName || 'Admin'}
                      </td>
                      <td className="px-3 py-3 text-stone-500">
                        {s.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: REGISTRAR CANCELACIÓN DE DEUDA */}
      {selectedObligation && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-sm">Registrar Cancelación de Deuda</h3>
                  <p className="text-[11px] text-stone-400">Comprobante #{selectedObligation.receiptNumber || selectedObligation.sourceCode || 'S/N'}</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedObligation(null)}
                className="text-stone-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmSettle} className="p-4 space-y-3.5">
              {/* Resumen Deuda */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-stone-500">Beneficiario / Proveedor:</span>
                  <strong className="text-stone-900 font-bold">{selectedObligation.supplierName || selectedObligation.beneficiary}</strong>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-stone-500">Monto total original:</span>
                  <span className="text-stone-700">${(Number(selectedObligation.amount) || 0).toLocaleString('es-AR')}</span>
                </div>
                <div className="flex justify-between items-center text-xs pt-1 border-t border-stone-200">
                  <span className="text-stone-600 font-semibold">Saldo pendiente a pagar:</span>
                  <strong className="text-rose-600 font-black text-sm">
                    ${(Number(selectedObligation.pendingAmount ?? selectedObligation.amount)).toLocaleString('es-AR')}
                  </strong>
                </div>
              </div>

              {settleError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{settleError}</span>
                </div>
              )}

              {/* Importe a Abonar */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-stone-700">Monto a Cancelar ($) *</label>
                  <span className="text-[10px] text-stone-400">Máx: ${(Number(selectedObligation.pendingAmount ?? selectedObligation.amount)).toLocaleString('es-AR')}</span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Number(selectedObligation.pendingAmount ?? selectedObligation.amount)}
                  value={settlementAmount || ''}
                  onChange={(e) => setSettlementAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg font-black text-stone-900 text-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
                {/* Botones Rápidos de Monto */}
                <div className="flex items-center gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setSettlementAmount(Number(selectedObligation.pendingAmount ?? selectedObligation.amount))}
                    className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded border border-emerald-200 cursor-pointer"
                  >
                    100% Saldo Total (${(Number(selectedObligation.pendingAmount ?? selectedObligation.amount)).toLocaleString('es-AR')})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettlementAmount(Math.round((Number(selectedObligation.pendingAmount ?? selectedObligation.amount) / 2) * 100) / 100)}
                    className="text-[11px] font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 px-2 py-0.5 rounded cursor-pointer"
                  >
                    50%
                  </button>
                </div>
              </div>

              {/* Origen de Fondos */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Origen de los Fondos *</label>
                <select
                  value={settlementFundSource}
                  onChange={(e) => setSettlementFundSource(e.target.value as FundSource)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-bold text-stone-800 focus:bg-white focus:outline-none"
                >
                  <option value="CASH">💵 Caja del Negocio (Registra Egreso en Caja actual)</option>
                  <option value="PERSONAL">👤 Fondos Personales / Propios (No altera la Caja actual)</option>
                </select>

                {/* Saldo de caja info */}
                {settlementFundSource === 'CASH' && (
                  <div className={`mt-1.5 p-2 rounded-lg text-[11px] flex items-center justify-between ${
                    cashBalance >= settlementAmount 
                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
                      : 'bg-red-50 border border-red-200 text-red-800'
                  }`}>
                    <span>Saldo en Caja Chica disponible: <strong>${cashBalance.toLocaleString('es-AR')}</strong></span>
                    {settlementAmount > cashBalance && (
                      <span className="font-bold text-red-600 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Insuficiente
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Fecha y Método de Pago */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Fecha de Cancelación</label>
                  <input
                    type="date"
                    value={settlementDate}
                    onChange={(e) => setSettlementDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-xs font-medium focus:bg-white focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Medio de Pago</label>
                  <select
                    value={settlementPaymentMethod}
                    onChange={(e) => setSettlementPaymentMethod(e.target.value as PurchasePaymentMethod)}
                    className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-xs text-stone-800 focus:bg-white focus:outline-none font-medium"
                  >
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="MERCADO_PAGO">Mercado Pago / Transferencia</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>
              </div>

              {/* Comprobante & Observación */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Recibo / Comprobante #</label>
                  <input
                    type="text"
                    placeholder="Ej. Recibo 0045"
                    value={settlementReceiptNumber}
                    onChange={(e) => setSettlementReceiptNumber(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-xs focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Observación</label>
                  <input
                    type="text"
                    placeholder="Detalle opcional..."
                    value={settlementNotes}
                    onChange={(e) => setSettlementNotes(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-xs focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* Botones */}
              <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setSelectedObligation(null)}
                  disabled={settling}
                  className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={settling || settlementAmount <= 0 || (settlementFundSource === 'CASH' && settlementAmount > cashBalance)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {settling ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Procesando Pago...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Confirmar Pago (${settlementAmount.toLocaleString('es-AR')})</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: TRAZABILIDAD Y DETALLE DE LA OBLIGACIÓN */}
      {viewingTraceObligation && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm">Trazabilidad de la Obligación</h3>
                  <p className="text-[11px] text-stone-400">ID: {viewingTraceObligation.id}</p>
                </div>
              </div>
              <button 
                onClick={() => setViewingTraceObligation(null)}
                className="text-stone-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Info General */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-stone-500">Proveedor / Beneficiario:</span>
                  <strong className="text-stone-900">{viewingTraceObligation.supplierName || viewingTraceObligation.beneficiary}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Concepto:</span>
                  <span className="text-stone-800 font-semibold">{viewingTraceObligation.description}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Tipo de Origen:</span>
                  <span className="px-2 py-0.5 bg-stone-200 text-stone-800 rounded font-bold text-[10px]">
                    {viewingTraceObligation.sourceType}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Fecha de Creación:</span>
                  <span className="font-mono text-stone-700">{viewingTraceObligation.createdAt}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Registrado por:</span>
                  <span className="text-stone-700">{viewingTraceObligation.creatorName || viewingTraceObligation.createdBy}</span>
                </div>
              </div>

              {/* Estado Financiero */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 bg-stone-100 rounded-xl">
                  <p className="text-[10px] uppercase font-bold text-stone-500">Monto Original</p>
                  <p className="text-lg font-black text-stone-900 mt-0.5">
                    ${(Number(viewingTraceObligation.amount) || 0).toLocaleString('es-AR')}
                  </p>
                </div>
                <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                  <p className="text-[10px] uppercase font-bold text-rose-500">Saldo Pendiente</p>
                  <p className="text-lg font-black text-rose-600 mt-0.5">
                    ${(Number(viewingTraceObligation.pendingAmount ?? viewingTraceObligation.amount)).toLocaleString('es-AR')}
                  </p>
                </div>
              </div>

              {/* Historial de Pagos / Cancelaciones */}
              <div>
                <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Receipt className="w-3.5 h-3.5 text-stone-500" />
                  <span>Historial de Pagos / Cancelaciones ({traceSettlements.length})</span>
                </h4>

                {traceSettlements.length === 0 ? (
                  <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl text-center text-xs text-stone-400 italic">
                    No se han registrado pagos parciales ni totales para este comprobante.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {traceSettlements.map((st, idx) => (
                      <div key={st.id} className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-emerald-900">
                            Pago #{idx + 1} — ${Number(st.amount).toLocaleString('es-AR')}
                          </span>
                          <span className="text-[10px] font-mono text-stone-500">
                            {st.paymentDate || st.createdAt.slice(0, 10)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-stone-600">
                          <span>{st.paymentMethod} • {st.fundSource === 'CASH' ? '💵 Caja' : '👤 Fondos Propios'}</span>
                          <span>Por: {st.registrarName}</span>
                        </div>
                        {st.notes && (
                          <p className="text-[11px] text-stone-500 italic mt-0.5">"{st.notes}"</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 bg-stone-50 border-t border-stone-200 flex justify-end">
              <button
                onClick={() => setViewingTraceObligation(null)}
                className="px-4 py-1.5 bg-stone-900 text-white rounded-lg text-xs font-bold cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: EDITAR OBLIGACIÓN */}
      {editingObligation && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">Editar Comprobante</h3>
              </div>
              <button 
                onClick={() => setEditingObligation(null)}
                className="text-stone-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-4 space-y-3.5">
              {editError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Concepto / Detalle</label>
                <input
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-semibold focus:bg-white focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Categoría</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-xs font-medium focus:bg-white focus:outline-none"
                  >
                    <option value="Proveedores">Proveedores</option>
                    <option value="Mercadería">Mercadería</option>
                    <option value="Servicios">Servicios</option>
                    <option value="Alquiler">Alquiler</option>
                    <option value="Sueldos">Sueldos</option>
                    <option value="Impuestos">Impuestos</option>
                    <option value="Mantenimiento">Mantenimiento</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Vencimiento</label>
                  <input
                    type="date"
                    value={editDueDate}
                    onChange={(e) => setEditDueDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-xs font-medium focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Factura / Remito #</label>
                <input
                  type="text"
                  value={editReceiptNumber}
                  onChange={(e) => setEditReceiptNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-mono focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Observaciones</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setEditingObligation(null)}
                  disabled={savingEdit}
                  className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer"
                >
                  {savingEdit ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: CREAR COMPROMISO MANUAL */}
      {showNewModal && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-md w-full overflow-hidden">
            <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-sm">Nuevo Compromiso de Pago Manual</h3>
              </div>
              <button 
                onClick={() => setShowNewModal(false)}
                className="text-stone-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateObligation} className="p-4 space-y-3.5">
              {createError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Beneficiario / Proveedor *</label>
                <input
                  type="text"
                  placeholder="Ej. Distribuidora Central, Edenor, Alquiler..."
                  value={newBeneficiary}
                  onChange={(e) => setNewBeneficiary(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-semibold focus:bg-white focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Categoría</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-xs font-medium focus:bg-white focus:outline-none"
                  >
                    <option value="Proveedores">Proveedores / Mercadería</option>
                    <option value="Servicios">Servicios</option>
                    <option value="Alquiler">Alquiler</option>
                    <option value="Sueldos">Sueldos</option>
                    <option value="Impuestos">Impuestos</option>
                    <option value="Mantenimiento">Mantenimiento</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Monto Total ($) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="0.00"
                    value={newAmount || ''}
                    onChange={(e) => setNewAmount(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-xs font-bold focus:bg-white focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">Descripción / Detalle</label>
                <input
                  type="text"
                  placeholder="Concepto del compromiso..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Fecha de Vencimiento</label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={(e) => setNewDueDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-xs focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Factura / Remito #</label>
                  <input
                    type="text"
                    placeholder="Opcional"
                    value={newReceiptNumber}
                    onChange={(e) => setNewReceiptNumber(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-xs focus:bg-white focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  disabled={creating}
                  className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating || newAmount <= 0}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1"
                >
                  {creating ? 'Guardando...' : 'Crear Obligación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: CREAR / EDITAR PLANTILLA DE GASTO RECURRENTE */}
      {templateModalMode && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-4 bg-stone-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm">
                    {templateModalMode === 'CREATE' ? 'Nueva Plantilla de Gasto Recurrente' : 'Editar Plantilla Recurrente'}
                  </h3>
                  <p className="text-[11px] text-stone-400">
                    {templateModalMode === 'CREATE' ? 'Automatización de compromisos periódicos' : `Editando plantilla: ${editingTemplate?.name || editingTemplate?.concept}`}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setTemplateModalMode(null)}
                className="text-stone-400 hover:text-white text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="p-4 space-y-3.5 max-h-[80vh] overflow-y-auto">
              {tplError && (
                <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{tplError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Nombre / Concepto *</label>
                  <input
                    type="text"
                    placeholder="Ej. Alquiler Local, Internet Fibertel..."
                    value={tplName}
                    onChange={(e) => setTplName(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-semibold focus:bg-white focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Beneficiario / Proveedor *</label>
                  <input
                    type="text"
                    placeholder="Ej. Inmobiliaria Central, Telecom..."
                    value={tplSupplier}
                    onChange={(e) => setTplSupplier(e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-semibold focus:bg-white focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Categoría</label>
                  <select
                    value={tplCategory}
                    onChange={(e) => setTplCategory(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-xs font-medium focus:bg-white focus:outline-none"
                  >
                    <option value="Alquiler">Alquiler</option>
                    <option value="Servicios">Servicios (Luz, Gas, Internet)</option>
                    <option value="Sueldos">Sueldos / Honorarios</option>
                    <option value="Impuestos">Impuestos / Tasas</option>
                    <option value="Mantenimiento">Mantenimiento</option>
                    <option value="Limpieza">Limpieza</option>
                    <option value="Otros">Otros</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Tipo de Importe</label>
                  <select
                    value={tplAmountType}
                    onChange={(e) => setTplAmountType(e.target.value as RecurringExpenseAmountType)}
                    className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-xs font-bold text-stone-800 focus:bg-white focus:outline-none"
                  >
                    <option value="FIXED">Fijo (Importe invariable)</option>
                    <option value="VARIABLE">Variable (Ajustable por período)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {tplAmountType === 'FIXED' ? 'Monto Fijo ($) *' : 'Monto Estimado ($)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={tplAmount || ''}
                    onChange={(e) => setTplAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-bold text-stone-900 focus:bg-white focus:outline-none"
                    required={tplAmountType === 'FIXED'}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">Día de Vencimiento (1-31)</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={tplDueDay}
                    onChange={(e) => setTplDueDay(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs font-bold text-stone-900 focus:bg-white focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Medio Habitual de Pago</label>
                  <select
                    value={tplUsualMethod}
                    onChange={(e) => setTplUsualMethod(e.target.value as PurchasePaymentMethod)}
                    className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-xs focus:bg-white focus:outline-none"
                  >
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="MERCADO_PAGO">Mercado Pago / Transferencia</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">Origen Habitual</label>
                  <select
                    value={tplFundSource}
                    onChange={(e) => setTplFundSource(e.target.value as FundSource)}
                    className="w-full px-2.5 py-1.5 bg-stone-50 border border-stone-300 rounded-lg text-xs focus:bg-white focus:outline-none"
                  >
                    <option value="CASH">💵 Caja Chica</option>
                    <option value="PERSONAL">👤 Fondos Propios</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">Notas / Observaciones</label>
                <input
                  type="text"
                  placeholder="Ej. Débito automático en cuenta bancaria, vence el 10..."
                  value={tplNotes}
                  onChange={(e) => setTplNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-300 rounded-lg text-xs focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setTemplateModalMode(null)}
                  disabled={tplSaving}
                  className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={tplSaving || !tplName.trim() || !tplSupplier.trim()}
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-lg text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1"
                >
                  {tplSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>{templateModalMode === 'CREATE' ? 'Crear Plantilla' : 'Guardar Cambios'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: GENERAR OBLIGACIONES DEL PERÍODO */}
      {showGenerateModal && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-stone-200 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-4 bg-amber-500 text-stone-950 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play className="w-5 h-5 fill-current text-stone-950" />
                <div>
                  <h3 className="font-black text-sm uppercase tracking-wide">Generar Obligaciones Recurrentes</h3>
                  <p className="text-[11px] text-stone-900 font-medium">Período: {targetGeneratePeriod}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowGenerateModal(false)}
                className="text-stone-900 hover:text-stone-950 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-stone-700">Período Objetivo (YYYY-MM):</label>
                  <input
                    type="month"
                    value={targetGeneratePeriod}
                    onChange={(e) => setTargetGeneratePeriod(e.target.value)}
                    className="px-2.5 py-1 bg-white border border-stone-300 rounded-md font-mono font-bold text-xs"
                  />
                </div>
                <p className="text-[11px] text-stone-500">
                  Se generarán obligaciones en estado <strong>PENDIENTE</strong> para todas las plantillas activas que aún no hayan sido creadas para este mes.
                </p>
                <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-[11px] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span><strong>Idempotencia garantizada:</strong> No se crearán duplicados si ya existen obligaciones generadas para el período.</span>
                </div>
              </div>

              {generateFeedback && (
                <div className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                  generateFeedback.type === 'success' 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}>
                  {generateFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <p className="font-semibold">{generateFeedback.message}</p>
                </div>
              )}

              {/* Plantillas Variables para este período */}
              {templates.filter(t => t.status === 'ACTIVE' && t.amountType === 'VARIABLE').length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                    Gastos Variables a Ajustar ({templates.filter(t => t.status === 'ACTIVE' && t.amountType === 'VARIABLE').length})
                  </h4>
                  <div className="space-y-2">
                    {templates.filter(t => t.status === 'ACTIVE' && t.amountType === 'VARIABLE').map(tpl => (
                      <div key={tpl.id} className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl flex items-center justify-between gap-3 text-xs">
                        <div>
                          <p className="font-bold text-stone-900">{tpl.name || tpl.concept}</p>
                          <p className="text-[11px] text-stone-500">{tpl.supplierName || tpl.beneficiary}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-stone-600">$</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={variableAmountsInput[tpl.id] ?? tpl.amount}
                            onChange={(e) => setVariableAmountsInput(prev => ({
                              ...prev,
                              [tpl.id]: Number(e.target.value)
                            }))}
                            className="w-28 px-2 py-1 bg-white border border-purple-300 rounded-md font-bold text-right text-xs"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 bg-stone-50 border-t border-stone-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowGenerateModal(false)}
                disabled={generating}
                className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-bold cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={handleExecuteGeneration}
                disabled={generating}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-stone-950 rounded-lg text-xs font-black shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {generating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Generando Período...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Confirmar Generación</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
