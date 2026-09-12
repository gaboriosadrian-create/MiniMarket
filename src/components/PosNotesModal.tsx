import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  NotebookPen, 
  Plus, 
  Check, 
  Trash2, 
  AlertTriangle, 
  Edit2, 
  Save, 
  RotateCcw,
  CheckCircle2,
  Circle,
  Sparkles
} from 'lucide-react';
import { PosNote, CreatePosNoteInput } from '../types';
import { createPosNote, updatePosNote, deletePosNote, clearAllPosNotes } from '../lib/posNoteService';

interface PosNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string;
  userId?: string;
  userName?: string;
  notes: PosNote[];
  onNotesChange: (notes: PosNote[]) => void;
}

export const PosNotesModal: React.FC<PosNotesModalProps> = ({
  isOpen,
  onClose,
  businessId,
  userId,
  userName,
  notes,
  onNotesChange
}) => {
  // Form State
  const [personName, setPersonName] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [isPaid, setIsPaid] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Edit Mode State
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editPerson, setEditPerson] = useState('');
  const [editTask, setEditTask] = useState('');
  const [editQuantity, setEditQuantity] = useState('1');
  const [editIsPaid, setEditIsPaid] = useState(false);

  // Confirm Clear All State
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  // Filter tab: 'ALL' | 'PENDING' | 'COMPLETED'
  const [filterTab, setFilterTab] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');

  // Input refs for auto-focus
  const personInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        personInputRef.current?.focus();
      }, 100);
    } else {
      setShowClearConfirm(false);
      setEditingNoteId(null);
      setFormError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personName.trim()) {
      setFormError('Por favor ingrese el nombre de la persona.');
      personInputRef.current?.focus();
      return;
    }
    if (!taskDescription.trim()) {
      setFormError('Por favor ingrese el detalle del encargo.');
      return;
    }

    const qtyNum = parseInt(quantity, 10);
    const validQty = !isNaN(qtyNum) && qtyNum > 0 ? qtyNum : 1;

    setFormError(null);

    const input: CreatePosNoteInput = {
      businessId,
      userId,
      userName,
      personName: personName.trim(),
      taskDescription: taskDescription.trim(),
      quantity: validQty,
      isPaid
    };

    // Optimistic creation
    const tempId = `temp_${Date.now()}`;
    const optimisticNote: PosNote = {
      id: tempId,
      ...input,
      isCompleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    onNotesChange([optimisticNote, ...notes]);

    // Reset form immediately for fast next entry
    setPersonName('');
    setTaskDescription('');
    setQuantity('1');
    setIsPaid(false);

    // Keep focus on person field for quick typing
    setTimeout(() => {
      personInputRef.current?.focus();
    }, 50);

    try {
      const created = await createPosNote(input);
      // Replace optimistic note with real id
      onNotesChange(notes.map((n) => (n.id === tempId ? created : n)));
    } catch (err) {
      console.error('Error creating note:', err);
    }
  };

  const handleToggleComplete = async (note: PosNote) => {
    const updatedStatus = !note.isCompleted;
    const updatedNotes = notes.map((n) =>
      n.id === note.id ? { ...n, isCompleted: updatedStatus, updatedAt: new Date().toISOString() } : n
    );
    onNotesChange(updatedNotes);

    try {
      await updatePosNote(businessId, note.id, { isCompleted: updatedStatus });
    } catch (err) {
      console.error('Error toggling complete status:', err);
    }
  };

  const handleTogglePaid = async (note: PosNote) => {
    const updatedPaid = !note.isPaid;
    const updatedNotes = notes.map((n) =>
      n.id === note.id ? { ...n, isPaid: updatedPaid, updatedAt: new Date().toISOString() } : n
    );
    onNotesChange(updatedNotes);

    try {
      await updatePosNote(businessId, note.id, { isPaid: updatedPaid });
    } catch (err) {
      console.error('Error toggling paid status:', err);
    }
  };

  const startEditNote = (note: PosNote) => {
    setEditingNoteId(note.id);
    setEditPerson(note.personName);
    setEditTask(note.taskDescription);
    setEditQuantity(String(note.quantity || 1));
    setEditIsPaid(note.isPaid);
  };

  const cancelEdit = () => {
    setEditingNoteId(null);
  };

  const saveEditNote = async (noteId: string) => {
    if (!editPerson.trim() || !editTask.trim()) return;

    const qtyNum = parseInt(editQuantity, 10);
    const validQty = !isNaN(qtyNum) && qtyNum > 0 ? qtyNum : 1;

    const updates = {
      personName: editPerson.trim(),
      taskDescription: editTask.trim(),
      quantity: validQty,
      isPaid: editIsPaid
    };

    const updatedNotes = notes.map((n) =>
      n.id === noteId ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n
    );
    onNotesChange(updatedNotes);
    setEditingNoteId(null);

    try {
      await updatePosNote(businessId, noteId, updates);
    } catch (err) {
      console.error('Error saving edited note:', err);
    }
  };

  const handleDeleteSingle = async (noteId: string) => {
    const updatedNotes = notes.filter((n) => n.id !== noteId);
    onNotesChange(updatedNotes);

    try {
      await deletePosNote(businessId, noteId);
    } catch (err) {
      console.error('Error deleting note:', err);
    }
  };

  const handleClearAllConfirmed = async () => {
    setIsClearing(true);
    const currentNotes = [...notes];
    onNotesChange([]);
    setShowClearConfirm(false);

    try {
      await clearAllPosNotes(businessId, currentNotes);
    } catch (err) {
      console.error('Error clearing all notes:', err);
    } finally {
      setIsClearing(false);
    }
  };

  const pendingCount = notes.filter((n) => !n.isCompleted).length;
  const completedCount = notes.filter((n) => n.isCompleted).length;

  const filteredNotes = notes.filter((n) => {
    if (filterTab === 'PENDING') return !n.isCompleted;
    if (filterTab === 'COMPLETED') return n.isCompleted;
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-stone-200 text-stone-900 max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-100 flex items-center justify-between shrink-0 bg-stone-50/60">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold border border-amber-200/80 shadow-2xs">
              <NotebookPen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-stone-900 leading-tight">
                  Anotaciones
                </h3>
                {pendingCount > 0 && (
                  <span className="bg-amber-500 text-white text-[11px] font-black px-2 py-0.5 rounded-full font-mono">
                    {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Block de notas operativo para encargues y recordatorios rápidos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 p-1.5 cursor-pointer rounded-xl hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          
          {/* Informational Banner */}
          <div className="bg-amber-50/80 border border-amber-200/70 rounded-2xl p-2.5 text-[11px] text-amber-900 flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <span>
              <strong>Borrador operativo:</strong> Estas notas son recordatorios rápidos internos. <strong>No generan ventas ni alteran stock o caja</strong>.
            </span>
          </div>

          {/* Form: Nuevo Encargo */}
          <form onSubmit={handleAddNote} className="bg-stone-50 rounded-2xl p-3.5 border border-stone-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-[#006AFF]" />
                Nuevo encargo / recordatorio
              </span>
            </div>

            {formError && (
              <div className="p-2 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-800 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              {/* Persona */}
              <div className="sm:col-span-6 space-y-1">
                <label className="text-[11px] font-bold text-stone-600 uppercase tracking-wider block">
                  Persona
                </label>
                <input
                  ref={personInputRef}
                  type="text"
                  placeholder="Ej: Juan Pérez"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs sm:text-sm font-semibold text-stone-900 placeholder-stone-400 focus:border-[#006AFF] focus:ring-2 focus:ring-[#006AFF]/20 outline-none"
                />
              </div>

              {/* Encargo */}
              <div className="sm:col-span-6 space-y-1">
                <label className="text-[11px] font-bold text-stone-600 uppercase tracking-wider block">
                  Encargo
                </label>
                <input
                  type="text"
                  placeholder="Ej: Fotocopias A4, Retirar pedido..."
                  value={taskDescription}
                  onChange={(e) => setTaskDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs sm:text-sm font-semibold text-stone-900 placeholder-stone-400 focus:border-[#006AFF] focus:ring-2 focus:ring-[#006AFF]/20 outline-none"
                />
              </div>

              {/* Cantidad */}
              <div className="sm:col-span-5 space-y-1">
                <label className="text-[11px] font-bold text-stone-600 uppercase tracking-wider block">
                  Cantidad
                </label>
                <input
                  type="number"
                  inputMode="numeric"
                  min="1"
                  placeholder="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-xs sm:text-sm font-black font-mono text-stone-900 focus:border-[#006AFF] focus:ring-2 focus:ring-[#006AFF]/20 outline-none"
                />
              </div>

              {/* Pagado [Sí] [No] */}
              <div className="sm:col-span-7 space-y-1">
                <label className="text-[11px] font-bold text-stone-600 uppercase tracking-wider block">
                  ¿Pagado?
                </label>
                <div className="grid grid-cols-2 gap-1.5 h-[38px]">
                  <button
                    type="button"
                    onClick={() => setIsPaid(true)}
                    className={`rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      isPaid
                        ? 'bg-emerald-600 text-white font-black shadow-xs'
                        : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
                    }`}
                  >
                    {isPaid && <Check className="w-3.5 h-3.5" />}
                    <span>Sí</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsPaid(false)}
                    className={`rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                      !isPaid
                        ? 'bg-stone-800 text-white font-black shadow-xs'
                        : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
                    }`}
                  >
                    {!isPaid && <Check className="w-3.5 h-3.5" />}
                    <span>No</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full py-2.5 bg-[#006AFF] hover:bg-[#0052CC] text-white font-bold rounded-xl text-xs sm:text-sm transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar Anotación</span>
            </button>
          </form>

          {/* List Section Header & Tabs */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setFilterTab('ALL')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    filterTab === 'ALL' ? 'bg-white text-stone-900 shadow-2xs font-black' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Todas ({notes.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('PENDING')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    filterTab === 'PENDING' ? 'bg-white text-amber-800 shadow-2xs font-black' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Pendientes ({pendingCount})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTab('COMPLETED')}
                  className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                    filterTab === 'COMPLETED' ? 'bg-white text-emerald-800 shadow-2xs font-black' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Tachadas ({completedCount})
                </button>
              </div>

              {notes.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="text-xs font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-rose-50 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Limpiar todo</span>
                </button>
              )}
            </div>

            {/* Clear All Confirmation Box */}
            {showClearConfirm && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-2.5 animate-in fade-in">
                <div className="flex items-center gap-2 text-rose-900 font-bold text-xs sm:text-sm">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>¿Limpiar todas las anotaciones?</span>
                </div>
                <p className="text-xs text-rose-700">
                  Se eliminarán todos los encargues y recordatorios de este block. Esta acción no afecta ventas ni stock.
                </p>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(false)}
                    disabled={isClearing}
                    className="flex-1 py-1.5 bg-white border border-stone-200 text-stone-700 font-bold rounded-xl text-xs hover:bg-stone-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllConfirmed}
                    disabled={isClearing}
                    className="flex-1 py-1.5 bg-rose-600 text-white font-bold rounded-xl text-xs hover:bg-rose-700 cursor-pointer shadow-xs"
                  >
                    {isClearing ? 'Limpiando...' : 'Sí, Limpiar todo'}
                  </button>
                </div>
              </div>
            )}

            {/* List of Notes */}
            {filteredNotes.length === 0 ? (
              <div className="p-8 text-center bg-stone-50/60 rounded-2xl border border-dashed border-stone-200 text-stone-400 space-y-1">
                <NotebookPen className="w-8 h-8 mx-auto text-stone-300 stroke-1" />
                <p className="text-xs font-semibold text-stone-500">
                  {notes.length === 0
                    ? 'No hay anotaciones registradas en este block.'
                    : 'No hay anotaciones con el filtro seleccionado.'}
                </p>
                <p className="text-[11px] text-stone-400">
                  Utilice el formulario superior para registrar encargues rápidamente.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredNotes.map((note) => {
                  const isEditing = editingNoteId === note.id;

                  if (isEditing) {
                    return (
                      <div
                        key={note.id}
                        className="p-3 bg-amber-50/70 border border-amber-300 rounded-2xl space-y-2.5 text-xs animate-in fade-in"
                      >
                        <div className="font-bold text-amber-900 text-[11px] uppercase tracking-wider">
                          Editar Anotación
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            type="text"
                            placeholder="Persona"
                            value={editPerson}
                            onChange={(e) => setEditPerson(e.target.value)}
                            className="px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-semibold text-stone-900"
                          />
                          <input
                            type="text"
                            placeholder="Encargo"
                            value={editTask}
                            onChange={(e) => setEditTask(e.target.value)}
                            className="px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-semibold text-stone-900"
                          />
                          <input
                            type="number"
                            inputMode="numeric"
                            min="1"
                            placeholder="Cantidad"
                            value={editQuantity}
                            onChange={(e) => setEditQuantity(e.target.value)}
                            className="px-2.5 py-1.5 bg-white border border-stone-200 rounded-lg text-xs font-mono font-bold text-stone-900"
                          />
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditIsPaid(true)}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                                editIsPaid ? 'bg-emerald-600 text-white' : 'bg-white border border-stone-200 text-stone-700'
                              }`}
                            >
                              Pagado: Sí
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditIsPaid(false)}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                                !editIsPaid ? 'bg-stone-800 text-white' : 'bg-white border border-stone-200 text-stone-700'
                              }`}
                            >
                              Pagado: No
                            </button>
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="px-3 py-1.5 bg-white border border-stone-200 text-stone-700 font-bold rounded-lg text-xs hover:bg-stone-100 cursor-pointer"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={() => saveEditNote(note.id)}
                            className="px-3 py-1.5 bg-[#006AFF] hover:bg-[#0052CC] text-white font-bold rounded-lg text-xs cursor-pointer shadow-xs flex items-center gap-1"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Guardar</span>
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={note.id}
                      className={`p-3 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                        note.isCompleted
                          ? 'bg-stone-100/80 border-stone-200 opacity-70'
                          : 'bg-white border-stone-200 shadow-2xs hover:border-amber-300'
                      }`}
                    >
                      {/* Checkbox + Details */}
                      <div className="flex items-start gap-3 min-w-0">
                        {/* Large Touch Target Checkbox */}
                        <button
                          type="button"
                          onClick={() => handleToggleComplete(note)}
                          title={note.isCompleted ? 'Marcar como pendiente' : 'Tachar / Marcar como atendido'}
                          className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 cursor-pointer transition-all border ${
                            note.isCompleted
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                              : 'bg-stone-50 hover:bg-stone-100 text-stone-400 border-stone-300'
                          }`}
                        >
                          {note.isCompleted ? (
                            <Check className="w-4 h-4 stroke-[3]" />
                          ) : (
                            <Circle className="w-3 h-3 text-stone-300" />
                          )}
                        </button>

                        {/* Text Information */}
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-xs sm:text-sm font-black text-stone-900 leading-tight ${
                                note.isCompleted ? 'line-through text-stone-500' : ''
                              }`}
                            >
                              {note.personName}
                            </span>

                            {/* Paid Badge (Clickable for instant toggle) */}
                            <button
                              type="button"
                              onClick={() => handleTogglePaid(note)}
                              title="Tocar para cambiar estado de pago"
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold cursor-pointer transition-all border ${
                                note.isPaid
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200'
                                  : 'bg-amber-100 text-amber-900 border-amber-200 hover:bg-amber-200'
                              }`}
                            >
                              Pagado: {note.isPaid ? 'Sí' : 'No'}
                            </button>
                          </div>

                          <p
                            className={`text-xs text-stone-700 font-medium break-words ${
                              note.isCompleted ? 'line-through text-stone-400' : ''
                            }`}
                          >
                            <span className="font-mono font-bold text-stone-900 bg-stone-100 px-1.5 py-0.2 rounded text-[11px] mr-1.5">
                              {note.quantity} {note.quantity === 1 ? 'unidad' : 'unidades'}
                            </span>
                            {note.taskDescription}
                          </p>

                          {note.createdAt && (
                            <p className="text-[10px] text-stone-400 font-mono">
                              {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Actions: Edit & Delete */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditNote(note)}
                          title="Editar anotación"
                          className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg cursor-pointer transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSingle(note.id)}
                          title="Eliminar esta anotación"
                          className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-stone-100 flex items-center justify-between shrink-0 bg-stone-50/60">
          <span className="text-xs text-stone-500 font-medium">
            {notes.length} anotaci{notes.length === 1 ? 'ón' : 'ones'} en total
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer shadow-xs"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
