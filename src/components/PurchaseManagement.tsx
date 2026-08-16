import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/authContext';
import { Purchase, PurchasePaymentMethod } from '../types';
import { 
  getPurchasesByBusiness, 
  createPurchase, 
  updatePurchase, 
  deletePurchase 
} from '../lib/purchaseService';
import { DateFilter } from './DateFilter';
import { 
  ShoppingCart, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  X, 
  AlertTriangle, 
  Check, 
  Banknote, 
  QrCode, 
  CreditCard,
  RefreshCw,
  Building,
  Info
} from 'lucide-react';

export const PurchaseManagement: React.FC = () => {
  const { userProfile, business } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRangeLabel, setDateRangeLabel] = useState('Hoy');
  const [startDateIso, setStartDateIso] = useState<string>('');
  const [endDateIso, setEndDateIso] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [description, setDescription] = useState('');
  const [supplier, setSupplier] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PurchasePaymentMethod>('EFECTIVO');
  const [notes, setNotes] = useState('');
  const [customDate, setCustomDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete State
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadPurchases = async (start?: string, end?: string) => {
    if (!business?.id) return;
    setLoading(true);
    try {
      const data = await getPurchasesByBusiness(business.id, start || startDateIso, end || endDateIso);
      setPurchases(data);
    } catch (err) {
      console.error('Error loading purchases:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeChange = (start: string, end: string, label: string) => {
    setStartDateIso(start);
    setEndDateIso(end);
    setDateRangeLabel(label);
    loadPurchases(start, end);
  };

  const openCreateModal = () => {
    setEditingPurchase(null);
    setDescription('');
    setSupplier('');
    setAmount('');
    setPaymentMethod('EFECTIVO');
    setNotes('');
    setCustomDate(new Date().toISOString().slice(0, 10));
    setFormError(null);
    setShowModal(true);
  };

  const openEditModal = (purchase: Purchase) => {
    setEditingPurchase(purchase);
    setDescription(purchase.description || '');
    setSupplier(purchase.supplier || '');
    setAmount(String(purchase.amount));
    setPaymentMethod(purchase.paymentMethod || 'EFECTIVO');
    setNotes(purchase.notes || '');
    setCustomDate(purchase.createdAt ? purchase.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10));
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

      if (editingPurchase?.id) {
        await updatePurchase(editingPurchase.id, {
          description,
          supplier: supplier.trim() || undefined,
          amount: numAmount,
          paymentMethod,
          notes: notes.trim() || undefined,
          createdAt: createdIso
        });
      } else {
        await createPurchase({
          businessId: business.id,
          description,
          supplier: supplier.trim() || undefined,
          amount: numAmount,
          paymentMethod,
          notes: notes.trim() || undefined,
          createdAt: createdIso,
          userId: userProfile.uid
        });
      }

      setShowModal(false);
      await loadPurchases();
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Error al guardar la compra.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta compra?')) return;
    setDeletingId(id);
    try {
      await deletePurchase(id);
      await loadPurchases();
    } catch (err) {
      console.error(err);
      alert('Error al eliminar la compra.');
    } finally {
      setDeletingId(null);
    }
  };

  const totalAmount = purchases.reduce((sum, p) => sum + (p.amount || 0), 0);

  const filteredPurchases = purchases.filter((p) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.description?.toLowerCase().includes(term) ||
      p.supplier?.toLowerCase().includes(term) ||
      p.paymentMethod?.toLowerCase().includes(term) ||
      p.notes?.toLowerCase().includes(term)
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

      {/* Info notice about stock */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center space-x-3 text-blue-900 text-xs">
        <Info className="w-5 h-5 text-blue-600 shrink-0" />
        <p>
          Las compras registradas aquí representan el egreso financiero por mercadería. <strong className="font-bold">No modifican el stock de productos de forma automática</strong>.
        </p>
      </div>

      {/* Header & Metrics */}
      <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-stone-400">Total Compras ({dateRangeLabel})</span>
          <p className="text-3xl font-black text-amber-700 font-mono mt-0.5">
            {formatCurrency(totalAmount)}
          </p>
          <span className="text-xs text-stone-500">{purchases.length} compras registradas</span>
        </div>

        <button
          onClick={openCreateModal}
          id="btn-register-purchase"
          className="px-5 py-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-sm shadow-xs transition-colors flex items-center space-x-2"
        >
          <Plus className="w-5 h-5" />
          <span>+ Registrar Compra</span>
        </button>
      </div>

      {/* Table Section */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-stone-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <ShoppingCart className="w-5 h-5 text-amber-600" />
            <h3 className="text-base font-extrabold text-stone-900">
              Listado de Compras ({filteredPurchases.length})
            </h3>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
            <input
              type="text"
              placeholder="Buscar compra, proveedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-stone-50 border-b border-stone-200 uppercase tracking-wider text-[11px] text-stone-500 font-bold">
              <tr>
                <th className="py-3 px-4">Fecha</th>
                <th className="py-3 px-4">Descripción</th>
                <th className="py-3 px-4">Proveedor</th>
                <th className="py-3 px-4">Medio de Pago</th>
                <th className="py-3 px-4 text-right">Importe</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-stone-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-amber-600" />
                    Cargando compras...
                  </td>
                </tr>
              ) : filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-stone-400">
                    No hay compras registradas para este período.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map((purchase) => (
                  <tr key={purchase.id} className="hover:bg-stone-50 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-stone-900">
                      {formatDate(purchase.createdAt)}
                    </td>

                    <td className="py-3 px-4 font-bold text-stone-900">
                      {purchase.description}
                      {purchase.notes && (
                        <p className="text-[10px] text-stone-400 font-normal">{purchase.notes}</p>
                      )}
                    </td>

                    <td className="py-3 px-4 text-stone-600 font-medium">
                      {purchase.supplier || <span className="text-stone-300 italic">Sin especificar</span>}
                    </td>

                    <td className="py-3 px-4 font-bold">
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-stone-100 text-stone-800 border border-stone-200">
                        {purchase.paymentMethod}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right font-black text-amber-700 font-mono text-sm">
                      {formatCurrency(purchase.amount)}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => openEditModal(purchase)}
                          className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => purchase.id && handleDelete(purchase.id)}
                          disabled={deletingId === purchase.id}
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

      {/* Register/Edit Purchase Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-lg font-black text-stone-900">
                {editingPurchase ? 'Editar Compra' : 'Registrar Compra'}
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
                  placeholder="Ej: Compra de bebidas distribuidora"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-stone-700 mb-1">
                  Proveedor (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Distribuidora Central"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
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
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm font-mono font-bold focus:ring-2 focus:ring-amber-500 focus:outline-none"
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
                    className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
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
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
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
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
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
                  className="px-5 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-colors"
                >
                  {saving ? 'Guardando...' : 'Guardar Compra'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}
    </div>
  );
};
