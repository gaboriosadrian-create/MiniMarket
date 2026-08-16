import React, { useState, useEffect } from 'react';
import { Business, CreateBusinessInput } from '../types';
import { getAllBusinesses, createBusinessWithAdmin, toggleBusinessStatus } from '../lib/businessService';
import { 
  Building2, 
  Plus, 
  Search, 
  CheckCircle2, 
  XCircle, 
  UserCheck, 
  Calendar, 
  RefreshCw, 
  Eye, 
  AlertCircle, 
  ShieldCheck, 
  X,
  Mail,
  Lock,
  User
} from 'lucide-react';

export const SuperAdminDashboard: React.FC = () => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null);

  // Form states
  const [formData, setFormData] = useState<CreateBusinessInput>({
    businessName: '',
    adminName: '',
    adminEmail: '',
    adminPassword: '123'
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadBusinesses = async () => {
    setLoading(true);
    try {
      const data = await getAllBusinesses();
      setBusinesses(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBusinesses();
  }, []);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.businessName.trim() || !formData.adminName.trim() || !formData.adminEmail.trim()) {
      setFormError('Por favor complete todos los campos requeridos.');
      return;
    }

    setSaving(true);
    try {
      await createBusinessWithAdmin(formData);
      setFormData({
        businessName: '',
        adminName: '',
        adminEmail: '',
        adminPassword: '123'
      });
      setShowCreateModal(false);
      await loadBusinesses();
    } catch (err: any) {
      console.error(err);
      setFormError('Error al crear el negocio: ' + (err.message || 'Intente nuevamente'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (biz: Business) => {
    try {
      await toggleBusinessStatus(biz.id, biz.status);
      await loadBusinesses();
    } catch (err: any) {
      alert('Error al cambiar estado: ' + err.message);
    }
  };

  const filteredBusinesses = businesses.filter((b) => {
    const matchesSearch = b.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (b.adminEmail && b.adminEmail.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (b.adminName && b.adminName.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-2xl p-6 sm:p-8 text-white shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-6 h-6 text-purple-300" />
            <span className="text-xs font-bold uppercase tracking-wider text-purple-200">Panel Super Admin</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1">
            Gestión Global de Negocios
          </h2>
          <p className="text-purple-100 text-sm mt-1 max-w-2xl">
            Crea, activa o administra todos los minimarkets y kioscos en la plataforma.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          id="btn-open-create-business"
          className="inline-flex items-center space-x-2 px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm shadow-md transition-all shrink-0 hover:scale-[1.02]"
        >
          <Plus className="w-5 h-5" />
          <span>+ Crear negocio</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Total Negocios</p>
            <p className="text-2xl font-black text-stone-900">{businesses.length}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Negocios Activos</p>
            <p className="text-2xl font-black text-stone-900">
              {businesses.filter((b) => b.status === 'active').length}
            </p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-2xs flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold">
            <XCircle className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Negocios Inactivos</p>
            <p className="text-2xl font-black text-stone-900">
              {businesses.filter((b) => b.status === 'inactive').length}
            </p>
          </div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-6 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Search */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Buscar negocio o administrador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            />
          </div>

          {/* Status Filter & Refresh */}
          <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-stone-300 rounded-xl text-sm font-medium text-stone-700 bg-stone-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">Todos los estados</option>
              <option value="active">Solo Activos</option>
              <option value="inactive">Solo Inactivos</option>
            </select>

            <button
              onClick={loadBusinesses}
              disabled={loading}
              className="p-2 text-stone-500 hover:text-stone-800 rounded-xl hover:bg-stone-100 border border-stone-200 transition-colors"
              title="Recargar lista"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Businesses Table */}
        <div className="overflow-x-auto border border-stone-200 rounded-xl">
          <table className="min-w-full divide-y divide-stone-200">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-stone-500 uppercase tracking-wider">
                  Negocio
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-stone-500 uppercase tracking-wider">
                  Administrador
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-stone-500 uppercase tracking-wider">
                  Estado
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-stone-500 uppercase tracking-wider">
                  Fecha Creación
                </th>
                <th className="px-6 py-3.5 text-right text-xs font-bold text-stone-500 uppercase tracking-wider">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-stone-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-stone-500 text-sm">
                    Cargando negocios...
                  </td>
                </tr>
              ) : filteredBusinesses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-stone-500 text-sm">
                    No se encontraron negocios. {searchTerm && 'Prueba ajustando el filtro.'}
                  </td>
                </tr>
              ) : (
                filteredBusinesses.map((biz) => (
                  <tr key={biz.id} className="hover:bg-stone-50/80 transition-colors">
                    
                    {/* Name */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-lg bg-stone-100 border border-stone-200 flex items-center justify-center font-bold text-stone-700">
                          <Building2 className="w-5 h-5 text-stone-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-stone-900">{biz.name}</p>
                          <p className="text-xs text-stone-400 font-mono">ID: {biz.id}</p>
                        </div>
                      </div>
                    </td>

                    {/* Admin */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-stone-800">{biz.adminName || 'Admin asignado'}</div>
                      <div className="text-xs text-stone-500">{biz.adminEmail || '-'}</div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      {biz.status === 'active' ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
                          Activo
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" />
                          Inactivo
                        </span>
                      )}
                    </td>

                    {/* Created Date */}
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-stone-500">
                      {biz.createdAt ? new Date(biz.createdAt).toLocaleDateString('es-AR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric'
                      }) : '-'}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      <button
                        onClick={() => setSelectedBusiness(biz)}
                        className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-stone-100 text-stone-700 hover:bg-stone-200 transition-colors"
                        title="Ver detalle"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" /> Ver
                      </button>

                      <button
                        onClick={() => handleToggleStatus(biz)}
                        className={`inline-flex items-center px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                          biz.status === 'active'
                            ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                        }`}
                        title={biz.status === 'active' ? 'Desactivar negocio' : 'Activar negocio'}
                      >
                        {biz.status === 'active' ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* MODAL: Crear Negocio */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-5 animate-in fade-in zoom-in duration-150">
            
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Building2 className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-stone-900">Crear Nuevo Negocio</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-stone-400 hover:text-stone-600 p-1 rounded-lg hover:bg-stone-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="rounded-xl bg-red-50 p-3.5 border border-red-200 flex items-start space-x-2 text-xs text-red-800">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Nombre del negocio *
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="Ej: Kiosco Belgrano"
                    value={formData.businessName}
                    onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Nombre del Administrador *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    placeholder="Ej: Juan Pérez"
                    value={formData.adminName}
                    onChange={(e) => setFormData({ ...formData, adminName: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Email del Administrador *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    placeholder="admin.belgrano@kiosco.com"
                    value={formData.adminEmail}
                    onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Contraseña Inicial del Administrador
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    placeholder="123"
                    value={formData.adminPassword}
                    onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  El Administrador podrá ingresar inmediatamente con estas credenciales.
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  id="btn-confirm-create-business"
                  className="px-5 py-2 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors disabled:opacity-50"
                >
                  {saving ? 'Creando...' : 'Crear e Iniciar Operación'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

      {/* MODAL: Ver Detalle del Negocio */}
      {selectedBusiness && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="text-lg font-bold text-stone-900">{selectedBusiness.name}</h3>
              <button
                onClick={() => setSelectedBusiness(null)}
                className="text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
                <span className="text-xs font-bold text-stone-500 uppercase block">ID Negocio / Tenant ID</span>
                <span className="font-mono text-stone-800 text-xs">{selectedBusiness.id}</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
                  <span className="text-xs font-bold text-stone-500 uppercase block">Estado</span>
                  <span className={`font-semibold ${selectedBusiness.status === 'active' ? 'text-emerald-700' : 'text-red-700'}`}>
                    {selectedBusiness.status === 'active' ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                <div className="bg-stone-50 p-3 rounded-xl border border-stone-200">
                  <span className="text-xs font-bold text-stone-500 uppercase block">Creación</span>
                  <span className="text-stone-800 font-medium text-xs">
                    {new Date(selectedBusiness.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="bg-purple-50 p-3 rounded-xl border border-purple-200">
                <span className="text-xs font-bold text-purple-700 uppercase block">Administrador del Negocio</span>
                <p className="text-stone-900 font-bold">{selectedBusiness.adminName || 'Admin'}</p>
                <p className="text-xs text-stone-600">{selectedBusiness.adminEmail}</p>
                <p className="text-[11px] text-purple-600 font-mono mt-1">UID: {selectedBusiness.adminUserId}</p>
              </div>
            </div>

            <div className="pt-3 border-t border-stone-200 flex justify-end">
              <button
                onClick={() => setSelectedBusiness(null)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-sm font-semibold rounded-xl"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
