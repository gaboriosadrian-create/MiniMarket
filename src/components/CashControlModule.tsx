import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../lib/authContext';
import { 
  CashRegister, 
  CashSession, 
  CashMovement, 
  CashMovementType, 
  CashFlowType 
} from '../types';
import { 
  getOrCreateDefaultCashRegister, 
  getCashRegisters,
  getCurrentSession, 
  openCashSession, 
  closeCashSession, 
  getSessionMovements, 
  registerCashMovement, 
  calculateSessionSummary,
  getSessionHistory,
  withdrawCashFromSession
} from '../lib/cashCoreService';
import { 
  Banknote, 
  Lock, 
  Unlock, 
  PlusCircle, 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCw, 
  Clock, 
  User, 
  AlertCircle, 
  CheckCircle2, 
  History, 
  FileText, 
  Coins, 
  ChevronRight,
  X,
  Scale,
  ArrowRightLeft,
  DollarSign,
  AlertTriangle,
  Info
} from 'lucide-react';

export const CashControlModule: React.FC = () => {
  const { userProfile, business } = useAuth();

  // Navigation State
  const [activeSubTab, setActiveSubTab] = useState<'session' | 'history'>('session');
  
  // Data State
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [selectedRegister, setSelectedRegister] = useState<CashRegister | null>(null);
  const [currentSession, setCurrentSession] = useState<CashSession | null>(null);
  const [sessionMovements, setSessionMovements] = useState<CashMovement[]>([]);
  const [historySessions, setHistorySessions] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modals State
  const [isOpenModalVisible, setIsOpenModalVisible] = useState<boolean>(false);
  const [isCloseModalVisible, setIsCloseModalVisible] = useState<boolean>(false);
  const [isWithdrawModalVisible, setIsWithdrawModalVisible] = useState<boolean>(false);
  const [isMovementModalVisible, setIsMovementModalVisible] = useState<boolean>(false);
  const [inspectingSession, setInspectingSession] = useState<CashSession | null>(null);
  const [inspectedMovements, setInspectedMovements] = useState<CashMovement[]>([]);
  const [loadingInspected, setLoadingInspected] = useState<boolean>(false);

  // Form State: Open Session
  const [openInitialAmount, setOpenInitialAmount] = useState<string>('0');
  const [openNotes, setOpenNotes] = useState<string>('');

  // Form State: Close Session & Arqueo
  const [closeActualAmount, setCloseActualAmount] = useState<string>('');
  const [closeNotes, setCloseNotes] = useState<string>('');

  // Form State: Withdrawal
  const [withdrawAmount, setWithdrawAmount] = useState<string>('');
  const [withdrawDescription, setWithdrawDescription] = useState<string>('');
  const [withdrawNotes, setWithdrawNotes] = useState<string>('');

  // Form State: Manual Inflow/Outflow
  const [movType, setMovType] = useState<CashMovementType>('INCOME');
  const [movFlow, setMovFlow] = useState<CashFlowType>('INCOME');
  const [movAmount, setMovAmount] = useState<string>('');
  const [movDescription, setMovDescription] = useState<string>('');
  const [movNotes, setMovNotes] = useState<string>('');

  // Formatting Helpers
  const formatCurrency = (amount: number | undefined | null) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatDateTime = (isoString?: string) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTimeOnly = (isoString?: string) => {
    if (!isoString) return '-';
    return new Date(isoString).toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Load initial data
  const loadData = useCallback(async () => {
    if (!business?.id) return;
    setLoading(true);
    setErrorMsg(null);

    try {
      // 1. Get or create default cash register
      const defaultReg = await getOrCreateDefaultCashRegister(
        business.id,
        undefined,
        userProfile?.uid,
        userProfile?.displayName
      );

      const allRegisters = await getCashRegisters(business.id);
      setRegisters(allRegisters.length > 0 ? allRegisters : [defaultReg]);
      
      const targetReg = selectedRegister 
        ? allRegisters.find((r) => r.id === selectedRegister.id) || defaultReg 
        : defaultReg;
      setSelectedRegister(targetReg);

      // 2. Fetch current session for register
      const activeSession = await getCurrentSession(business.id, targetReg.id);
      setCurrentSession(activeSession);

      if (activeSession) {
        const movements = await getSessionMovements(business.id, activeSession.id);
        setSessionMovements(movements);
      } else {
        setSessionMovements([]);
      }

      // 3. Fetch history
      const history = await getSessionHistory(business.id, {
        cashRegisterId: targetReg.id,
        limitCount: 30,
      });
      setHistorySessions(history);
    } catch (err: any) {
      console.error('[CashControlModule] Error loading data:', err);
      setErrorMsg(err?.message || 'Error al cargar los datos de caja');
    } finally {
      setLoading(false);
    }
  }, [business?.id, userProfile?.uid, userProfile?.displayName, selectedRegister?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived session summary
  const currentSummary = useMemo(() => {
    if (!currentSession) return null;
    return calculateSessionSummary(currentSession, sessionMovements);
  }, [currentSession, sessionMovements]);

  // Sorted movements (Most recent first)
  const sortedMovements = useMemo(() => {
    return [...sessionMovements].sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [sessionMovements]);

  // Close session difference calculation
  const parsedCloseActual = parseFloat(closeActualAmount) || 0;
  const expectedCloseAmount = currentSummary ? currentSummary.expectedAmount : (currentSession?.initialAmount || 0);
  const closeDifference = parsedCloseActual - expectedCloseAmount;

  // Withdrawal calculations
  const parsedWithdrawAmount = parseFloat(withdrawAmount) || 0;
  const currentAvailableBalance = currentSummary ? currentSummary.expectedAmount : 0;
  const balanceAfterWithdrawal = currentAvailableBalance - parsedWithdrawAmount;
  const isWithdrawalValid = parsedWithdrawAmount > 0 && parsedWithdrawAmount <= currentAvailableBalance;

  // --------------------------------------------------------------------------
  // HANDLERS
  // --------------------------------------------------------------------------

  const handleOpenSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business?.id || !selectedRegister || !userProfile?.uid) return;
    
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const parsedInitial = parseFloat(openInitialAmount);
      if (isNaN(parsedInitial) || parsedInitial < 0) {
        throw new Error('El monto inicial debe ser un número mayor o igual a 0');
      }

      await openCashSession({
        businessId: business.id,
        cashRegisterId: selectedRegister.id,
        cashRegisterName: selectedRegister.name,
        initialAmount: parsedInitial,
        userId: userProfile.uid,
        userName: userProfile.displayName || 'Usuario',
        notes: openNotes.trim() || undefined,
      });

      setIsOpenModalVisible(false);
      setOpenInitialAmount('0');
      setOpenNotes('');
      setSuccessMsg('¡Caja abierta exitosamente!');
      await loadData();
    } catch (err: any) {
      console.error('[CashControlModule] Error opening session:', err);
      setErrorMsg(err?.message || 'Error al abrir la caja');
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business?.id || !currentSession || !userProfile?.uid) return;

    if (!isWithdrawalValid) {
      setErrorMsg(`El monto a retirar debe ser mayor a 0 y no puede superar el saldo disponible (${formatCurrency(currentAvailableBalance)}).`);
      return;
    }

    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await withdrawCashFromSession({
        businessId: business.id,
        sessionId: currentSession.id,
        amount: parsedWithdrawAmount,
        description: withdrawDescription.trim() || 'Retiro de efectivo',
        userId: userProfile.uid,
        userName: userProfile.displayName || 'Usuario',
        notes: withdrawNotes.trim() || undefined,
      });

      setIsWithdrawModalVisible(false);
      setWithdrawAmount('');
      setWithdrawDescription('');
      setWithdrawNotes('');
      setSuccessMsg(`Retiro de ${formatCurrency(parsedWithdrawAmount)} registrado con éxito`);
      await loadData();
    } catch (err: any) {
      console.error('[CashControlModule] Error withdrawing cash:', err);
      setErrorMsg(err?.message || 'Error al registrar el retiro');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseSessionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business?.id || !selectedRegister || !currentSession || !userProfile?.uid) return;

    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await closeCashSession({
        businessId: business.id,
        sessionId: currentSession.id,
        cashRegisterId: selectedRegister.id,
        actualAmount: parsedCloseActual,
        userId: userProfile.uid,
        userName: userProfile.displayName || 'Usuario',
        closingNotes: closeNotes.trim() || undefined,
      });

      setIsCloseModalVisible(false);
      setCloseActualAmount('');
      setCloseNotes('');
      setSuccessMsg('¡Caja cerrada y arqueo completado exitosamente!');
      await loadData();
    } catch (err: any) {
      console.error('[CashControlModule] Error closing session:', err);
      setErrorMsg(err?.message || 'Error al cerrar la caja');
    } finally {
      setActionLoading(false);
    }
  };

  const handleManualMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business?.id || !currentSession || !userProfile?.uid) return;

    const parsedAmt = parseFloat(movAmount);
    if (!parsedAmt || parsedAmt <= 0) {
      setErrorMsg('El importe debe ser mayor a 0');
      return;
    }

    if (!movDescription.trim()) {
      setErrorMsg('Debe ingresar un concepto para el movimiento');
      return;
    }

    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await registerCashMovement({
        businessId: business.id,
        cashRegisterId: currentSession.cashRegisterId,
        sessionId: currentSession.id,
        type: movType,
        flow: movFlow,
        amount: parsedAmt,
        description: movDescription.trim(),
        referenceType: 'MANUAL',
        paymentMethod: 'EFECTIVO',
        userId: userProfile.uid,
        userName: userProfile.displayName || 'Usuario',
        notes: movNotes.trim() || undefined,
      });

      setIsMovementModalVisible(false);
      setMovAmount('');
      setMovDescription('');
      setMovNotes('');
      setSuccessMsg('Movimiento registrado en la sesión actual');
      await loadData();
    } catch (err: any) {
      console.error('[CashControlModule] Error registering movement:', err);
      setErrorMsg(err?.message || 'Error al registrar el movimiento');
    } finally {
      setActionLoading(false);
    }
  };

  const handleInspectHistoricSession = async (session: CashSession) => {
    setInspectingSession(session);
    setLoadingInspected(true);
    try {
      if (business?.id) {
        const movs = await getSessionMovements(business.id, session.id);
        // Sort most recent first for inspection
        movs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setInspectedMovements(movs);
      }
    } catch (err) {
      console.error('Error loading historic session movements:', err);
    } finally {
      setLoadingInspected(false);
    }
  };

  const getMovementTypeBadge = (m: CashMovement) => {
    if (m.type === 'OPENING') {
      return { label: 'Apertura de Caja', bg: 'bg-amber-100 text-amber-800' };
    }
    if (m.type === 'SALE_CASH' || m.type === 'SALE_INCOME') {
      return { label: 'Venta en Efectivo', bg: 'bg-emerald-100 text-emerald-800' };
    }
    if (m.type === 'PURCHASE_CASH' || m.type === 'PURCHASE_PAYMENT') {
      return { label: 'Compra de Mercadería', bg: 'bg-rose-100 text-rose-800' };
    }
    if (m.type === 'EXPENSE_CASH' || m.type === 'EXPENSE_PAYMENT') {
      return { label: 'Gasto Operativo', bg: 'bg-rose-100 text-rose-800' };
    }
    if (m.type === 'SETTLEMENT_CASH') {
      return { label: 'Liquidación de Deuda', bg: 'bg-purple-100 text-purple-800' };
    }
    if (m.type === 'WITHDRAWAL') {
      return { label: 'Retiro de Efectivo', bg: 'bg-amber-100 text-amber-900 border border-amber-300' };
    }
    if (m.type === 'PURCHASE_CANCELLATION' || m.type === 'ADJUSTMENT' || m.type === 'CLOSING_AUDIT') {
      return { label: 'Reintegro / Ajuste', bg: 'bg-sky-100 text-sky-800' };
    }
    return { label: m.type, bg: 'bg-stone-100 text-stone-700' };
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-stone-200 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold shrink-0">
            <Coins className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-black text-stone-900">Centro de Caja</h2>
              {currentSession ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 animate-pulse">
                  ● CAJA ABIERTA
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black bg-stone-100 text-stone-600">
                  ○ CAJA CERRADA
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              {selectedRegister?.name || 'Caja Principal'} · Control de efectivo físico de la jornada
            </p>
          </div>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex items-center space-x-2 self-start md:self-auto">
          <button
            onClick={() => setActiveSubTab('session')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeSubTab === 'session'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <Coins className="w-4 h-4" />
            <span>Turno Actual</span>
          </button>
          <button
            onClick={() => setActiveSubTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeSubTab === 'history'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Historial de Cierres</span>
          </button>
          <button
            onClick={loadData}
            title="Actualizar datos"
            className="p-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center justify-between text-rose-900 text-xs animate-in fade-in">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span className="font-medium">{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between text-emerald-900 text-xs animate-in fade-in">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* SUBTAB 1: TURNO ACTUAL (CAJA CERRADA / CAJA ABIERTA)                  */}
      {/* --------------------------------------------------------------------- */}
      {activeSubTab === 'session' && (
        <div className="space-y-6">
          {!currentSession ? (
            /* =============================================================== */
            /* 1. ESTADO: CAJA CERRADA                                         */
            /* =============================================================== */
            <div className="bg-white rounded-3xl border-2 border-dashed border-stone-200 p-8 sm:p-12 text-center max-w-xl mx-auto space-y-6 shadow-xs">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-stone-100 text-stone-600 flex items-center justify-center border border-stone-200">
                <Lock className="w-10 h-10" />
              </div>
              
              <div className="space-y-2">
                <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-black bg-stone-100 text-stone-700 uppercase tracking-wider">
                  Caja cerrada
                </div>
                <h3 className="text-2xl font-black text-stone-900">
                  {selectedRegister?.name || 'Caja Principal'}
                </h3>
                <p className="text-xs text-stone-500 font-mono">
                  Código: REG-{(selectedRegister?.id || '01').slice(-6).toUpperCase()}
                </p>
                <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed pt-1">
                  No hay un turno de caja abierto en este momento. Para comenzar a operar y cobrar en efectivo físico, abrí la caja indicando el fondo inicial.
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => {
                    setOpenInitialAmount('0');
                    setOpenNotes('');
                    setIsOpenModalVisible(true);
                  }}
                  className="inline-flex items-center justify-center space-x-2 px-8 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-black shadow-lg shadow-emerald-600/20 transition-all cursor-pointer active:scale-95"
                >
                  <Unlock className="w-5 h-5" />
                  <span>ABRIR CAJA</span>
                </button>
              </div>
            </div>
          ) : (
            /* =============================================================== */
            /* 2. ESTADO: CAJA ABIERTA                                         */
            /* =============================================================== */
            <div className="space-y-6">
              {/* Hero Banner: Saldo Esperado */}
              <div className="bg-linear-to-br from-stone-900 via-stone-900 to-stone-800 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-stone-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-stone-400 text-xs font-bold uppercase tracking-wider">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>Caja Abierta · Saldo Esperado en Caja</span>
                  </div>
                  <div className="text-4xl sm:text-5xl font-black text-emerald-400 font-mono tracking-tight">
                    {formatCurrency(currentSummary?.expectedAmount)}
                  </div>
                  <p className="text-xs text-stone-300">
                    Efectivo físico disponible según el Libro de Caja (Fondo inicial + Ingresos − Egresos)
                  </p>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <button
                    onClick={() => {
                      setWithdrawAmount('');
                      setWithdrawDescription('');
                      setWithdrawNotes('');
                      setIsWithdrawModalVisible(true);
                    }}
                    className="px-5 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs sm:text-sm flex items-center space-x-2 shadow-md shadow-amber-500/20 transition-all cursor-pointer active:scale-95"
                  >
                    <Banknote className="w-4 h-4" />
                    <span>RETIRAR EFECTIVO</span>
                  </button>

                  <button
                    onClick={() => {
                      setCloseActualAmount(currentSummary?.expectedAmount?.toString() || '0');
                      setCloseNotes('');
                      setIsCloseModalVisible(true);
                    }}
                    className="px-5 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs sm:text-sm flex items-center space-x-2 shadow-md shadow-rose-600/20 transition-all cursor-pointer active:scale-95"
                  >
                    <Lock className="w-4 h-4" />
                    <span>CERRAR CAJA</span>
                  </button>
                </div>
              </div>

              {/* Resumen de la Jornada (4 Cards) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Saldo Inicial */}
                <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-stone-500">
                    <span className="text-xs font-bold uppercase tracking-wider">Saldo Inicial</span>
                    <Coins className="w-4 h-4 text-stone-400" />
                  </div>
                  <p className="text-2xl font-black text-stone-900 font-mono">
                    {formatCurrency(currentSession.initialAmount)}
                  </p>
                  <div className="text-[11px] text-stone-400 flex items-center space-x-1">
                    <Clock className="w-3 h-3" />
                    <span>Apertura {formatTimeOnly(currentSession.openedAt)}</span>
                  </div>
                </div>

                {/* Ingresos de Efectivo */}
                <div className="bg-white rounded-2xl border border-emerald-200 p-5 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-emerald-700">
                    <span className="text-xs font-bold uppercase tracking-wider">Ingresos de Efectivo</span>
                    <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-2xl font-black text-emerald-600 font-mono">
                    +{formatCurrency(currentSummary?.totalInflows)}
                  </p>
                  <div className="text-[11px] text-emerald-700 font-medium">
                    Ventas y cobros en efectivo
                  </div>
                </div>

                {/* Egresos de Efectivo */}
                <div className="bg-white rounded-2xl border border-rose-200 p-5 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-rose-700">
                    <span className="text-xs font-bold uppercase tracking-wider">Egresos de Efectivo</span>
                    <ArrowDownRight className="w-4 h-4 text-rose-600" />
                  </div>
                  <p className="text-2xl font-black text-rose-600 font-mono">
                    -{formatCurrency(currentSummary?.totalOutflows)}
                  </p>
                  <div className="text-[11px] text-rose-700 font-medium">
                    Compras, gastos y retiros
                  </div>
                </div>

                {/* Saldo Esperado */}
                <div className="bg-stone-50 rounded-2xl border border-stone-300 p-5 shadow-xs space-y-2">
                  <div className="flex items-center justify-between text-stone-700">
                    <span className="text-xs font-bold uppercase tracking-wider">Saldo Esperado</span>
                    <Scale className="w-4 h-4 text-stone-500" />
                  </div>
                  <p className="text-2xl font-black text-stone-900 font-mono">
                    {formatCurrency(currentSummary?.expectedAmount)}
                  </p>
                  <div className="text-[11px] text-stone-500 font-medium">
                    Saldo teórico actual
                  </div>
                </div>
              </div>

              {/* Extra Secondary Action: Movimiento Manual */}
              <div className="flex justify-end">
                <button
                  onClick={() => {
                    setMovType('INCOME');
                    setMovFlow('INCOME');
                    setMovAmount('');
                    setMovDescription('');
                    setMovNotes('');
                    setIsMovementModalVisible(true);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-stone-500" />
                  <span>Registrar Movimiento Manual</span>
                </button>
              </div>

              {/* Movimientos de la Caja */}
              <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
                <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
                  <div className="flex items-center space-x-2">
                    <History className="w-4 h-4 text-stone-600" />
                    <h3 className="font-black text-stone-900 text-sm">
                      Movimientos de la Sesión Abierta
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-stone-200 text-stone-800 text-[10px] font-black">
                      {sortedMovements.length}
                    </span>
                  </div>
                  <span className="text-[11px] text-stone-400">Ordenados del más reciente al más antiguo</span>
                </div>

                {sortedMovements.length === 0 ? (
                  <div className="p-10 text-center text-stone-400 text-xs space-y-1">
                    <Coins className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                    <p className="font-bold text-stone-600">Aún no hay movimientos de efectivo en este turno.</p>
                    <p>Las ventas, compras, gastos y retiros en efectivo se reflejarán aquí automáticamente.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-stone-200 bg-stone-50/80 text-stone-500 font-bold uppercase tracking-wider text-[10px]">
                          <th className="py-3 px-4">Hora</th>
                          <th className="py-3 px-4">Tipo</th>
                          <th className="py-3 px-4">Descripción</th>
                          <th className="py-3 px-4">Usuario</th>
                          <th className="py-3 px-4 text-right">Importe</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {sortedMovements.map((m) => {
                          const isOpening = m.type === 'OPENING';
                          const isInflow = m.flow === 'INCOME';
                          const badge = getMovementTypeBadge(m);

                          return (
                            <tr key={m.id} className="hover:bg-stone-50/80 transition-colors">
                              <td className="py-3 px-4 text-stone-500 font-mono whitespace-nowrap">
                                {formatTimeOnly(m.createdAt)}
                              </td>
                              <td className="py-3 px-4 whitespace-nowrap">
                                <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${badge.bg}`}>
                                  {badge.label}
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                <p className="font-bold text-stone-900">{m.description}</p>
                                {m.notes && <p className="text-[11px] text-stone-400 mt-0.5">{m.notes}</p>}
                              </td>
                              <td className="py-3 px-4 text-stone-500 whitespace-nowrap">
                                {m.creatorName || 'Usuario'}
                              </td>
                              <td className="py-3 px-4 text-right font-mono font-black whitespace-nowrap text-sm">
                                {isOpening ? (
                                  <span className="text-stone-700">{formatCurrency(m.amount)}</span>
                                ) : isInflow ? (
                                  <span className="text-emerald-600">+{formatCurrency(m.amount)}</span>
                                ) : (
                                  <span className="text-rose-600">-{formatCurrency(m.amount)}</span>
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
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* SUBTAB 2: HISTORIAL DE SESIONES                                       */}
      {/* --------------------------------------------------------------------- */}
      {activeSubTab === 'history' && (
        <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
            <div>
              <h3 className="font-black text-stone-900 text-sm">Historial de Sesiones Anteriores</h3>
              <p className="text-[11px] text-stone-500">Consulta de turnos pasados, arqueos y diferencias (Solo Lectura)</p>
            </div>
          </div>

          {historySessions.length === 0 ? (
            <div className="p-10 text-center text-stone-400 text-xs">
              No hay sesiones históricas registradas todavía.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-stone-200 bg-stone-50/80 text-stone-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="py-3 px-4">Fecha y Apertura</th>
                    <th className="py-3 px-4">Cierre</th>
                    <th className="py-3 px-4 text-right">Saldo Inicial</th>
                    <th className="py-3 px-4 text-right">Saldo Esperado</th>
                    <th className="py-3 px-4 text-right">Efectivo Contado</th>
                    <th className="py-3 px-4 text-right">Diferencia</th>
                    <th className="py-3 px-4 text-center">Estado</th>
                    <th className="py-3 px-4 text-center">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {historySessions.map((s) => {
                    const diff = s.difference ?? ((s.actualAmount ?? 0) - (s.expectedAmount ?? 0));
                    const isClosed = s.status === 'CLOSED';

                    return (
                      <tr key={s.id} className="hover:bg-stone-50 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <p className="font-bold text-stone-900">{formatDateTime(s.openedAt)}</p>
                          <p className="text-[10px] text-stone-400">Abierto por: {s.openerName || 'Usuario'}</p>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {isClosed ? (
                            <>
                              <p className="font-bold text-stone-900">{formatDateTime(s.closedAt)}</p>
                              <p className="text-[10px] text-stone-400">Cerrado por: {s.closerName || 'Usuario'}</p>
                            </>
                          ) : (
                            <span className="text-emerald-700 font-bold">Turno en curso</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-stone-700 whitespace-nowrap">
                          {formatCurrency(s.initialAmount)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-stone-900 whitespace-nowrap">
                          {isClosed ? formatCurrency(s.expectedAmount) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-black text-stone-900 whitespace-nowrap">
                          {isClosed ? formatCurrency(s.actualAmount) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono whitespace-nowrap">
                          {!isClosed ? (
                            <span className="text-stone-400">-</span>
                          ) : diff === 0 ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-black text-[11px]">
                              $0
                            </span>
                          ) : diff > 0 ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-700 font-black text-[11px]">
                              +{formatCurrency(diff)}
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-300 text-rose-700 font-black text-[11px]">
                              {formatCurrency(diff)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {isClosed ? (
                            <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-bold text-[10px]">
                              CERRADA
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                              ABIERTA
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleInspectHistoricSession(s)}
                            className="p-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition-colors cursor-pointer"
                            title="Ver detalle y movimientos"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
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

      {/* ===================================================================== */}
      {/* MODAL 1: ABRIR CAJA                                                   */}
      {/* ===================================================================== */}
      {isOpenModalVisible && (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                  <Unlock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-stone-900 text-base">Apertura de Caja</h3>
                  <p className="text-xs text-stone-500">Comenzar la jornada operativa</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpenModalVisible(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleOpenSessionSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-stone-800 uppercase tracking-wider mb-1.5">
                  Monto Inicial en Efectivo ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-base">$</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={openInitialAmount}
                    onChange={(e) => setOpenInitialAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 rounded-xl border border-stone-300 font-mono font-black text-xl text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-600"
                    placeholder="0"
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-stone-400 mt-1">Importe de efectivo físico con el que arranca la caja.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Notas u Observaciones (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={openNotes}
                  onChange={(e) => setOpenNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30"
                  placeholder="Ej: Cambio inicial para dar vuelto"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsOpenModalVisible(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? 'Abriendo...' : 'ABRIR CAJA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: RETIRO DE EFECTIVO                                           */}
      {/* ===================================================================== */}
      {isWithdrawModalVisible && currentSession && (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold">
                  <Banknote className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-stone-900 text-base">Retirar Efectivo</h3>
                  <p className="text-xs text-stone-500">Extracción física de dinero de la caja</p>
                </div>
              </div>
              <button
                onClick={() => setIsWithdrawModalVisible(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleWithdrawalSubmit} className="space-y-4">
              {/* Balance reminder */}
              <div className="bg-stone-50 p-3.5 rounded-2xl border border-stone-200 flex justify-between items-center text-xs">
                <span className="text-stone-600 font-medium">Saldo disponible actual:</span>
                <span className="font-mono font-black text-stone-900 text-sm">
                  {formatCurrency(currentAvailableBalance)}
                </span>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-xs font-black text-stone-800 uppercase tracking-wider mb-1.5">
                  Importe a Retirar ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-base">$</span>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    max={currentAvailableBalance}
                    required
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 rounded-xl border border-stone-300 font-mono font-black text-xl text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-600"
                    placeholder="0"
                    autoFocus
                  />
                </div>
              </div>

              {/* Confirmation Preview */}
              {parsedWithdrawAmount > 0 && (
                <div className={`p-3.5 rounded-xl border space-y-1.5 text-xs ${
                  parsedWithdrawAmount > currentAvailableBalance 
                    ? 'bg-rose-50 border-rose-300 text-rose-900' 
                    : 'bg-amber-50 border-amber-300 text-amber-950'
                }`}>
                  <p className="font-bold">
                    Retirar {formatCurrency(parsedWithdrawAmount)} de la caja
                  </p>
                  <p className="text-[11px] opacity-90">
                    El saldo esperado quedará en: <strong className="font-mono">{formatCurrency(balanceAfterWithdrawal)}</strong>
                  </p>
                  {parsedWithdrawAmount > currentAvailableBalance && (
                    <p className="text-[11px] font-bold text-rose-700 pt-1">
                      ⚠️ El importe supera el efectivo disponible en caja.
                    </p>
                  )}
                </div>
              )}

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Motivo / Concepto del Retiro
                </label>
                <input
                  type="text"
                  value={withdrawDescription}
                  onChange={(e) => setWithdrawDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30"
                  placeholder="Ej: Retiro parcial, depósito bancario, retiro dueño..."
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Observaciones (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={withdrawNotes}
                  onChange={(e) => setWithdrawNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30"
                  placeholder="Detalles adicionales..."
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsWithdrawModalVisible(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading || !isWithdrawalValid}
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-stone-950 text-xs font-black shadow-md shadow-amber-500/20 cursor-pointer transition-all"
                >
                  {actionLoading ? 'Registrando...' : 'Confirmar Retiro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: CERRAR CAJA / ARQUEO                                         */}
      {/* ===================================================================== */}
      {isCloseModalVisible && currentSession && (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-stone-900 text-base">Arqueo de Caja y Cierre</h3>
                  <p className="text-xs text-stone-500">Conteo físico y control de diferencias</p>
                </div>
              </div>
              <button
                onClick={() => setIsCloseModalVisible(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCloseSessionSubmit} className="space-y-4">
              {/* Summary Balance Comparison Card */}
              <div className="bg-stone-50 rounded-2xl p-4 border border-stone-200 space-y-2.5">
                <div className="flex justify-between items-center text-xs text-stone-600">
                  <span>Saldo Inicial:</span>
                  <span className="font-mono font-bold">{formatCurrency(currentSession.initialAmount)}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-emerald-600">
                  <span>+ Ingresos de Efectivo:</span>
                  <span className="font-mono font-bold">+{formatCurrency(currentSummary?.totalInflows)}</span>
                </div>
                <div className="flex justify-between items-center text-xs text-rose-600">
                  <span>− Egresos y Retiros:</span>
                  <span className="font-mono font-bold">-{formatCurrency(currentSummary?.totalOutflows)}</span>
                </div>
                <div className="pt-2 border-t border-stone-200 flex justify-between items-center text-sm font-black text-stone-900">
                  <span>Saldo Esperado:</span>
                  <span className="font-mono text-emerald-700 text-lg">{formatCurrency(expectedCloseAmount)}</span>
                </div>
              </div>

              {/* Actual Count Input */}
              <div>
                <label className="block text-xs font-black text-stone-800 uppercase tracking-wider mb-1.5">
                  Efectivo Contado en Caja ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-base">$</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={closeActualAmount}
                    onChange={(e) => setCloseActualAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-3 rounded-xl border-2 border-stone-300 font-mono font-black text-xl text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500/30 focus:border-rose-600"
                    placeholder="0"
                    autoFocus
                  />
                </div>
              </div>

              {/* Live Difference Badge */}
              <div className="p-3.5 rounded-xl border flex items-center justify-between text-xs bg-stone-50/50">
                <span className="font-bold text-stone-700">Diferencia de Arqueo:</span>
                {closeDifference === 0 ? (
                  <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-black">
                    Diferencia: $0 (Exacto)
                  </span>
                ) : closeDifference > 0 ? (
                  <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 font-black">
                    Diferencia: +{formatCurrency(closeDifference)} (Sobrante)
                  </span>
                ) : (
                  <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-300 font-black">
                    Diferencia: {formatCurrency(closeDifference)} (Faltante)
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Observaciones de Cierre (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-rose-500/30"
                  placeholder="Ej: Justificación de diferencias o retiro final..."
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCloseModalVisible(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-6 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-md shadow-rose-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? 'Cerrando...' : 'CERRAR CAJA'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 4: MOVIMIENTO MANUAL                                            */}
      {/* ===================================================================== */}
      {isMovementModalVisible && currentSession && (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-stone-900 text-base">Movimiento Manual</h3>
                  <p className="text-xs text-stone-500">Ingreso o egreso directo de caja</p>
                </div>
              </div>
              <button
                onClick={() => setIsMovementModalVisible(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleManualMovementSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-stone-700 uppercase tracking-wider mb-2">
                  Dirección del Flujo
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMovType('INCOME');
                      setMovFlow('INCOME');
                    }}
                    className={`p-3 rounded-xl border text-xs font-black flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                      movFlow === 'INCOME'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 ring-2 ring-emerald-500/20'
                        : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                    <span>Ingreso (+)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMovType('EXPENSE_CASH');
                      setMovFlow('EXPENSE');
                    }}
                    className={`p-3 rounded-xl border text-xs font-black flex items-center justify-center space-x-1.5 transition-all cursor-pointer ${
                      movFlow === 'EXPENSE'
                        ? 'bg-rose-50 border-rose-300 text-rose-800 ring-2 ring-rose-500/20'
                        : 'border-stone-200 text-stone-600 hover:bg-stone-50'
                    }`}
                  >
                    <ArrowDownRight className="w-4 h-4 text-rose-600" />
                    <span>Egreso (-)</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-stone-700 uppercase tracking-wider mb-1.5">
                  Importe ($)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-sm">$</span>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    required
                    value={movAmount}
                    onChange={(e) => setMovAmount(e.target.value)}
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-stone-300 font-mono font-black text-lg text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Concepto / Descripción
                </label>
                <input
                  type="text"
                  required
                  value={movDescription}
                  onChange={(e) => setMovDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
                  placeholder="Ej: Cambio de billetes, flete de urgencia..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  Notas Adicionales (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={movNotes}
                  onChange={(e) => setMovNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
                  placeholder="Detalles..."
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsMovementModalVisible(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-stone-600 hover:bg-stone-100 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-md shadow-blue-600/20 disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? 'Registrando...' : 'Registrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 5: DETALLE DE SESIÓN HISTÓRICA                                  */}
      {/* ===================================================================== */}
      {inspectingSession && (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-stone-100 shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-9 h-9 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center font-bold">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-stone-900 text-base">Detalle de Sesión Histórica</h3>
                  <p className="text-xs text-stone-500">
                    Apertura: {formatDateTime(inspectingSession.openedAt)} — Cierre: {formatDateTime(inspectingSession.closedAt)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setInspectingSession(null)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resumen de la sesión */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-stone-50 p-4 rounded-2xl border border-stone-200 shrink-0 text-xs">
              <div>
                <span className="text-stone-400 block text-[10px] font-bold uppercase">Apertura (Inicial)</span>
                <span className="font-mono font-black text-stone-900">{formatCurrency(inspectingSession.initialAmount)}</span>
                <span className="text-[10px] text-stone-400 block mt-0.5">{inspectingSession.openerName || 'Usuario'}</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px] font-bold uppercase">Saldo Esperado</span>
                <span className="font-mono font-black text-stone-900">{formatCurrency(inspectingSession.expectedAmount)}</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px] font-bold uppercase">Efectivo Contado</span>
                <span className="font-mono font-black text-stone-900">{formatCurrency(inspectingSession.actualAmount)}</span>
                <span className="text-[10px] text-stone-400 block mt-0.5">{inspectingSession.closerName || 'Usuario'}</span>
              </div>
              <div>
                <span className="text-stone-400 block text-[10px] font-bold uppercase">Diferencia</span>
                <span className={`font-mono font-black ${
                  (inspectingSession.difference || 0) === 0 ? 'text-emerald-700' : (inspectingSession.difference || 0) > 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {(inspectingSession.difference || 0) > 0 ? '+' : ''}{formatCurrency(inspectingSession.difference)}
                </span>
              </div>
            </div>

            {/* Movimientos exclusivos de la sesión */}
            <div className="overflow-y-auto flex-1 border border-stone-200 rounded-xl">
              {loadingInspected ? (
                <div className="p-8 text-center text-xs text-stone-400">Cargando movimientos...</div>
              ) : inspectedMovements.length === 0 ? (
                <div className="p-8 text-center text-xs text-stone-400">No hay movimientos detallados para esta sesión.</div>
              ) : (
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-stone-100 text-stone-600 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Hora</th>
                      <th className="py-2.5 px-3">Tipo</th>
                      <th className="py-2.5 px-3">Descripción</th>
                      <th className="py-2.5 px-3 text-right">Importe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {inspectedMovements.map((m) => {
                      const badge = getMovementTypeBadge(m);
                      return (
                        <tr key={m.id} className="hover:bg-stone-50">
                          <td className="py-2.5 px-3 text-stone-500 font-mono whitespace-nowrap">
                            {formatTimeOnly(m.createdAt)}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${badge.bg}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-stone-800">
                            {m.description}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap">
                            {m.flow === 'INCOME' ? (
                              <span className="text-emerald-600">+{formatCurrency(m.amount)}</span>
                            ) : m.flow === 'EXPENSE' ? (
                              <span className="text-rose-600">-{formatCurrency(m.amount)}</span>
                            ) : (
                              <span className="text-stone-700">{formatCurrency(m.amount)}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="pt-2 flex justify-end shrink-0">
              <button
                onClick={() => setInspectingSession(null)}
                className="px-5 py-2.5 rounded-xl bg-stone-900 text-white text-xs font-bold cursor-pointer"
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
