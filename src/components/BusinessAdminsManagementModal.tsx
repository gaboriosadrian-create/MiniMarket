import React, { useState, useEffect } from 'react';
import { 
  Business, 
  UserProfile, 
  RegisterAdminInput, 
  UserStatus
} from '../types';
import { 
  getAdminsByBusiness, 
  registerAdminForBusiness, 
  updateAdminProfile, 
  updateAdminStatus,
  updateBusinessInfo
} from '../lib/businessService';
import { 
  Building2, 
  Users, 
  UserPlus, 
  Mail, 
  Phone, 
  MapPin, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Save, 
  Edit3, 
  RefreshCw, 
  UserCheck, 
  UserX, 
  ShieldCheck, 
  Search, 
  Store, 
  Lock
} from 'lucide-react';

const BUSINESS_TYPES = [
  'Minimarket',
  'Kiosco',
  'Almacén',
  'Despensa',
  'Librería',
  'Cafetería',
  'Fiambrería',
  'Carnicería',
  'Verdulería',
  'Otro',
];

interface BusinessAdminsManagementModalProps {
  business: Business;
  superAdminUser: { uid: string; email: string };
  initialTab?: 'business' | 'admins';
  onClose: () => void;
  onBusinessUpdated: (updated?: Business) => void;
}

