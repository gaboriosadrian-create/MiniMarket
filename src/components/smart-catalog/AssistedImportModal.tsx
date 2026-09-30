import React, { useState } from 'react';
import { useAuth } from '../../lib/authContext';
import { submitAssistedImportRequest } from '../../lib/smartCatalogImportService';
import { 
  HelpCircle, 
  X, 
  Send, 
  CheckCircle2, 
  FileSpreadsheet, 
  Phone, 
  User, 
  Mail, 
  MessageSquare,
  AlertCircle,
  Clock
} from 'lucide-react';

interface AssistedImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName?: string;
  fileSizeBytes?: number;
  estimatedProducts?: number;
}

export const AssistedImportModal: React.FC<AssistedImportModalProps> = ({
  isOpen,
  onClose,
  fileName = '',
  fileSizeBytes = 0,
  estimatedProducts = 0
}) => {
  const { userProfile, business } = useAuth();
  const [contactName, setContactName] = useState(userProfile?.displayName || business?.adminName || '');
  const [contactEmail, setContactEmail] = useState(userProfile?.email || business?.adminEmail || '');
  const [contactPhone, setContactPhone] = useState('');
  const [observations, setObservations] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business?.id || !userProfile?.uid) {
      setError('Debes iniciar sesión para solicitar asistencia.');
      return;
    }

    if (!contactName.trim() || !contactEmail.trim()) {
      setError('Por favor completá tu nombre y correo electrónico de contacto.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const reqId = await submitAssistedImportRequest({
        businessId: business.id,
        userId: userProfile.uid,
        userEmail: contactEmail.trim(),
        userName: contactName.trim(),
        fileName: fileName || 'Catalogo_Cliente.xlsx',
        fileSizeBytes,
        estimatedProducts,
        contactPhone: contactPhone.trim() || undefined,
        observations: observations.trim() || 'Solicitud de asistencia para importación y adaptación de catálogo.'
      });
      setSubmittedId(reqId);
    } catch (err: any) {
      setError(err.message || 'Error al enviar la solicitud. Por favor reintentá.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">
                Solicitar Asistencia de Catálogo
              </h3>
              <p className="text-xs text-stone-500">
                El equipo de uwi te ayuda a preparar y cargar tus productos
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-stone-400 hover:text-stone-600 p-1 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {submittedId ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-lg font-bold text-stone-900">¡Solicitud recibida!</h4>
              <p className="text-xs text-stone-600 mt-1 max-w-sm mx-auto">
                Registramos tu pedido con el código <span className="font-mono font-bold text-stone-800">#{submittedId.slice(0, 7).toUpperCase()}</span>. Nuestro equipo se pondrá en contacto para ayudarte a importar tu catálogo sin costo.
              </p>
            </div>
            <div className="pt-3 border-t border-stone-100 flex justify-center">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {fileName && (
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center gap-3">
                <FileSpreadsheet className="w-5 h-5 text-blue-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-stone-800 truncate">{fileName}</p>
                  <p className="text-[11px] text-stone-500">
                    {estimatedProducts > 0 ? `~${estimatedProducts} productos detectados` : 'Archivo para adaptar'}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Nombre de contacto
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Tu nombre completo"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="ejemplo@comercio.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Teléfono / WhatsApp (Opcional)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+54 9 11 1234-5678"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Detalles o dudas sobre tu archivo (Opcional)
                </label>
                <div className="relative">
                  <MessageSquare className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
                  <textarea
                    rows={3}
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-stone-300 rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Ej: Tengo columnas de códigos de proveedores y precios con IVA incluido que quiero acomodar..."
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-stone-200 flex items-center justify-between">
              <span className="text-[11px] text-stone-500 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Respuesta en menos de 24 hs
              </span>
              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 font-semibold text-stone-600 hover:bg-stone-100 rounded-xl text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Enviando...' : 'Enviar Solicitud'}</span>
                </button>
              </div>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
