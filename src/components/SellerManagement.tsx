import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../lib/authContext';
import { UserProfile, UserPermissions, UserStatus } from '../types';
import { 
  getUsersByBusiness, 
  createSellerForBusiness, 
  updateSellerProfile, 
  updateSellerStatus, 
  updateSellerPermissions 
} from '../lib/businessService';
import { DEFAULT_SELLER_PERMISSIONS, getEffectivePermissions } from '../lib/permissions';
import { 
  Users, 
  Plus, 
  Search, 
  Pencil, 
  ShieldCheck, 
  Lock, 
  Unlock, 
  UserX, 
  UserCheck, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Mail, 
  Calendar, 
  Clock, 
  Check, 
  Shield, 
  Info,
  ShoppingCart,
  Package,
  ArrowDownLeft,
  DollarSign,
  Receipt,
  ClipboardList
} from 'lucide-react';

export const SellerManagement: React.FC = () => {
  const { userProfile, business } = useAuth();
  const [sellers, setSellers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSeller, setEditingSeller] = useState<UserProfile | null>(null);
  const [permissionsSeller, setPermissionsSeller] = useState<UserProfile | null>(null);

  // Form states for Add Modal
  const [newSellerName, setNewSellerName] = useState('');
  const [newSellerEmail, setNewSellerEmail] = useState('');
  const [newSellerPassword, setNewSellerPassword] = useState('123');
  const [newSellerPermissions, setNewSellerPermissions] = useState<UserPermissions>(DEFAULT_SELLER_PERMISSIONS);
  const [savingNewSeller, setSavingNewSeller] = useState(false);

  // Form state for Edit Modal
  const [editName, setEditName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Form state for Permissions Modal
  const [editPermissions, setEditPermissions] = useState<UserPermissions>(DEFAULT_SELLER_PERMISSIONS);
  const [savingPermissions, setSavingPermissions] = useState(false);

  const loadSellers = async () => {
    if (!business?.id) return;
    setLoading(true);
    try {
      const usersList = await getUsersByBusiness(business.id);
      setSellers(usersList.filter((u) => u.role === 'SELLER'));
    } catch (err) {
      console.error('Error al cargar vendedores:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSellers();
  }, [business?.id]);

  const showSuccessFeedback = (msg: string) => {
    setFeedback({ type: 'success', message: msg });
    setTimeout(() => setFeedback(null), 4000);
  };

  const showErrorFeedback = (msg: string) => {
    setFeedback({ type: 'error', message: msg });
    setTimeout(() => setFeedback(null), 5000);
  };

  const filteredSellers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return sellers;
    return sellers.filter(
      (s) =>
        s.displayName.toLowerCase().includes(term) ||
        s.email.toLowerCase().includes(term)
    );
  }, [sellers, searchTerm]);

  // Handle Add Seller
  const handleCreateSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business?.id || !newSellerName.trim() || !newSellerEmail.trim()) return;

    setSavingNewSeller(true);
    try {
      const adminInfo = userProfile
        ? { uid: userProfile.uid, email: userProfile.email }
        : undefined;

      await createSellerForBusiness(
        {
          sellerName: newSellerName,
          sellerEmail: newSellerEmail,
          sellerPassword: newSellerPassword,
          businessId: business.id
        },
        newSellerPermissions,
        adminInfo
      );

      setNewSellerName('');
      setNewSellerEmail('');
      setNewSellerPassword('123');
      setNewSellerPermissions(DEFAULT_SELLER_PERMISSIONS);
      setShowAddModal(false);
      showSuccessFeedback('Vendedor creado exitosamente.');
      await loadSellers();
    } catch (err: any) {
      showErrorFeedback('Error al crear vendedor: ' + err.message);
    } finally {
      setSavingNewSeller(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (seller: UserProfile) => {
    setEditingSeller(seller);
    setEditName(seller.displayName);
  };

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSeller || !userProfile || !business) return;

    setSavingEdit(true);
    try {
      await updateSellerProfile(
        editingSeller.uid,
        { displayName: editName },
        { uid: userProfile.uid, email: userProfile.email, businessId: business.id },
        editingSeller.email
      );
      setEditingSeller(null);
      showSuccessFeedback('Información de vendedor actualizada.');
      await loadSellers();
    } catch (err: any) {
      showErrorFeedback('Error al actualizar vendedor: ' + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  // Toggle Seller Status (Block / Unblock / Deactivate / Activate)
  const handleToggleStatus = async (seller: UserProfile, targetStatus: UserStatus) => {
    if (!userProfile || !business) return;

    const actionNames: Record<UserStatus, string> = {
      ACTIVE: 'activar / desbloquear',
      BLOCKED: 'bloquear',
      DISABLED: 'desactivar'
    };

    if (
      !confirm(
        `¿Confirmas que deseas ${actionNames[targetStatus]} a ${seller.displayName}?`
      )
    ) {
      return;
    }

    try {
      await updateSellerStatus(
        seller.uid,
        targetStatus,
        { uid: userProfile.uid, email: userProfile.email, businessId: business.id },
        seller.email
      );
      const statusLabels: Record<UserStatus, string> = {
        ACTIVE: 'Activo',
        BLOCKED: 'Bloqueado',
        DISABLED: 'Desactivado'
      };
      showSuccessFeedback(`Estado de ${seller.displayName} actualizado a ${statusLabels[targetStatus]}.`);
      await loadSellers();
    } catch (err: any) {
      showErrorFeedback('No se pudo cambiar el estado. Intentá nuevamente.');
    }
  };

  // Open Permissions Modal
  const openPermissionsModal = (seller: UserProfile) => {
    setPermissionsSeller(seller);
    setEditPermissions(getEffectivePermissions(seller));
  };

  // Save Permissions
  const handleSavePermissions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissionsSeller || !userProfile || !business) return;

    setSavingPermissions(true);
    try {
      await updateSellerPermissions(
        permissionsSeller.uid,
        editPermissions,
        { uid: userProfile.uid, email: userProfile.email, businessId: business.id },
        permissionsSeller.email
      );
      setPermissionsSeller(null);
      showSuccessFeedback(`Permisos actualizados para ${permissionsSeller.displayName}.`);
      await loadSellers();
    } catch (err: any) {
      showErrorFeedback('Error al guardar permisos: ' + err.message);
    } finally {
      setSavingPermissions(false);
    }
  };

  const getStatusBadge = (seller: UserProfile) => {
    const status = seller.status || (seller.active === false ? 'DISABLED' : 'ACTIVE');
    if (status === 'BLOCKED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
          <Lock className="w-3 h-3 text-red-600" /> Bloqueado
        </span>
      );
    }
    if (status === 'DISABLED') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-stone-200 text-stone-700 border border-stone-300">
          <UserX className="w-3 h-3 text-stone-600" /> Desactivado
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
        <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Activo
      </span>
    );
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return 'No registrada';
    try {
      return new Date(isoStr).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    } catch {
      return 'No registrada';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-6 shadow-2xs space-y-5">
      
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl text-sm font-bold flex items-center justify-between border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-stone-400 hover:text-stone-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-stone-100 pb-4">
        <div>
          <h3 className="text-xl font-bold text-stone-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-600" />
            Gestión de Vendedores
          </h3>
          <p className="text-xs text-stone-500 mt-0.5">
            Administra el personal de ventas y configura sus permisos individuales para {business?.name}.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Search Bar */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Buscar por nombre o email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            id="btn-add-seller"
            className="inline-flex items-center justify-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nuevo Vendedor</span>
          </button>
        </div>
      </div>

      {/* Sellers List / Grid */}
      {loading ? (
        <div className="p-12 text-center text-stone-500 text-sm">
          Cargando vendedores de {business?.name}...
        </div>
      ) : filteredSellers.length === 0 ? (
        <div className="p-8 text-center text-stone-500 text-sm bg-stone-50 rounded-2xl border border-stone-200 space-y-2">
          <Users className="w-8 h-8 text-stone-400 mx-auto" />
          <p className="font-bold text-stone-700">No se encontraron vendedores</p>
          <p className="text-xs text-stone-500">
            {searchTerm
              ? 'No hay resultados que coincidan con la búsqueda.'
              : 'Haz clic en "+ Nuevo Vendedor" para agregar el primer cajero/vendedor.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {filteredSellers.map((seller) => {
            const effPerms = getEffectivePermissions(seller);
            const status = seller.status || (seller.active === false ? 'DISABLED' : 'ACTIVE');

            return (
              <div
                key={seller.uid}
                className="bg-white border border-stone-200 hover:border-stone-300 rounded-2xl p-4 transition-all shadow-2xs space-y-3"
              >
                {/* Main Row Info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-11 h-11 rounded-2xl bg-blue-100 text-blue-900 flex items-center justify-center font-black text-base shrink-0 border border-blue-200">
                      {seller.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-base font-bold text-stone-900">{seller.displayName}</h4>
                        {getStatusBadge(seller)}
                      </div>
                      <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                        <Mail className="w-3.5 h-3.5 text-stone-400" />
                        {seller.email}
                      </p>
                    </div>
                  </div>

                  {/* Dates & Last Activity */}
                  <div className="text-right text-xs text-stone-500 sm:border-l sm:border-stone-100 sm:pl-4 space-y-0.5 shrink-0">
                    <p className="flex items-center gap-1 justify-end">
                      <Calendar className="w-3 h-3 text-stone-400" />
                      Alta: <span className="font-semibold text-stone-700">{formatDate(seller.createdAt)}</span>
                    </p>
                    <p className="flex items-center gap-1 justify-end">
                      <Clock className="w-3 h-3 text-stone-400" />
                      Últ. Actividad: <span className="font-semibold text-stone-700">{formatDate(seller.lastActivity)}</span>
                    </p>
                  </div>
                </div>

                {/* Permissions Badges Summary */}
                <div className="bg-stone-50/90 rounded-xl p-2.5 border border-stone-200/60 flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                  <span className="text-stone-400 uppercase tracking-wider text-[10px] font-extrabold mr-1">Permisos:</span>
                  
                  {effPerms.sales.create && (
                    <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-lg flex items-center gap-1 border border-emerald-200">
                      <ShoppingCart className="w-3 h-3 text-emerald-600" /> Crear Ventas
                    </span>
                  )}
                  {effPerms.sales.view && (
                    <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-lg border border-emerald-200">
                      Ver Ventas
                    </span>
                  )}
                  {effPerms.inventory.view && (
                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-lg flex items-center gap-1 border border-blue-200">
                      <Package className="w-3 h-3 text-blue-600" /> Ver Stock
                    </span>
                  )}
                  {effPerms.inventory.receive && (
                    <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-lg flex items-center gap-1 border border-indigo-200">
                      <ArrowDownLeft className="w-3 h-3 text-indigo-600" /> Recibir Productos
                    </span>
                  )}
                  {effPerms.inventory.stockEntry && (
                    <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-lg border border-indigo-200">
                      Ingreso a Stock
                    </span>
                  )}
                  {effPerms.receiving.create && (
                    <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-lg border border-purple-200">
                      Recepciones
                    </span>
                  )}
                  {effPerms.purchases.create && (
                    <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded-lg flex items-center gap-1 border border-amber-200">
                      <Receipt className="w-3 h-3 text-amber-600" /> Compras
                    </span>
                  )}
                  {effPerms.cash.view && (
                    <span className="bg-stone-200 text-stone-800 px-2 py-0.5 rounded-lg flex items-center gap-1 border border-stone-300">
                      <DollarSign className="w-3 h-3 text-stone-600" /> Caja
                    </span>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-stone-100">
                  {/* EDIT DATA */}
                  <button
                    onClick={() => openEditModal(seller)}
                    className="px-3 py-1.5 rounded-xl border border-stone-300 hover:bg-stone-100 text-stone-700 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5 text-stone-500" />
                    <span>Editar</span>
                  </button>

                  {/* MANAGE PERMISSIONS */}
                  <button
                    onClick={() => openPermissionsModal(seller)}
                    className="px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-800 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                    <span>Permisos</span>
                  </button>

                  {/* BLOCK / UNBLOCK */}
                  {status === 'BLOCKED' ? (
                    <button
                      onClick={() => handleToggleStatus(seller, 'ACTIVE')}
                      className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Unlock className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Desbloquear</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleStatus(seller, 'BLOCKED')}
                      className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 hover:bg-amber-100 text-amber-900 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Lock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Bloquear</span>
                    </button>
                  )}

                  {/* DISABLE / ACTIVATE */}
                  {status === 'DISABLED' ? (
                    <button
                      onClick={() => handleToggleStatus(seller, 'ACTIVE')}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Activar</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleStatus(seller, 'DISABLED')}
                      className="px-3 py-1.5 rounded-xl bg-stone-100 border border-stone-300 hover:bg-red-50 hover:text-red-800 hover:border-red-200 text-stone-600 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      <span>Desactivar</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: ADD NEW SELLER */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-stone-200 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-bold text-stone-900">Nuevo Vendedor</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSeller} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-stone-700 mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Laura Martínez"
                  value={newSellerName}
                  onChange={(e) => setNewSellerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-stone-700 mb-1">
                  Email de Acceso *
                </label>
                <input
                  type="email"
                  required
                  placeholder="vendedor@kiosco.com"
                  value={newSellerEmail}
                  onChange={(e) => setNewSellerEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-stone-700 mb-1">
                  Contraseña Inicial
                </label>
                <input
                  type="text"
                  placeholder="123"
                  value={newSellerPassword}
                  onChange={(e) => setNewSellerPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                />
              </div>

              <div className="pt-2 border-t border-stone-100">
                <p className="text-xs font-extrabold uppercase tracking-wider text-stone-700 mb-2">
                  Permisos Iniciales del Vendedor
                </p>
                <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200 text-xs space-y-2">
                  <label className="flex items-center space-x-2 cursor-pointer font-semibold text-stone-800">
                    <input
                      type="checkbox"
                      checked={newSellerPermissions.sales.create}
                      onChange={(e) =>
                        setNewSellerPermissions({
                          ...newSellerPermissions,
                          sales: { ...newSellerPermissions.sales, create: e.target.checked }
                        })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span>Crear ventas en punto de venta</span>
                  </label>

                  <label className="flex items-center space-x-2 cursor-pointer font-semibold text-stone-800">
                    <input
                      type="checkbox"
                      checked={newSellerPermissions.inventory.view}
                      onChange={(e) =>
                        setNewSellerPermissions({
                          ...newSellerPermissions,
                          inventory: { ...newSellerPermissions.inventory, view: e.target.checked }
                        })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
                    />
                    <span>Consultar stock de productos</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingNewSeller}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-2xs transition-colors cursor-pointer"
                >
                  {savingNewSeller ? 'Creando...' : 'Crear Vendedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT SELLER INFORMATION */}
      {editingSeller && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 className="text-lg font-bold text-stone-900">Editar Información</h3>
              <button onClick={() => setEditingSeller(null)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-stone-700 mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold uppercase tracking-wider text-stone-700 mb-1">
                  Email (Solo Lectura)
                </label>
                <input
                  type="text"
                  disabled
                  value={editingSeller.email}
                  className="w-full px-3.5 py-2.5 border border-stone-200 bg-stone-100 text-stone-600 rounded-xl text-sm font-mono cursor-not-allowed"
                />
                <p className="text-[11px] text-stone-500 mt-1 flex items-center gap-1">
                  <Info className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                  El correo electrónico de acceso principal no se modifica desde aquí.
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setEditingSeller(null)}
                  className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-2xs transition-colors cursor-pointer"
                >
                  {savingEdit ? 'Guardando...' : 'Guardar Cambios'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: GESTIONAR PERMISOS GRANULARES */}
      {permissionsSeller && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-stone-200 space-y-5 my-8">
            
            {/* Header */}
            <div className="flex items-start justify-between border-b border-stone-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-600" />
                  <h3 className="text-lg font-bold text-stone-900">Configuración de Permisos</h3>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Vendedor: <span className="font-bold text-stone-800">{permissionsSeller.displayName}</span> ({permissionsSeller.email})
                </p>
              </div>
              <button
                onClick={() => setPermissionsSeller(null)}
                className="p-1 text-stone-400 hover:text-stone-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePermissions} className="space-y-5">
              
              {/* Category 1: Ventas */}
              <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-200 space-y-2.5">
                <h4 className="text-xs font-extrabold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                  <ShoppingCart className="w-4 h-4 text-emerald-600" />
                  Ventas
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center space-x-2.5 p-2 bg-white rounded-xl border border-stone-200 cursor-pointer hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={editPermissions.sales.create}
                      onChange={(e) =>
                        setEditPermissions({
                          ...editPermissions,
                          sales: { ...editPermissions.sales, create: e.target.checked }
                        })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="font-bold text-stone-800">Crear ventas</span>
                  </label>

                  <label className="flex items-center space-x-2.5 p-2 bg-white rounded-xl border border-stone-200 cursor-pointer hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={editPermissions.sales.view}
                      onChange={(e) =>
                        setEditPermissions({
                          ...editPermissions,
                          sales: { ...editPermissions.sales, view: e.target.checked }
                        })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="font-bold text-stone-800">Consultar ventas</span>
                  </label>
                </div>
              </div>

              {/* Category 2: Inventario */}
              <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-200 space-y-2.5">
                <h4 className="text-xs font-extrabold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-indigo-600" />
                  Inventario
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <label className="flex items-center space-x-2.5 p-2 bg-white rounded-xl border border-stone-200 cursor-pointer hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={editPermissions.inventory.view}
                      onChange={(e) =>
                        setEditPermissions({
                          ...editPermissions,
                          inventory: { ...editPermissions.inventory, view: e.target.checked }
                        })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="font-bold text-stone-800">Consultar stock</span>
                  </label>

                  <label className="flex items-center space-x-2.5 p-2 bg-white rounded-xl border border-stone-200 cursor-pointer hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={editPermissions.inventory.receive}
                      onChange={(e) =>
                        setEditPermissions({
                          ...editPermissions,
                          inventory: { ...editPermissions.inventory, receive: e.target.checked }
                        })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="font-bold text-stone-800">Recibir productos</span>
                  </label>

                  <label className="flex items-center space-x-2.5 p-2 bg-white rounded-xl border border-stone-200 cursor-pointer hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={editPermissions.inventory.stockEntry}
                      onChange={(e) =>
                        setEditPermissions({
                          ...editPermissions,
                          inventory: { ...editPermissions.inventory, stockEntry: e.target.checked }
                        })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="font-bold text-stone-800">Ingresar productos al stock</span>
                  </label>
                </div>
              </div>

              {/* Category 3: Recepciones */}
              <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-200 space-y-2.5">
                <h4 className="text-xs font-extrabold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                  <ArrowDownLeft className="w-4 h-4 text-purple-600" />
                  Recepciones
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <label className="flex items-center space-x-2.5 p-2 bg-white rounded-xl border border-stone-200 cursor-pointer hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={editPermissions.receiving.create}
                      onChange={(e) =>
                        setEditPermissions({
                          ...editPermissions,
                          receiving: { ...editPermissions.receiving, create: e.target.checked }
                        })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="font-bold text-stone-800">Crear recepciones</span>
                  </label>

                  <label className="flex items-center space-x-2.5 p-2 bg-white rounded-xl border border-stone-200 cursor-pointer hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={editPermissions.receiving.view}
                      onChange={(e) =>
                        setEditPermissions({
                          ...editPermissions,
                          receiving: { ...editPermissions.receiving, view: e.target.checked }
                        })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="font-bold text-stone-800">Consultar recepciones</span>
                  </label>

                  <label className="flex items-center space-x-2.5 p-2 bg-white rounded-xl border border-stone-200 cursor-pointer hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={editPermissions.receiving.confirm}
                      onChange={(e) =>
                        setEditPermissions({
                          ...editPermissions,
                          receiving: { ...editPermissions.receiving, confirm: e.target.checked }
                        })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="font-bold text-stone-800">Confirmar recepciones</span>
                  </label>
                </div>
              </div>

              {/* Category 4: Compras */}
              <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-200 space-y-2.5">
                <h4 className="text-xs font-extrabold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-amber-600" />
                  Compras
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center space-x-2.5 p-2 bg-white rounded-xl border border-stone-200 cursor-pointer hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={editPermissions.purchases.create}
                      onChange={(e) =>
                        setEditPermissions({
                          ...editPermissions,
                          purchases: { ...editPermissions.purchases, create: e.target.checked }
                        })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="font-bold text-stone-800">Registrar compras</span>
                  </label>

                  <label className="flex items-center space-x-2.5 p-2 bg-white rounded-xl border border-stone-200 cursor-pointer hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={editPermissions.purchases.view}
                      onChange={(e) =>
                        setEditPermissions({
                          ...editPermissions,
                          purchases: { ...editPermissions.purchases, view: e.target.checked }
                        })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="font-bold text-stone-800">Consultar compras</span>
                  </label>
                </div>
              </div>

              {/* Category 5: Caja */}
              <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-200 space-y-2.5">
                <h4 className="text-xs font-extrabold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-stone-700" />
                  Caja
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className="flex items-center space-x-2.5 p-2 bg-white rounded-xl border border-stone-200 cursor-pointer hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={editPermissions.cash.view}
                      onChange={(e) =>
                        setEditPermissions({
                          ...editPermissions,
                          cash: { ...editPermissions.cash, view: e.target.checked }
                        })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="font-bold text-stone-800">Consultar caja</span>
                  </label>

                  <label className="flex items-center space-x-2.5 p-2 bg-white rounded-xl border border-stone-200 cursor-pointer hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={editPermissions.cash.purchasePayment}
                      onChange={(e) =>
                        setEditPermissions({
                          ...editPermissions,
                          cash: { ...editPermissions.cash, purchasePayment: e.target.checked }
                        })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="font-bold text-stone-800">Registrar pagos de compras</span>
                  </label>
                </div>
              </div>

              {/* Category 6: Solicitud */}
              <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-200 space-y-2.5">
                <h4 className="text-xs font-extrabold text-stone-900 uppercase tracking-wider flex items-center gap-1.5">
                  <ClipboardList className="w-4 h-4 text-indigo-600" />
                  Solicitud de Stock
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  <label className="flex items-center space-x-2.5 p-2 bg-white rounded-xl border border-stone-200 cursor-pointer hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={editPermissions.replenishment?.view ?? false}
                      onChange={(e) =>
                        setEditPermissions({
                          ...editPermissions,
                          replenishment: {
                            create: editPermissions.replenishment?.create ?? false,
                            view: e.target.checked,
                            export: editPermissions.replenishment?.export ?? false
                          }
                        })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="font-bold text-stone-800">Consultar solicitudes</span>
                  </label>

                  <label className="flex items-center space-x-2.5 p-2 bg-white rounded-xl border border-stone-200 cursor-pointer hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={editPermissions.replenishment?.create ?? false}
                      onChange={(e) =>
                        setEditPermissions({
                          ...editPermissions,
                          replenishment: {
                            create: e.target.checked,
                            view: editPermissions.replenishment?.view ?? false,
                            export: editPermissions.replenishment?.export ?? false
                          }
                        })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="font-bold text-stone-800">Crear solicitudes</span>
                  </label>

                  <label className="flex items-center space-x-2.5 p-2 bg-white rounded-xl border border-stone-200 cursor-pointer hover:bg-stone-50">
                    <input
                      type="checkbox"
                      checked={editPermissions.replenishment?.export ?? false}
                      onChange={(e) =>
                        setEditPermissions({
                          ...editPermissions,
                          replenishment: {
                            create: editPermissions.replenishment?.create ?? false,
                            view: editPermissions.replenishment?.view ?? false,
                            export: e.target.checked
                          }
                        })
                      }
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <span className="font-bold text-stone-800">Generar pedidos</span>
                  </label>
                </div>
              </div>

              {/* Submit / Cancel */}
              <div className="flex justify-end space-x-3 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setPermissionsSeller(null)}
                  className="px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingPermissions}
                  className="px-6 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-2xs transition-colors cursor-pointer"
                >
                  {savingPermissions ? 'Guardando...' : 'Guardar Permisos'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