export const BusinessAdminsManagementModal: React.FC<BusinessAdminsManagementModalProps> = ({
  business,
  superAdminUser,
  initialTab = 'admins',
  onClose,
  onBusinessUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'business' | 'admins'>(initialTab);

  // Business Form State
  const [businessData, setBusinessData] = useState({
    name: business.name || '',
    legalName: business.legalName || '',
    taxId: business.taxId || '',
    businessType: business.businessType || 'Minimarket',
    address: business.address || '',
    phone: business.phone || '',
    email: business.email || '',
    status: business.status || 'active',
  });
  const [savingBusiness, setSavingBusiness] = useState(false);

  // Admins List State
  const [admins, setAdmins] = useState<UserProfile[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [searchAdmin, setSearchAdmin] = useState('');

  // Add Admin Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [adminLastName, setAdminLastName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [savingAdmin, setSavingAdmin] = useState(false);

  // Edit Existing Admin State
  const [editingAdmin, setEditingAdmin] = useState<UserProfile | null>(null);
  const [editAdminName, setEditAdminName] = useState('');
  const [editAdminPhone, setEditAdminPhone] = useState('');
  const [savingAdminEdit, setSavingAdminEdit] = useState(false);

  // Notification / Feedback State
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showSuccess = (msg: string) => {
    setFeedback({ type: 'success', message: msg });
    setTimeout(() => setFeedback(null), 5500);
  };

  const showError = (msg: string) => {
    setFeedback({ type: 'error', message: msg });
    setTimeout(() => setFeedback(null), 5500);
  };

  // Load admins
  const loadAdmins = async () => {
    setLoadingAdmins(true);
    try {
      const list = await getAdminsByBusiness(business.id);
      setAdmins(list);
    } catch (err: any) {
      console.error('Error cargando administradores:', err);
      showError('Error al cargar la lista de administradores.');
    } finally {
      setLoadingAdmins(false);
    }
  };

  useEffect(() => {
    loadAdmins();
  }, [business.id]);

  // Handle Business Info Save
  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessData.name.trim()) {
      showError('El nombre comercial del negocio es obligatorio.');
      return;
    }

    setSavingBusiness(true);
    try {
      await updateBusinessInfo(
        business.id,
        {
          name: businessData.name,
          legalName: businessData.legalName,
          taxId: businessData.taxId,
          businessType: businessData.businessType,
          address: businessData.address,
          phone: businessData.phone,
          email: businessData.email,
          status: businessData.status as any,
        },
        superAdminUser
      );
      showSuccess('Información del comercio actualizada exitosamente.');
      const updatedBusiness: Business = {
        ...business,
        name: businessData.name,
        legalName: businessData.legalName,
        taxId: businessData.taxId,
        businessType: businessData.businessType,
        address: businessData.address,
        phone: businessData.phone,
        email: businessData.email,
        status: businessData.status as any,
      };
      onBusinessUpdated(updatedBusiness);
    } catch (err: any) {
      console.error('Error guardando comercio:', err);
      showError(err.message || 'Error al actualizar información del negocio.');
    } finally {
      setSavingBusiness(false);
    }
  };

  // Handle Register / Pre-Authorize New Admin
  const handleRegisterAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = adminEmail.trim().toLowerCase();
    const cleanName = adminName.trim();
    const cleanLastName = adminLastName.trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!cleanName) {
      showError('Por favor ingrese el nombre del administrador.');
      return;
    }
    if (!cleanEmail || !emailRegex.test(cleanEmail)) {
      showError('Por favor ingrese un correo electrónico válido.');
      return;
    }

    setSavingAdmin(true);
    try {
      const payload: RegisterAdminInput = {
        businessId: business.id,
        name: cleanName,
        lastName: cleanLastName || undefined,
        email: cleanEmail,
        phone: adminPhone.trim() || undefined,
      };

      await registerAdminForBusiness(payload, superAdminUser);

      showSuccess('Administrador registrado correctamente. Podrá ingresar a Uwi utilizando la misma cuenta de Google asociada al correo registrado.');

      // Reset form
      setAdminName('');
      setAdminLastName('');
      setAdminEmail('');
      setAdminPhone('');
      setShowAddForm(false);
      await loadAdmins();
      onBusinessUpdated();
    } catch (err: any) {
      console.error('Error registrando administrador:', err);
      showError(err.message || 'Error al registrar administrador.');
    } finally {
      setSavingAdmin(false);
    }
  };

  // Handle Status Toggle (Active vs Disabled)
  const handleToggleAdminStatus = async (admin: UserProfile) => {
    const isCurrentlyActive = admin.active && admin.status !== 'DISABLED';
    const nextStatus: UserStatus = isCurrentlyActive ? 'DISABLED' : 'ACTIVE';
    const actionWord = isCurrentlyActive ? 'desactivar' : 'activar';

    if (!window.confirm(`¿Seguro que deseás ${actionWord} el acceso de ${admin.displayName} (${admin.email})?`)) {
      return;
    }

    try {
      await updateAdminStatus(admin.uid, nextStatus, business.id, superAdminUser, admin.email);
      showSuccess(`Acceso del administrador ${isCurrentlyActive ? 'desactivado' : 'activado'} correctamente.`);
      await loadAdmins();
    } catch (err: any) {
      showError(err.message || 'Error al cambiar estado del administrador.');
    }
  };

  // Handle Edit Admin Profile
  const handleStartEditAdmin = (admin: UserProfile) => {
    setEditingAdmin(admin);
    setEditAdminName(admin.displayName || '');
    setEditAdminPhone(admin.phone || '');
  };

  const handleSaveAdminProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin || !editAdminName.trim()) return;

    setSavingAdminEdit(true);
    try {
      await updateAdminProfile(
        editingAdmin.uid,
        {
          displayName: editAdminName.trim(),
          phone: editAdminPhone.trim(),
        },
        business.id,
        superAdminUser,
        editingAdmin.email
      );
      showSuccess('Datos del administrador actualizados.');
      setEditingAdmin(null);
      await loadAdmins();
    } catch (err: any) {
      showError(err.message || 'Error al actualizar administrador.');
    } finally {
      setSavingAdminEdit(false);
    }
  };

  // Filtered admins list
  const filteredAdmins = admins.filter((a) => {
    const term = searchAdmin.toLowerCase().trim();
    if (!term) return true;
    return (
      (a.displayName || '').toLowerCase().includes(term) ||
      (a.email || '').toLowerCase().includes(term) ||
      (a.phone || '').toLowerCase().includes(term)
    );
  });

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-stone-900 via-purple-950 to-stone-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600 flex items-center justify-center font-bold text-white shadow-xs">
              <Store className="w-5 h-5 text-purple-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  {business.name}
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/30 text-purple-200 border border-purple-400/30">
                  ID: {business.id}
                </span>
              </div>
              <p className="text-xs text-purple-200/80">
                Gestión de información comercial y administradores asignados (1:N)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-stone-200 bg-stone-50 px-4 sm:px-6 pt-3 gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('admins')}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'admins'
                ? 'border-purple-600 text-purple-700 bg-white rounded-t-lg px-3 shadow-xs'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Administradores</span>
            <span className="ml-1 text-[11px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-black">
              {admins.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('business')}
            className={`pb-2.5 px-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'business'
                ? 'border-purple-600 text-purple-700 bg-white rounded-t-lg px-3 shadow-xs'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Información del Comercio</span>
          </button>
        </div>

        {/* Global Feedback Banner */}
        {feedback && (
          <div className="px-4 sm:px-6 pt-3 shrink-0">
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-center space-x-2 animate-in fade-in duration-150 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          </div>
        )}

        {/* Main Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* TAB 1: ADMINS MANAGEMENT */}
          {activeTab === 'admins' && (
            <div className="space-y-5">
              
              {/* Header Bar with Action Button */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-stone-50 p-4 rounded-xl border border-stone-200">
                <div>
                  <h4 className="text-sm font-black text-stone-900 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-purple-600" />
                    <span>Equipo de Administradores del Negocio</span>
                  </h4>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Podés asignar múltiples administradores. Cada uno cuenta con acceso de gestión completa para este comercio.
                  </p>
                </div>

                {!showAddForm && (
                  <button
                    type="button"
                    id="btn-open-add-admin"
                    onClick={() => setShowAddForm(true)}
                    className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-xl text-xs font-black shadow-xs transition-all flex items-center gap-2 cursor-pointer hover:scale-[1.02] shrink-0"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Agregar Administrador</span>
                  </button>
                )}
              </div>

              {/* ADD ADMIN FORM CARD */}
              {showAddForm && (
                <div className="bg-purple-50/50 border-2 border-purple-200 rounded-2xl p-4 sm:p-5 space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-purple-700 text-white flex items-center justify-center">
                        <UserPlus className="w-4 h-4" />
                      </div>
                      <h5 className="text-sm font-black text-purple-950">
                        Registrar Administrador
                      </h5>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="text-stone-400 hover:text-stone-700 p-1 rounded-md cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleRegisterAdmin} className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                          Nombre *
                        </label>
                        <input
                          type="text"
                          required
                          value={adminName}
                          onChange={(e) => setAdminName(e.target.value)}
                          placeholder="Ej: Marcelo"
                          className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                          Apellido (Opcional)
                        </label>
                        <input
                          type="text"
                          value={adminLastName}
                          onChange={(e) => setAdminLastName(e.target.value)}
                          placeholder="Ej: Gómez"
                          className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                          Gmail / Correo Electrónico *
                        </label>
                        <input
                          type="email"
                          required
                          value={adminEmail}
                          onChange={(e) => setAdminEmail(e.target.value)}
                          placeholder="ejemplo@gmail.com"
                          className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                          Teléfono (Opcional)
                        </label>
                        <input
                          type="tel"
                          value={adminPhone}
                          onChange={(e) => setAdminPhone(e.target.value)}
                          placeholder="Ej: +54 9 11 2345-6789"
                          className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                        />
                      </div>
                    </div>

                    <div className="rounded-xl bg-blue-50/80 border border-blue-200/80 p-3 flex items-start space-x-2.5 text-xs text-blue-900">
                      <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="font-bold text-blue-950">
                          Acceso autenticado con Google
                        </p>
                        <p className="text-blue-800 text-[11px] leading-relaxed">
                          El administrador ingresará a Uwi utilizando la misma cuenta de Google asociada al correo registrado. No requiere contraseña ni configuración adicional.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-end space-x-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowAddForm(false)}
                        className="px-3 py-1.5 text-xs font-bold text-stone-600 hover:bg-stone-200/60 rounded-xl transition-colors cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        id="btn-submit-add-admin"
                        disabled={savingAdmin}
                        className="px-4 py-2 text-xs font-black text-white bg-purple-700 hover:bg-purple-800 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{savingAdmin ? 'Guardando...' : 'Guardar Administrador'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* EDIT ADMIN INLINE FORM */}
              {editingAdmin && (
                <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-4 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-black text-amber-950 flex items-center gap-2">
                      <Edit3 className="w-3.5 h-3.5 text-amber-700" />
                      <span>Editar Datos del Administrador: {editingAdmin.email}</span>
                    </h5>
                    <button
                      type="button"
                      onClick={() => setEditingAdmin(null)}
                      className="text-stone-400 hover:text-stone-700 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleSaveAdminProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                        Nombre Completo
                      </label>
                      <input
                        type="text"
                        required
                        value={editAdminName}
                        onChange={(e) => setEditAdminName(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 uppercase tracking-wider mb-1">
                        Teléfono
                      </label>
                      <input
                        type="tel"
                        value={editAdminPhone}
                        onChange={(e) => setEditAdminPhone(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                      />
                    </div>
                    <div className="sm:col-span-2 flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingAdmin(null)}
                        className="px-3 py-1.5 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={savingAdminEdit}
                        className="px-4 py-1.5 text-xs font-black text-white bg-amber-700 hover:bg-amber-800 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Guardar Cambios</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* SEARCH FILTER & LIST */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchAdmin}
                      onChange={(e) => setSearchAdmin(e.target.value)}
                      placeholder="Buscar por nombre o email..."
                      className="w-full pl-9 pr-3 py-1.5 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={loadAdmins}
                    className="text-xs font-bold text-stone-500 hover:text-stone-800 flex items-center gap-1 self-end sm:self-auto cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingAdmins ? 'animate-spin' : ''}`} />
                    <span>Actualizar Lista</span>
                  </button>
                </div>

                {/* Admins Table */}
                <div className="border border-stone-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                  {loadingAdmins ? (
                    <div className="p-8 text-center text-xs text-stone-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto text-purple-600 mb-2" />
                      <span>Cargando administradores...</span>
                    </div>
                  ) : filteredAdmins.length === 0 ? (
                    <div className="p-8 text-center text-stone-500 space-y-2">
                      <Users className="w-8 h-8 text-stone-300 mx-auto" />
                      <p className="text-xs font-bold text-stone-700">No se encontraron administradores.</p>
                      <p className="text-[11px] text-stone-400">Podés registrar al primer administrador con el botón superior.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs text-stone-700">
                        <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 font-bold uppercase text-[10px] tracking-wider">
                          <tr>
                            <th className="py-3 px-4">Administrador</th>
                            <th className="py-3 px-4">Email</th>
                            <th className="py-3 px-4">Estado</th>
                            <th className="py-3 px-4">Fecha de Alta</th>
                            <th className="py-3 px-4 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 font-medium">
                          {filteredAdmins.map((admin) => {
                            const isInactive = !admin.active || admin.status === 'DISABLED';
                            const isBlocked = admin.status === 'BLOCKED';

                            return (
                              <tr key={admin.uid} className="hover:bg-stone-50/70 transition-colors">
                                <td className="py-3 px-4">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-800 font-black text-xs flex items-center justify-center shrink-0">
                                      {(admin.displayName || admin.email || 'A').charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <p className="font-bold text-stone-900">{admin.displayName || 'Sin nombre'}</p>
                                      {admin.phone && (
                                        <p className="text-[11px] text-stone-400 flex items-center gap-1">
                                          <Phone className="w-3 h-3 text-stone-400" />
                                          <span>{admin.phone}</span>
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                <td className="py-3 px-4 font-mono text-[11px] text-purple-900 font-semibold">
                                  {admin.email}
                                </td>

                                <td className="py-3 px-4">
                                  {isBlocked ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-800 border border-red-200">
                                      <Lock className="w-3 h-3 text-red-600" />
                                      <span>Bloqueado</span>
                                    </span>
                                  ) : isInactive ? (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-stone-100 text-stone-600 border border-stone-200">
                                      <UserX className="w-3 h-3 text-stone-500" />
                                      <span>Desactivado</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                      <span>Activo</span>
                                    </span>
                                  )}
                                </td>

                                <td className="py-3 px-4 text-stone-500 text-[11px]">
                                  {admin.createdAt ? (
                                    <span>
                                      {new Date(admin.createdAt).toLocaleDateString('es-AR', {
                                        day: '2-digit',
                                        month: '2-digit',
                                        year: 'numeric',
                                      })}
                                    </span>
                                  ) : (
                                    <span className="text-stone-400">—</span>
                                  )}
                                </td>

                                <td className="py-3 px-4 text-right">
                                  <div className="flex items-center justify-end space-x-1">
                                    
                                    {/* Edit Name / Phone */}
                                    <button
                                      type="button"
                                      title="Editar datos"
                                      onClick={() => handleStartEditAdmin(admin)}
                                      className="p-1.5 text-stone-500 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>

                                    {/* Toggle Active / Disabled */}
                                    <button
                                      type="button"
                                      title={isInactive ? 'Activar acceso' : 'Desactivar acceso'}
                                      onClick={() => handleToggleAdminStatus(admin)}
                                      className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                        isInactive
                                          ? 'text-emerald-600 hover:bg-emerald-50'
                                          : 'text-stone-400 hover:text-red-600 hover:bg-red-50'
                                      }`}
                                    >
                                      {isInactive ? (
                                        <UserCheck className="w-3.5 h-3.5" />
                                      ) : (
                                        <UserX className="w-3.5 h-3.5" />
                                      )}
                                    </button>

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
              </div>

            </div>
          )}

          {/* TAB 2: BUSINESS PROFILE EDIT */}
          {activeTab === 'business' && (
            <form onSubmit={handleSaveBusiness} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Nombre Comercial *
                  </label>
                  <div className="relative">
                    <Store className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={businessData.name}
                      onChange={(e) => setBusinessData({ ...businessData, name: e.target.value })}
                      placeholder="Ej: Minimarket Norte"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Razón Social
                  </label>
                  <div className="relative">
                    <FileText className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                    <input
                      type="text"
                      value={businessData.legalName}
                      onChange={(e) => setBusinessData({ ...businessData, legalName: e.target.value })}
                      placeholder="Ej: Norte S.R.L."
                      className="w-full pl-9 pr-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    CUIT / Identificación Tributaria
                  </label>
                  <input
                    type="text"
                    value={businessData.taxId}
                    onChange={(e) => setBusinessData({ ...businessData, taxId: e.target.value })}
                    placeholder="Ej: 30-71234567-8"
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Rubro o Tipo de Comercio
                  </label>
                  <select
                    value={businessData.businessType}
                    onChange={(e) => setBusinessData({ ...businessData, businessType: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-hidden cursor-pointer"
                  >
                    {BUSINESS_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Dirección Física
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                    <input
                      type="text"
                      value={businessData.address}
                      onChange={(e) => setBusinessData({ ...businessData, address: e.target.value })}
                      placeholder="Ej: Av. San Martín 1234"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Teléfono de Contacto
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                    <input
                      type="tel"
                      value={businessData.phone}
                      onChange={(e) => setBusinessData({ ...businessData, phone: e.target.value })}
                      placeholder="Ej: +54 11 4444-5555"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Correo Electrónico Institucional
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                    <input
                      type="email"
                      value={businessData.email}
                      onChange={(e) => setBusinessData({ ...businessData, email: e.target.value })}
                      placeholder="contacto@negocio.com"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                    Estado del Comercio
                  </label>
                  <select
                    value={businessData.status}
                    onChange={(e) => setBusinessData({ ...businessData, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-white border border-stone-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-purple-500 focus:outline-hidden cursor-pointer"
                  >
                    <option value="active">Activo (Habilitado)</option>
                    <option value="inactive">Inactivo (Suspendido)</option>
                  </select>
                </div>

              </div>

              <div className="pt-3 border-t border-stone-200 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  id="btn-save-business-info"
                  disabled={savingBusiness}
                  className="px-5 py-2 text-xs font-black text-white bg-purple-700 hover:bg-purple-800 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingBusiness ? 'Guardando...' : 'Guardar Información'}</span>
                </button>
              </div>
            </form>
          )}

        </div>

        {/* Modal Footer Summary */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 text-xs text-stone-500 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-semibold text-stone-700">Aislamiento Multi-Tenant garantizado</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-stone-600 hover:text-stone-900 cursor-pointer"
          >
            Listo
          </button>
        </div>

      </div>
    </div>
  );
};
