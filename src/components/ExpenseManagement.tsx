import React, { useState } from 'react';
import { useAuth } from '../lib/authContext';
import { 
  Expense, 
  ExpenseCategory, 
  ExpenseStatus,
  FundSource,
  PurchasePaymentMethod 
} from '../types';
import { 
  getExpensesByBusiness, 
  createExpense, 
  updateExpense, 
  deleteExpense,
  payExpense,
  cancelExpense 
} from '../lib/expenseService';
import { isBusinessExpenseOutflow } from '../lib/businessAnalysisService';
import { DateFilter } from './DateFilter';
import { 
  Receipt, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  X, 
  AlertTriangle, 
  RefreshCw,
  Tag,
  CheckCircle2,
  Clock,
  Ban,
  Wallet,
  Building2,
  DollarSign
} from 'lucide-react';

export const ExpenseManagement: React.FC = () => {
  const { userProfile, business } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRangeLabel, setDateRangeLabel] = useState('Hoy');
  const [startDateIso, setStartDateIso] = useState<string>('');
  const [endDateIso, setEndDateIso] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [selectedFundFilter, setSelectedFundFilter] = useState<string>('ALL');

  // Modal State - Register / Edit
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [description, setDescription] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Servicios');
  const [amount, setAmount] = useState('');
  const [status, setStatus] = useState<ExpenseStatus>('PAGADO');
  const [fundSource, setFundSource] = useState<FundSource>('CASH');
  const [paymentMethod, setPaymentMethod] = useState<PurchasePaymentMethod>('EFECTIVO');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Pay Expense Modal State
  const [expenseToPay, setExpenseToPay] = useState<Expense | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payFundSource, setPayFundSource] = useState<FundSource>('CASH');
  const [payPaymentMethod, setPayPaymentMethod] = useState<PurchasePaymentMethod>('EFECTIVO');
  const [payNotes, setPayNotes] = useState('');
  const [paying, setPaying] = useState(false);

  // Cancel Expense Modal State
  const [expenseToCancel, setExpenseToCancel] = useState<Expense | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const canManageExpenses = userProfile?.role === 'ADMIN' || userProfile?.role === 'SUPER_ADMIN';

  const categories: ExpenseCategory[] = ['Servicios', 'Limpieza', 'Mantenimiento', 'Transporte', 'Otros'];

  const loadExpenses = async (start?: string, end?: string) => {
    if (!business?.id) return;
    setLoading(true);
    try {
      const data = await getExpensesByBusiness(business.id, start || startDateIso, end || endDateIso);
      setExpenses(data);
    } catch (err) {
      console.error('Error loading expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeChange = (start: string, end: string, label: string) => {
    setStartDateIso(start);
    setEndDateIso(end);
    setDateRangeLabel(label);
    loadExpenses(start, end);
  };

  const openCreateModal = () => {
    setEditingExpense(null);
    setDescription('');
    setSupplierName('');
    setCategory('Servicios');
    setAmount('');
    setStatus('PAGADO');
    setFundSource('CASH');
    setPaymentMethod('EFECTIVO');
    setDueDate('');
    setNotes('');
    setCustomDate(new Date().toISOString().slice(0, 10));
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setDescription(expense.description || '');
    setSupplierName(expense.supplierName || '');
    setCategory(expense.category || 'Servicios');
    setAmount(String(expense.amount));
    setStatus(expense.status || 'PAGADO');
    setFundSource(expense.fundSource || 'CASH');
    setPaymentMethod(expense.paymentMethod || 'EFECTIVO');
    setDueDate(expense.dueDate ? expense.dueDate.slice(0, 10) : '');
    setNotes(expense.notes || '');
    setCustomDate(expense.createdAt ? expense.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10));
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business?.id || !userProfile?.uid) return;

    if (!description.trim()) {
      setFormError('La descripción es obligatoria.');
      return;
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setFormError('El importe debe ser mayor a 0.');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      const createdIso = customDate 
        ? new Date(customDate + 'T12:00:00').toISOString() 
        : new Date().toISOString();

      if (editingExpense?.id) {
        await updateExpense(editingExpense.id, {
          description: description.trim(),
          supplierName: supplierName.trim() || undefined,
          category,
          amount: numAmount,
          status,
          fundSource,
          paymentMethod,
          dueDate: status === 'PENDIENTE' && dueDate ? new Date(dueDate + 'T12:00:00').toISOString() : undefined,
          notes: notes.trim() || undefined,
          createdAt: createdIso
        });
        setNotification({
          message: 'Gasto actualizado con éxito.',
          type: 'success'
        });
      } else {
        await createExpense({
          businessId: business.id,
          description: description.trim(),
          supplierName: supplierName.trim() || undefined,
          category,
          amount: numAmount,
          status,
          fundSource,
          paymentMethod,
          dueDate: status === 'PENDIENTE' && dueDate ? new Date(dueDate + 'T12:00:00').toISOString() : undefined,
          notes: notes.trim() || undefined,
          createdAt: createdIso,
          userId: userProfile.uid
        });
        setNotification({
          message: status === 'PENDIENTE' 
            ? 'Gasto registrado como pendiente de pago.' 
            : fundSource === 'PERSONAL'
              ? 'Gasto registrado (financiado con fondos personales, sin salida de caja).'
              : 'Gasto registrado y pagado con fondos del negocio.',
          type: 'success'
        });
      }

      setShowModal(false);
      await loadExpenses();
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Error al guardar el gasto.');
    } finally {
      setSaving(false);
    }
  };

  const openPayModal = (expense: Expense) => {
    const pending = expense.pendingAmount !== undefined ? expense.pendingAmount : expense.amount;
    setExpenseToPay(expense);
    setPayAmount(String(pending));
    setPayFundSource('CASH');
    setPayPaymentMethod('EFECTIVO');
    setPayNotes('');
  };

  const handleConfirmPay = async () => {
    if (!expenseToPay || !userProfile?.uid) return;
    const numAmount = Number(payAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setNotification({ message: 'El importe a pagar debe ser mayor a 0', type: 'error' });
      return;
    }

    setPaying(true);
    try {
      await payExpense({
        expenseId: expenseToPay.id,
        amount: numAmount,
        fundSource: payFundSource,
        paymentMethod: payPaymentMethod,
        notes: payNotes.trim() || undefined,
        userId: userProfile.uid,
        userName: userProfile.displayName || userProfile.email || 'Usuario'
      });
      setNotification({ message: 'Pago de gasto registrado correctamente.', type: 'success' });
      setExpenseToPay(null);
      await loadExpenses();
    } catch (err: any) {
      console.error(err);
      setNotification({ message: err?.message || 'Error al procesar el pago del gasto.', type: 'error' });
    } finally {
      setPaying(false);
    }
  };

  const openCancelModal = (expense: Expense) => {
    setExpenseToCancel(expense);
    setCancelReason('');
  };

  const handleConfirmCancel = async () => {
    if (!expenseToCancel || !userProfile?.uid) return;
    if (!cancelReason.trim()) {
      setNotification({ message: 'Debe ingresar un motivo de anulación.', type: 'error' });
      return;
    }

    setCancelling(true);
    try {
      await cancelExpense({
        expenseId: expenseToCancel.id,
        reason: cancelReason.trim(),
        userId: userProfile.uid,
        userName: userProfile.displayName || userProfile.email || 'Usuario'
      });
      setNotification({ message: 'Gasto anulado correctamente.', type: 'success' });
      setExpenseToCancel(null);
      await loadExpenses();
    } catch (err: any) {
      console.error(err);
      setNotification({ message: err?.message || 'Error al anular el gasto.', type: 'error' });
    } finally {
      setCancelling(false);
    }
  };

  const promptDelete = (expense: Expense) => {
    if (!canManageExpenses) {
      setNotification({
        message: 'No tienes permisos para eliminar gastos operativos.',
        type: 'error'
      });
      return;
    }
    setExpenseToDelete(expense);
  };

  const confirmDelete = async () => {
    if (!expenseToDelete?.id) return;
    setDeletingId(expenseToDelete.id);
    try {
      await deleteExpense(expenseToDelete.id);
      setNotification({
        message: `Gasto "${expenseToDelete.description}" eliminado correctamente.`,
        type: 'success'
      });
      setExpenseToDelete(null);
      await loadExpenses();
    } catch (err: any) {
      console.error(err);
      setNotification({
        message: err?.message || 'Error al eliminar el gasto.',
        type: 'error'
      });
    } finally {
      setDeletingId(null);
    }
  };

  // Metrics (Filtered by business financial principles)
  const activeExpenses = expenses.filter(e => e.status !== 'ANULADO');
  const totalAmount = activeExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  
  // Real financial outflow from business funds (strictly matches DailyControlOverview & businessAnalysisService)
  const totalPagadoNegocio = expenses
    .filter(isBusinessExpenseOutflow)
    .reduce((sum, e) => sum + (Number((e as any).paidAmount ?? e.amount) || 0), 0);

  const totalPendiente = activeExpenses
    .filter(e => e.status === 'PENDIENTE')
    .reduce((sum, e) => sum + (Number(e.pendingAmount !== undefined ? e.pendingAmount : e.amount) || 0), 0);

  const totalPersonal = activeExpenses
    .filter(e => e.fundSource === 'PERSONAL')
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const filteredExpenses = expenses.filter((e) => {
    if (selectedCategoryFilter !== 'ALL' && e.category !== selectedCategoryFilter) {
      return false;
    }
    if (selectedStatusFilter !== 'ALL') {
      const expStatus = e.status || 'PAGADO';
      if (expStatus !== selectedStatusFilter) return false;
    }
    if (selectedFundFilter !== 'ALL') {
      const expFund = e.fundSource || 'CASH';
      if (expFund !== selectedFundFilter) return false;
    }
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      e.description?.toLowerCase().includes(term) ||
      e.supplierName?.toLowerCase().includes(term) ||
      e.category?.toLowerCase().includes(term) ||
      e.paymentMethod?.toLowerCase().includes(term) ||
      e.notes?.toLowerCase().includes(term)
    );
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(val);
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* Notification Toast Banner */}
      {notification && (
        <div className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between shadow-xs ${
          notification.type === 'error'
            ? 'bg-red-50 border-red-200 text-red-900'
            : 'bg-emerald-50 border-emerald-200 text-emerald-900'
        }`}>
          <div className="flex items-center space-x-2">
            <AlertTriangle className={`w-4 h-4 shrink-0 ${
              notification.type === 'error' ? 'text-red-600' : 'text-emerald-600'
            }`} />
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-stone-400 hover:text-stone-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Date Filter */}
      <DateFilter viewTitle="Gastos Operativos" onDateRangeChange={handleDateRangeChange} />

      {/* Header & Metrics Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Gastos */}
        <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Total Gastos ({dateRangeLabel})</span>
          <p className="text-2xl font-black text-stone-900 font-mono mt-1">
            {formatCurrency(totalAmount)}
          </p>
          <span className="text-[11px] text-stone-500">{activeExpenses.length} gastos activos</span>
        </div>

        {/* Pagado Negocio (Egreso Financiero Real) */}
        <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Pagado Negocio</span>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-100 text-emerald-800 uppercase">Impacta Caja</span>
          </div>
          <p className="text-2xl font-black text-rose-700 font-mono mt-1">
            {formatCurrency(totalPagadoNegocio)}
          </p>
          <span className="text-[11px] text-stone-500">Egreso financiero efectivo</span>
        </div>

        {/* Pendiente de Pago */}
        <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Pendiente de Pago</span>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-100 text-amber-800 uppercase">Obligación</span>
          </div>
          <p className="text-2xl font-black text-amber-600 font-mono mt-1">
            {formatCurrency(totalPendiente)}
          </p>
          <span className="text-[11px] text-stone-500">A liquidar próximamente</span>
        </div>

        {/* Fondos Personales */}
        <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400">Fondos Personales</span>
            <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-purple-100 text-purple-800 uppercase">Sin Impacto Caja</span>
          </div>
          <p className="text-2xl font-black text-purple-700 font-mono mt-1">
            {formatCurrency(totalPersonal)}
          </p>
          <span className="text-[11px] text-stone-500">Aporte socio / titular</span>
        </div>
      </div>

      {/* Main Bar: Register Button */}
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs">
        <div>
          <h2 className="text-sm font-black text-stone-900">Control y Gestión de Gastos</h2>
          <p className="text-xs text-stone-500">Registra y administra los egresos de caja y gastos pendientes del negocio.</p>
        </div>
        <button
          onClick={openCreateModal}
          id="btn-register-expense"
          className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ Registrar Gasto</span>
        </button>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-stone-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Receipt className="w-5 h-5 text-rose-600" />
            <h3 className="text-base font-extrabold text-stone-900">
              Listado de Gastos ({filteredExpenses.length})
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Status Filter */}
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-stone-300 rounded-xl text-xs font-bold text-stone-700 focus:outline-none"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="PAGADO">Pagados</option>
              <option value="PENDIENTE">Pendientes</option>
              <option value="ANULADO">Anulados</option>
            </select>

            {/* Fund Source Filter */}
            <select
              value={selectedFundFilter}
              onChange={(e) => setSelectedFundFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-stone-300 rounded-xl text-xs font-bold text-stone-700 focus:outline-none"
            >
              <option value="ALL">Todos los Orígenes</option>
              <option value="CASH">Caja Negocio</option>
              <option value="PERSONAL">Fondos Personales</option>
              <option value="BANK">Banco</option>
              <option value="MERCADO_PAGO">Mercado Pago</option>
            </select>

            {/* Category Filter */}
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-stone-300 rounded-xl text-xs font-bold text-stone-700 focus:outline-none"
            >
              <option value="ALL">Todas las Categorías</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <div className="relative w-full sm:w-44">
              <Search className="w-4 h-4 absolute left-3 top-2 text-stone-400" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-stone-50 border-b border-stone-200 uppercase tracking-wider text-[11px] text-stone-500 font-bold">
              <tr>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Concepto / Proveedor</th>
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4">Origen Fondos</th>
                <th className="py-3 px-4">Estado</th>
                <th className="py-3 px-4 text-right">Importe</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-stone-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-rose-600" />
                    Cargando gastos...
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-stone-400">
                    No hay gastos registrados para este período y filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((expense) => {
                  const isAnulado = expense.status === 'ANULADO';
                  const isPendiente = expense.status === 'PENDIENTE';
                  const isPagado = (expense.status || 'PAGADO') === 'PAGADO';
                  const isPersonal = expense.fundSource === 'PERSONAL';

                  return (
                    <tr 
                      key={expense.id} 
                      className={`hover:bg-stone-50 transition-colors ${
                        isAnulado ? 'bg-stone-50/70 opacity-60' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-bold text-stone-900 whitespace-nowrap">
                        {formatDate(expense.createdAt)}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-bold text-stone-900 flex items-center space-x-1.5">
                          <span className={isAnulado ? 'line-through' : ''}>{expense.description}</span>
                        </div>
                        {expense.supplierName && (
                          <p className="text-[11px] text-stone-500 font-medium">Prov: {expense.supplierName}</p>
                        )}
                        {expense.notes && (
                          <p className="text-[10px] text-stone-400 font-normal italic">{expense.notes}</p>
                        )}
                        {isAnulado && expense.cancellationReason && (
                          <p className="text-[10px] text-red-600 font-medium mt-0.5">
                            Motivo anulación: {expense.cancellationReason}
                          </p>
                        )}
                      </td>

                      <td className="py-3 px-4 font-semibold text-stone-800 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-stone-100 text-stone-700">
                          <Tag className="w-3 h-3 text-stone-400 mr-1" />
                          {expense.category}
                        </span>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {isPersonal ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800 border border-purple-200">
                            <Building2 className="w-3 h-3 mr-1" />
                            Personal (No Caja)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <Wallet className="w-3 h-3 mr-1" />
                            Caja Negocio
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {isAnulado ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-stone-200 text-stone-600">
                            <Ban className="w-3 h-3 mr-1 text-stone-500" />
                            Anulado
                          </span>
                        ) : isPendiente ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3 mr-1 text-amber-600" />
                            Pendiente
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-600" />
                            Pagado
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap font-mono">
                        <div className={`font-black text-sm ${
                          isAnulado ? 'line-through text-stone-400' : 'text-rose-700'
                        }`}>
                          {formatCurrency(expense.amount)}
                        </div>
                        {isPendiente && (
                          <p className="text-[10px] text-amber-700 font-bold">
                            Saldo: {formatCurrency(expense.pendingAmount ?? expense.amount)}
                          </p>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center space-x-1">
                          {/* Pagar Button (for pending expenses) */}
                          {isPendiente && !isAnulado && (
                            <button
                              onClick={() => openPayModal(expense)}
                              className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-bold flex items-center space-x-1 shadow-2xs transition-colors cursor-pointer"
                              title="Pagar gasto pendiente"
                            >
                              <DollarSign className="w-3 h-3" />
                              <span>Pagar</span>
                            </button>
                          )}

                          {/* Anular Button */}
                          {!isAnulado && (
                            <button
                              onClick={() => openCancelModal(expense)}
                              className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Anular gasto"
                            >
                              <Ban className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Edit Button */}
                          {!isAnulado && (
                            <button
                              onClick={() => openEditModal(expense)}
                              className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                              title="Editar"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Delete Button */}
                          {canManageExpenses && (
                            <button
                              onClick={() => promptDelete(expense)}
                              disabled={deletingId === expense.id}
                              className="p-1.5 text-stone-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                              title="Eliminar registro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register/Edit Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-lg font-black text-stone-900">
                {editingExpense ? 'Editar Gasto' : 'Registrar Gasto Operativo'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs font-bold flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-stone-700 mb-1">
                  Concepto / Descripción *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Pago de electricidad / Artículos de limpieza / Alquiler"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-stone-700 mb-1">
                    Proveedor / Beneficiario
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Edenor / Librería Central"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-stone-700 mb-1">
                    Categoría *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-stone-700 mb-1">
                    Importe Total ($) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    placeholder="0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm font-mono font-bold focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-stone-700 mb-1">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    required
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Estado de Pago & Origen de Fondos */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-stone-50 rounded-xl border border-stone-200">
                <div>
                  <label className="block text-xs font-bold uppercase text-stone-700 mb-1">
                    Estado de Pago *
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ExpenseStatus)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-rose-500 focus:outline-none bg-white"
                  >
                    <option value="PAGADO">PAGADO (Inmediato)</option>
                    <option value="PENDIENTE">PENDIENTE (A Pagar)</option>
                  </select>
                  <span className="text-[10px] text-stone-400 block mt-1">
                    {status === 'PAGADO' ? 'Impacta caja si es fondo negocio' : 'Genera obligación de pago'}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-stone-700 mb-1">
                    Origen de Fondos *
                  </label>
                  <select
                    value={fundSource}
                    onChange={(e) => setFundSource(e.target.value as FundSource)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-rose-500 focus:outline-none bg-white"
                  >
                    <option value="CASH">Caja del Negocio</option>
                    <option value="PERSONAL">Fondos Personales (No Caja)</option>
                    <option value="BANK">Cuenta Bancaria</option>
                    <option value="MERCADO_PAGO">Mercado Pago</option>
                  </select>
                  <span className="text-[10px] text-stone-400 block mt-1">
                    {fundSource === 'PERSONAL' ? 'No computa como egreso de caja' : 'Registra egreso en caja'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-stone-700 mb-1">
                    Medio de Pago *
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PurchasePaymentMethod)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
                  >
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="MERCADO_PAGO">Mercado Pago</option>
                    <option value="OTRO">Transferencia / Otro</option>
                  </select>
                </div>

                {status === 'PENDIENTE' && (
                  <div>
                    <label className="block text-xs font-bold uppercase text-amber-700 mb-1">
                      Fecha de Vencimiento
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-3 py-2 border border-amber-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none bg-amber-50/50"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-stone-700 mb-1">
                  Observación (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles o notas adicionales..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {saving ? 'Guardando...' : 'Guardar Gasto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Expense Modal */}
      {expenseToPay && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center space-x-2 text-amber-600">
                <DollarSign className="w-5 h-5" />
                <h3 className="text-base font-black text-stone-900">Pagar Gasto Pendiente</h3>
              </div>
              <button onClick={() => setExpenseToPay(null)} className="text-stone-400 hover:text-stone-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 space-y-1.5 text-xs">
              <div className="flex justify-between items-start">
                <span className="font-bold text-stone-900">{expenseToPay.description}</span>
                <span className="font-black text-amber-600 font-mono">
                  Saldo: {formatCurrency(expenseToPay.pendingAmount ?? expenseToPay.amount)}
                </span>
              </div>
              {expenseToPay.supplierName && (
                <p className="text-[11px] text-stone-500">Proveedor: {expenseToPay.supplierName}</p>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase text-stone-700 mb-1">
                  Importe a Pagar ($) *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm font-mono font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-stone-700 mb-1">
                    Origen de Fondos *
                  </label>
                  <select
                    value={payFundSource}
                    onChange={(e) => setPayFundSource(e.target.value as FundSource)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="CASH">Caja Negocio</option>
                    <option value="PERSONAL">Fondos Personales</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-stone-700 mb-1">
                    Medio de Pago *
                  </label>
                  <select
                    value={payPaymentMethod}
                    onChange={(e) => setPayPaymentMethod(e.target.value as PurchasePaymentMethod)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="MERCADO_PAGO">Mercado Pago</option>
                    <option value="OTRO">Transferencia</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-stone-700 mb-1">
                  Notas del Pago
                </label>
                <input
                  type="text"
                  placeholder="Ej: Pago parcial / Número de comprobante"
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setExpenseToPay(null)}
                disabled={paying}
                className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmPay}
                disabled={paying}
                className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                {paying ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirmar Pago</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Expense Modal */}
      {expenseToCancel && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center space-x-3 text-red-600">
              <div className="p-2.5 bg-red-100 rounded-xl">
                <Ban className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-stone-900">Anular Gasto</h3>
                <p className="text-xs text-stone-500">Esta acción cancela el registro del gasto.</p>
              </div>
            </div>

            <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-start">
                <span className="font-bold text-stone-900">{expenseToCancel.description}</span>
                <span className="font-black text-rose-700 font-mono">{formatCurrency(expenseToCancel.amount)}</span>
              </div>
              
              {/* Financial Impact Warning */}
              {(expenseToCancel.fundSource === 'CASH' || expenseToCancel.paymentMethod === 'EFECTIVO') && expenseToCancel.fundSource !== 'PERSONAL' && (expenseToCancel.paidAmount || (expenseToCancel.status === 'PAGADO' ? expenseToCancel.amount : 0)) > 0 ? (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900 text-[11px] font-bold flex items-start space-x-2">
                  <Wallet className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                  <span>
                    El gasto fue pagado con fondos del negocio. Se registrará automáticamente un reintegro de {formatCurrency(expenseToCancel.paidAmount || expenseToCancel.amount)} a la caja.
                  </span>
                </div>
              ) : (
                <div className="p-2.5 bg-stone-100 border border-stone-200 rounded-lg text-stone-700 text-[11px]">
                  Este gasto no generó egreso de caja (financiación personal o pendiente), por lo que no altera el saldo de caja del negocio.
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-stone-700 mb-1">
                Motivo de la anulación *
              </label>
              <textarea
                rows={2}
                required
                placeholder="Ej: Registro duplicado / Comprobante erróneo / Compra devuelta..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-red-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setExpenseToCancel(null)}
                disabled={cancelling}
                className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={cancelling}
                className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                {cancelling ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Anulando...</span>
                  </>
                ) : (
                  <>
                    <Ban className="w-3.5 h-3.5" />
                    <span>Confirmar Anulación</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {expenseToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="p-2.5 bg-rose-100 rounded-xl">
                <Trash2 className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-stone-900">¿Eliminar este gasto?</h3>
                <p className="text-xs text-stone-500">Esta acción eliminará el registro de gastos operativos.</p>
              </div>
            </div>

            {/* Identified Expense Card */}
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between items-start">
                <span className="font-bold text-stone-900 text-sm">{expenseToDelete.description}</span>
                <span className="font-black text-rose-700 font-mono text-base">{formatCurrency(expenseToDelete.amount)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-stone-600 text-[11px] pt-2 border-t border-stone-200/60">
                <div>
                  <span className="font-bold text-stone-400 block uppercase text-[10px]">Categoría</span>
                  <span className="font-medium text-stone-800">{expenseToDelete.category}</span>
                </div>
                <div>
                  <span className="font-bold text-stone-400 block uppercase text-[10px]">Medio de Pago</span>
                  <span className="font-medium text-stone-800">
                    {expenseToDelete.paymentMethod === 'EFECTIVO' ? 'Efectivo' : expenseToDelete.paymentMethod === 'MERCADO_PAGO' ? 'Mercado Pago' : 'Otro'}
                  </span>
                </div>
                <div>
                  <span className="font-bold text-stone-400 block uppercase text-[10px]">Fecha</span>
                  <span className="font-medium text-stone-800">{formatDate(expenseToDelete.createdAt)}</span>
                </div>
                {expenseToDelete.notes && (
                  <div>
                    <span className="font-bold text-stone-400 block uppercase text-[10px]">Observación</span>
                    <span className="font-medium text-stone-800 truncate block">{expenseToDelete.notes}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setExpenseToDelete(null)}
                disabled={deletingId !== null}
                className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deletingId !== null}
                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 rounded-xl shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                {deletingId ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Eliminando...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar</span>
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
