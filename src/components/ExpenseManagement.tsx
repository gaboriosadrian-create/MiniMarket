import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/authContext';
import { Expense, ExpenseCategory, PurchasePaymentMethod } from '../types';
import { 
  getExpensesByBusiness, 
  createExpense, 
  updateExpense, 
  deleteExpense 
} from '../lib/expenseService';
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
  Tag
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

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Servicios');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PurchasePaymentMethod>('EFECTIVO');
  const [notes, setNotes] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    setCategory('Servicios');
    setAmount('');
    setPaymentMethod('EFECTIVO');
    setNotes('');
    setCustomDate(new Date().toISOString().slice(0, 10));
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (expense: Expense) => {
    setEditingExpense(expense);
    setDescription(expense.description || '');
    setCategory(expense.category || 'Servicios');
    setAmount(String(expense.amount));
    setPaymentMethod(expense.paymentMethod || 'EFECTIVO');
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
          description,
          category,
          amount: numAmount,
          paymentMethod,
          notes: notes.trim() || undefined,
          createdAt: createdIso
        });
      } else {
        await createExpense({
          businessId: business.id,
          description,
          category,
          amount: numAmount,
          paymentMethod,
          notes: notes.trim() || undefined,
          createdAt: createdIso,
          userId: userProfile.uid
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

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar este gasto?')) return;
    setDeletingId(id);
    try {
      await deleteExpense(id);
      await loadExpenses();
    } catch (err) {
      console.error(err);
      alert('Error al eliminar el gasto.');
    } finally {
      setDeletingId(null);
    }
  };

  const totalAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  const filteredExpenses = expenses.filter((e) => {
    if (selectedCategoryFilter !== 'ALL' && e.category !== selectedCategoryFilter) {
      return false;
    }
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      e.description?.toLowerCase().includes(term) ||
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
      {/* Date Filter */}
      <DateFilter onDateRangeChange={handleDateRangeChange} />

      {/* Header & Metrics */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-stone-400">Total Gastos ({dateRangeLabel})</span>
          <p className="text-3xl font-black text-rose-700 font-mono mt-0.5">
            {formatCurrency(totalAmount)}
          </p>
          <span className="text-xs text-stone-500">{expenses.length} gastos registrados</span>
        </div>

        <button
          onClick={openCreateModal}
          id="btn-register-expense"
          className="px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm shadow-xs transition-colors flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
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
            {/* Category Filter dropdown */}
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

            <div className="relative w-full sm:w-48">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
              <input
                type="text"
                placeholder="Buscar gasto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-stone-50 border-b border-stone-200 uppercase tracking-wider text-[11px] text-stone-500 font-bold">
              <tr>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Descripción</th>
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4">Medio de Pago</th>
                <th className="py-3 px-4 text-right">Importe</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-stone-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-rose-600" />
                    Cargando gastos...
                  </td>
                </tr>
              ) : filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-stone-400">
                    No hay gastos registrados para este período.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-stone-50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-stone-900">
                      {formatDate(expense.createdAt)}
                    </td>

                    <td className="py-3 px-4 font-bold text-stone-900">
                      {expense.description}
                      {expense.notes && (
                        <p className="text-[10px] text-stone-400 font-normal">{expense.notes}</p>
                      )}
                    </td>

                    <td className="py-3 px-4 font-semibold text-stone-800">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-stone-100 text-stone-700">
                        <Tag className="w-3 h-3 text-stone-400 mr-1" />
                        {expense.category}
                      </span>
                    </td>

                    <td className="py-3 px-4 font-bold">
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-stone-100 text-stone-800 border border-stone-200">
                        {expense.paymentMethod}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right font-black text-rose-700 font-mono text-sm">
                      {formatCurrency(expense.amount)}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => openEditModal(expense)}
                          className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => expense.id && handleDelete(expense.id)}
                          disabled={deletingId === expense.id}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register/Edit Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-lg font-black text-stone-900">
                {editingExpense ? 'Editar Gasto' : 'Registrar Gasto'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-stone-400 hover:text-stone-600"
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
                  Descripción *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Pago servicio de luz / artículos de limpieza"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase text-stone-700 mb-1">
                    Importe ($) *
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

              <div>
                <label className="block text-xs font-bold uppercase text-stone-700 mb-1">
                  Medio de Pago *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PurchasePaymentMethod)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
                >
                  <option value="EFECTIVO">💵 EFECTIVO</option>
                  <option value="MERCADO_PAGO">🟦 MERCADO PAGO</option>
                  <option value="OTRO">💳 OTRO</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-stone-700 mb-1">
                  Observación (Opcional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Comentarios adicionales..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-rose-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors"
                >
                  {saving ? 'Guardando...' : 'Guardar Gasto'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
};
