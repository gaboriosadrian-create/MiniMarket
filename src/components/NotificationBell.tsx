import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useAuth } from '../lib/authContext';
import { useNavigation } from '../lib/navigationContext';
import { AppNotification } from '../types';
import { 
  subscribeToUserNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead 
} from '../lib/notificationService';
import { handleIncomingNotificationsSound } from '../lib/soundService';
import { 
  Bell, 
  CheckCheck, 
  Clock, 
  FileSpreadsheet, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  PackageCheck,
  ChevronRight,
  X,
  Search,
  Truck,
  Send,
  Calendar,
  GripHorizontal,
  RotateCcw,
  AlertTriangle,
  CreditCard
} from 'lucide-react';

interface NotificationBellProps {
  className?: string;
  isDark?: boolean;
}

type NotificationFilterCategory = 'ALL' | 'SOLICITUDES' | 'APROBACIONES' | 'PROVEEDORES' | 'RECEPCION';
type NotificationDateFilter = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM';

export const NotificationBell: React.FC<NotificationBellProps> = ({ 
  className = '',
  isDark = false
}) => {
  const { userProfile, business } = useAuth();
  const { navItems } = useNavigation();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<NotificationFilterCategory>('ALL');
  const [selectedDateFilter, setSelectedDateFilter] = useState<NotificationDateFilter>('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const headerDragRef = useRef<HTMLDivElement>(null);
  const isFirstLoadRef = useRef(true);

  // Position state for the popover (supports dragging)
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number; width: number }>({ 
    top: 60, 
    left: 20, 
    width: 400 
  });

  // Dragging state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ startX: number; startY: number; startTop: number; startLeft: number }>({
    startX: 0,
    startY: 0,
    startTop: 0,
    startLeft: 0
  });

  useEffect(() => {
    if (!business?.id || !userProfile?.uid) return;

    const unsubscribe = subscribeToUserNotifications(
      business.id,
      userProfile.uid,
      userProfile.role,
      (data) => {
        handleIncomingNotificationsSound(data, isFirstLoadRef.current);
        if (isFirstLoadRef.current) {
          isFirstLoadRef.current = false;
        }
        setNotifications(data);
      }
    );

    return () => unsubscribe();
  }, [business?.id, userProfile?.uid, userProfile?.role]);

  // Calculate default position relative to bell button
  const resetToDefaultPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const width = Math.min(440, Math.max(310, screenWidth - 24));

    let left: number;
    if (rect.left < screenWidth / 2) {
      left = Math.max(12, rect.left);
    } else {
      left = rect.right - width;
    }

    if (left + width > screenWidth - 12) {
      left = screenWidth - width - 12;
    }
    if (left < 12) {
      left = 12;
    }

    let top = rect.bottom + 8;
    if (top + 480 > screenHeight && rect.top > 480) {
      top = Math.max(12, rect.top - 480);
    }

    setPopoverPos({ top, left, width });
  }, []);

  useEffect(() => {
    if (isOpen) {
      resetToDefaultPosition();
      const handleResize = () => {
        if (!isDraggingRef.current) {
          resetToDefaultPosition();
        }
      };
      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, [isOpen, resetToDefaultPosition]);

  // Click outside to close (only when not dragging)
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isDraggingRef.current) return;
      if (
        popoverRef.current && 
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Dragging handlers on Modal Header
  const handleMouseDownHeader = (e: React.MouseEvent) => {
    // If clicked on a button or interactive child, skip drag
    if ((e.target as HTMLElement).closest('button, input, select')) return;
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startTop: popoverPos.top,
      startLeft: popoverPos.left
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const deltaX = moveEvent.clientX - dragStartRef.current.startX;
      const deltaY = moveEvent.clientY - dragStartRef.current.startY;
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;

      const modalWidth = popoverPos.width;
      const modalHeight = popoverRef.current ? popoverRef.current.offsetHeight : 450;

      const newLeft = Math.max(8, Math.min(screenWidth - modalWidth - 8, dragStartRef.current.startLeft + deltaX));
      const newTop = Math.max(8, Math.min(screenHeight - modalHeight - 8, dragStartRef.current.startTop + deltaY));

      setPopoverPos(prev => ({ ...prev, left: newLeft, top: newTop }));
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleTouchStartHeader = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button, input, select')) return;
    const touch = e.touches[0];
    isDraggingRef.current = true;
    dragStartRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      startTop: popoverPos.top,
      startLeft: popoverPos.left
    };

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (!isDraggingRef.current) return;
      const t = moveEvent.touches[0];
      const deltaX = t.clientX - dragStartRef.current.startX;
      const deltaY = t.clientY - dragStartRef.current.startY;
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;

      const modalWidth = popoverPos.width;
      const modalHeight = popoverRef.current ? popoverRef.current.offsetHeight : 450;

      const newLeft = Math.max(8, Math.min(screenWidth - modalWidth - 8, dragStartRef.current.startLeft + deltaX));
      const newTop = Math.max(8, Math.min(screenHeight - modalHeight - 8, dragStartRef.current.startTop + deltaY));

      setPopoverPos(prev => ({ ...prev, left: newLeft, top: newTop }));
    };

    const handleTouchEnd = () => {
      isDraggingRef.current = false;
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };

    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleToggle = () => {
    if (!isOpen) {
      resetToDefaultPosition();
    }
    setIsOpen(!isOpen);
  };

  const handleNotificationClick = async (notification: AppNotification) => {
    if (!notification.read) {
      try {
        await markNotificationAsRead(notification.id);
      } catch (err) {
        console.warn('Error marking notification as read:', err);
      }
    }

    const type = notification.type;
    const isApprovalRelated = 
      type === 'SOLICITUD_APROBADA' || 
      type === 'SOLICITUD_MODIFICADA' ||
      type === 'REPLENISHMENT_APPROVED' || 
      type === 'REPLENISHMENT_MODIFIED';

    const isPendingApproval = 
      type === 'SOLICITUD_PENDIENTE_APROBACION' ||
      type === 'REPLENISHMENT_PENDING_APPROVAL' ||
      type === 'SOLICITUD_CREADA';

    const isReceivingRelated =
      type === 'RECEPCION_CONTROL_INICIADO' ||
      type === 'RECEPCION_PARCIAL' ||
      type === 'RECEPCION_COMPLETADA' ||
      type === 'RECEPCION_CERRADA' ||
      type === 'PROVEEDOR_CONFIRMO_SOLICITUD' ||
      type === 'PROVIDER_CONFIRMED' ||
      type === 'PROVIDER_CONFIRMED_ORDER' ||
      type === 'SOLICITUD_ENVIADA_PROVEEDOR';

    const isRejection = 
      type === 'SOLICITUD_RECHAZADA' || 
      type === 'REPLENISHMENT_REJECTED';

    const isObligationRelated = 
      type === 'OBLIGACION_VENCIDA' ||
      type === 'OBLIGACION_PROXIMO_VENCIMIENTO' ||
      type === 'GASTO_RECURRENTE_GENERADO' ||
      type === 'PROVEEDOR_VENCIDO' ||
      type === 'PROXIMO_VENCIMIENTO' ||
      type === 'COMPRA_PENDIENTE' ||
      type === 'RECEPCION_PENDIENTE_PAGO' ||
      type === 'PAGO_REALIZADO';

    const isAdmin = userProfile?.role === 'ADMIN' || userProfile?.role === 'SUPER_ADMIN';

    if (isPendingApproval) {
      const targetNav = navItems.find(item => item.id === 'replenishment' || item.id === 'solicitud');
      if (targetNav) {
        targetNav.onClick();
      }
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('minimarket:navigate-replenishment', {
          detail: {
            tab: 'APPROVALS',
            orderId: notification.metadata?.replenishmentId || notification.metadata?.requestId
          }
        }));
      }, 60);
    } else if (isObligationRelated && isAdmin) {
      const targetNav = navItems.find(item => item.id === 'obligations' || item.id === 'gastos');
      if (targetNav) {
        targetNav.onClick();
      }
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('minimarket:navigate-obligations', {
          detail: {
            obligationId: notification.metadata?.obligationId,
            supplierName: notification.metadata?.supplierName,
            priority: notification.metadata?.priority,
            tab: notification.metadata?.templateId ? 'recurring' : 'list'
          }
        }));
      }, 60);
    } else if (isApprovalRelated) {
      if (isAdmin) {
        const targetNav = navItems.find(item => item.id === 'receivings' || item.id === 'receiving');
        if (targetNav) {
          targetNav.onClick();
        }
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('minimarket:navigate-receiving', {
            detail: {
              statusFilter: 'APPROVED',
              orderId: notification.metadata?.replenishmentId
            }
          }));
        }, 60);
      } else {
        const targetNav = navItems.find(item => item.id === 'receiving' || item.id === 'receivings');
        if (targetNav) {
          targetNav.onClick();
        }
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('minimarket:navigate-receiving', {
            detail: {
              statusFilter: 'APPROVED',
              orderId: notification.metadata?.replenishmentId
            }
          }));
        }, 60);
      }
    } else if (isRejection) {
      const targetNav = navItems.find(item => item.id === 'replenishment' || item.id === 'solicitud');
      if (targetNav) {
        targetNav.onClick();
      }
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('minimarket:navigate-replenishment', {
          detail: {
            tab: 'HISTORY',
            orderId: notification.metadata?.replenishmentId
          }
        }));
      }, 60);
    } else if (isReceivingRelated) {
      const receivingTabId = isAdmin ? 'receivings' : 'receiving';
      const targetNav = navItems.find(item => item.id === receivingTabId || item.id === 'receivings' || item.id === 'receiving');
      if (targetNav) {
        targetNav.onClick();
      }
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('minimarket:navigate-receiving', {
          detail: {
            receivingId: notification.metadata?.receivingId,
            orderId: notification.metadata?.replenishmentId
          }
        }));
      }, 60);
    } else if (notification.linkTab) {
      let targetTab = notification.linkTab;
      if (targetTab === 'receiving' && isAdmin) {
        targetTab = 'receivings';
      } else if (targetTab === 'receivings' && !isAdmin) {
        targetTab = 'receiving';
      }
      const targetNav = navItems.find(item => item.id === targetTab || item.id === notification.linkTab);
      if (targetNav) {
        targetNav.onClick();
      }
    }
    setIsOpen(false);
  };

  const handleMarkAllRead = async () => {
    if (!business?.id || !userProfile?.uid) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsAsRead(business.id, userProfile.uid, userProfile.role);
    } catch (err) {
      console.warn('Error marking all as read:', err);
    } finally {
      setMarkingAll(false);
    }
  };

  const formatNotificationTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 1) return 'Hace un momento';
      if (diffMins < 60) return `Hace ${diffMins} min`;
      if (diffHours < 24) return `Hace ${diffHours} h`;
      return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // Event Styling Map per specification
  const getEventBadge = (type: AppNotification['type']) => {
    switch (type) {
      case 'SOLICITUD_PENDIENTE_APROBACION':
      case 'REPLENISHMENT_PENDING_APPROVAL':
        return {
          icon: <Clock className="w-3.5 h-3.5 text-amber-700" />,
          bg: 'bg-amber-100 text-amber-900 border-amber-300',
          dot: 'bg-amber-500',
          label: 'Pendiente'
        };
      case 'SOLICITUD_APROBADA':
      case 'REPLENISHMENT_APPROVED':
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />,
          bg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
          dot: 'bg-emerald-600',
          label: 'Aprobada'
        };
      case 'SOLICITUD_MODIFICADA':
      case 'REPLENISHMENT_MODIFIED':
        return {
          icon: <AlertCircle className="w-3.5 h-3.5 text-amber-700" />,
          bg: 'bg-amber-100 text-amber-900 border-amber-300',
          dot: 'bg-amber-500',
          label: 'Modificada'
        };
      case 'SOLICITUD_RECHAZADA':
      case 'REPLENISHMENT_REJECTED':
        return {
          icon: <XCircle className="w-3.5 h-3.5 text-rose-700" />,
          bg: 'bg-rose-100 text-rose-900 border-rose-300',
          dot: 'bg-rose-600',
          label: 'Rechazada'
        };
      case 'SOLICITUD_ENVIADA_PROVEEDOR':
        return {
          icon: <Send className="w-3.5 h-3.5 text-blue-700" />,
          bg: 'bg-blue-100 text-blue-900 border-blue-300',
          dot: 'bg-blue-600',
          label: 'Enviada'
        };
      case 'PROVEEDOR_CONFIRMO_SOLICITUD':
      case 'PROVIDER_CONFIRMED':
      case 'PROVIDER_CONFIRMED_ORDER':
        return {
          icon: <Truck className="w-3.5 h-3.5 text-purple-700" />,
          bg: 'bg-purple-100 text-purple-900 border-purple-300',
          dot: 'bg-purple-600',
          label: 'Confirmada por Proveedor'
        };
      case 'RECEPCION_CONTROL_INICIADO':
        return {
          icon: <Clock className="w-3.5 h-3.5 text-amber-700" />,
          bg: 'bg-amber-100 text-amber-900 border-amber-300',
          dot: 'bg-amber-500',
          label: 'Control Iniciado'
        };
      case 'RECEPCION_PARCIAL':
        return {
          icon: <AlertCircle className="w-3.5 h-3.5 text-orange-700" />,
          bg: 'bg-orange-100 text-orange-900 border-orange-300',
          dot: 'bg-orange-600',
          label: 'Faltantes'
        };
      case 'RECEPCION_COMPLETADA':
        return {
          icon: <PackageCheck className="w-3.5 h-3.5 text-emerald-700" />,
          bg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
          dot: 'bg-emerald-600',
          label: 'Completada'
        };
      case 'RECEPCION_CERRADA':
        return {
          icon: <PackageCheck className="w-3.5 h-3.5 text-teal-950" />,
          bg: 'bg-teal-100 text-teal-950 border-teal-300',
          dot: 'bg-teal-800',
          label: 'Cerrada'
        };
      case 'OBLIGACION_VENCIDA':
      case 'PROVEEDOR_VENCIDO':
        return {
          icon: <AlertTriangle className="w-3.5 h-3.5 text-rose-700" />,
          bg: 'bg-rose-100 text-rose-900 border-rose-300',
          dot: 'bg-rose-600',
          label: 'Vencido (Urgente)'
        };
      case 'OBLIGACION_PROXIMO_VENCIMIENTO':
      case 'PROXIMO_VENCIMIENTO':
        return {
          icon: <Clock className="w-3.5 h-3.5 text-amber-700" />,
          bg: 'bg-amber-100 text-amber-900 border-amber-300',
          dot: 'bg-amber-500',
          label: 'Próximo Vto.'
        };
      case 'GASTO_RECURRENTE_GENERADO':
        return {
          icon: <RotateCcw className="w-3.5 h-3.5 text-blue-700" />,
          bg: 'bg-blue-100 text-blue-900 border-blue-300',
          dot: 'bg-blue-600',
          label: 'Recurrente'
        };
      case 'COMPRA_PENDIENTE':
      case 'RECEPCION_PENDIENTE_PAGO':
        return {
          icon: <CreditCard className="w-3.5 h-3.5 text-purple-700" />,
          bg: 'bg-purple-100 text-purple-900 border-purple-300',
          dot: 'bg-purple-600',
          label: 'Por Pagar'
        };
      case 'PAGO_REALIZADO':
        return {
          icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />,
          bg: 'bg-emerald-100 text-emerald-900 border-emerald-300',
          dot: 'bg-emerald-600',
          label: 'Pagado'
        };
      default:
        return {
          icon: <FileSpreadsheet className="w-3.5 h-3.5 text-stone-600" />,
          bg: 'bg-stone-100 text-stone-800 border-stone-200',
          dot: 'bg-stone-500',
          label: 'Sistema'
        };
    }
  };

  // Date checker helper
  const checkDateMatch = (isoDate?: string): boolean => {
    if (!isoDate) return true;
    if (selectedDateFilter === 'ALL') return true;

    try {
      const d = new Date(isoDate);
      if (isNaN(d.getTime())) return true;
      const now = new Date();

      if (selectedDateFilter === 'TODAY') {
        return (
          d.getDate() === now.getDate() &&
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      }

      if (selectedDateFilter === 'WEEK') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return d >= weekAgo;
      }

      if (selectedDateFilter === 'MONTH') {
        return (
          d.getMonth() === now.getMonth() &&
          d.getFullYear() === now.getFullYear()
        );
      }

      if (selectedDateFilter === 'CUSTOM') {
        if (customStartDate) {
          const start = new Date(customStartDate + 'T00:00:00');
          if (d < start) return false;
        }
        if (customEndDate) {
          const end = new Date(customEndDate + 'T23:59:59');
          if (d > end) return false;
        }
        return true;
      }

      return true;
    } catch {
      return true;
    }
  };

  // Filtered Notifications based on Search Query, Category & Date
  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      // 1. Text Search Query Filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = item.title?.toLowerCase().includes(query);
        const matchesMsg = item.message?.toLowerCase().includes(query);
        const matchesSupplier = item.metadata?.supplierName?.toLowerCase().includes(query);
        const matchesReq = item.metadata?.requestId?.toLowerCase().includes(query) || item.metadata?.replenishmentId?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesMsg && !matchesSupplier && !matchesReq) {
          return false;
        }
      }

      // 2. Category Filter
      if (selectedCategory === 'SOLICITUDES') {
        const isReq = (
          item.type === 'SOLICITUD_CREADA' ||
          item.type === 'SOLICITUD_PENDIENTE_APROBACION' ||
          item.type === 'REPLENISHMENT_PENDING_APPROVAL' ||
          item.type === 'SOLICITUD_ENVIADA_PROVEEDOR'
        );
        if (!isReq) return false;
      } else if (selectedCategory === 'APROBACIONES') {
        const isApp = (
          item.type === 'SOLICITUD_APROBADA' ||
          item.type === 'SOLICITUD_MODIFICADA' ||
          item.type === 'SOLICITUD_RECHAZADA' ||
          item.type === 'REPLENISHMENT_APPROVED' ||
          item.type === 'REPLENISHMENT_MODIFIED' ||
          item.type === 'REPLENISHMENT_REJECTED'
        );
        if (!isApp) return false;
      } else if (selectedCategory === 'PROVEEDORES') {
        const isProv = (
          item.type === 'PROVEEDOR_CONFIRMO_SOLICITUD' ||
          item.type === 'PROVIDER_CONFIRMED' ||
          item.type === 'PROVIDER_CONFIRMED_ORDER' ||
          item.type === 'SOLICITUD_ENVIADA_PROVEEDOR'
        );
        if (!isProv) return false;
      } else if (selectedCategory === 'RECEPCION') {
        const isRec = (
          item.type === 'RECEPCION_CONTROL_INICIADO' ||
          item.type === 'RECEPCION_PARCIAL' ||
          item.type === 'RECEPCION_COMPLETADA' ||
          item.type === 'RECEPCION_CERRADA'
        );
        if (!isRec) return false;
      }

      // 3. Date Filter
      if (!checkDateMatch(item.createdAt)) {
        return false;
      }

      return true;
    });
  }, [notifications, searchQuery, selectedCategory, selectedDateFilter, customStartDate, customEndDate]);

  return (
    <div className={`relative ${className}`}>
      {/* Bell Trigger Button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        aria-label="Ver Centro de Eventos y Notificaciones"
        title="Centro de Eventos"
        className={`relative p-2 rounded-xl transition-all duration-150 flex items-center justify-center cursor-pointer min-h-[40px] min-w-[40px] ${
          isDark
            ? 'text-stone-300 hover:text-white hover:bg-stone-800 active:bg-stone-700'
            : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100 active:bg-stone-200'
        }`}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[18px] h-[18px] bg-rose-600 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 border-2 border-stone-900 animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Floating Draggable Popover */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-[9998] bg-black/20 sm:bg-transparent"
          onClick={() => setIsOpen(false)}
        >
          <div
            ref={popoverRef}
            style={{
              position: 'fixed',
              top: `${popoverPos.top}px`,
              left: `${popoverPos.left}px`,
              width: `${popoverPos.width}px`,
              maxHeight: 'calc(100vh - 40px)',
            }}
            className="bg-white rounded-2xl shadow-2xl border border-stone-200 z-[9999] overflow-hidden animate-in fade-in zoom-in-95 duration-100 flex flex-col pointer-events-auto select-none"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Draggable Header */}
            <div 
              ref={headerDragRef}
              onMouseDown={handleMouseDownHeader}
              onTouchStart={handleTouchStartHeader}
              className="p-3.5 bg-stone-900 text-white flex items-center justify-between shrink-0 cursor-grab active:cursor-grabbing border-b border-stone-800 transition-colors"
              title="Arrastra para mover el modal"
            >
              <div className="flex items-center space-x-2 pointer-events-none">
                <GripHorizontal className="w-4 h-4 text-stone-500 mr-0.5" />
                <Bell className="w-4 h-4 text-amber-400" />
                <h4 className="font-black text-xs uppercase tracking-wider">Centro de Eventos</h4>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-extrabold bg-rose-500 text-white px-2 py-0.5 rounded-full">
                    {unreadCount} nuevas
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={resetToDefaultPosition}
                  className="p-1 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
                  title="Restablecer posición anclada"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>

                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    disabled={markingAll}
                    className="text-[11px] font-bold text-stone-300 hover:text-white px-2 py-1 rounded-lg hover:bg-stone-800 transition-colors flex items-center space-x-1 cursor-pointer"
                    title="Marcar todas como leídas"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Leídas</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Search and Filters Bar */}
            <div className="p-2.5 bg-stone-50 border-b border-stone-200 shrink-0 space-y-2 select-text">
              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por texto, proveedor o pedido..."
                  className="w-full pl-8 pr-7 py-1.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-800 placeholder:text-stone-400 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-400"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Category Filter Chips */}
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none text-[11px]">
                <button
                  type="button"
                  onClick={() => setSelectedCategory('ALL')}
                  className={`px-2.5 py-0.5 rounded-full font-bold transition-colors whitespace-nowrap cursor-pointer ${
                    selectedCategory === 'ALL'
                      ? 'bg-stone-900 text-white'
                      : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
                  }`}
                >
                  Todas
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('SOLICITUDES')}
                  className={`px-2.5 py-0.5 rounded-full font-bold transition-colors whitespace-nowrap cursor-pointer ${
                    selectedCategory === 'SOLICITUDES'
                      ? 'bg-amber-600 text-white'
                      : 'bg-white text-stone-600 hover:bg-amber-50 border border-stone-200'
                  }`}
                >
                  Solicitudes
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('APROBACIONES')}
                  className={`px-2.5 py-0.5 rounded-full font-bold transition-colors whitespace-nowrap cursor-pointer ${
                    selectedCategory === 'APROBACIONES'
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white text-stone-600 hover:bg-emerald-50 border border-stone-200'
                  }`}
                >
                  Aprobaciones
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('PROVEEDORES')}
                  className={`px-2.5 py-0.5 rounded-full font-bold transition-colors whitespace-nowrap cursor-pointer ${
                    selectedCategory === 'PROVEEDORES'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white text-stone-600 hover:bg-purple-50 border border-stone-200'
                  }`}
                >
                  Proveedores
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedCategory('RECEPCION')}
                  className={`px-2.5 py-0.5 rounded-full font-bold transition-colors whitespace-nowrap cursor-pointer ${
                    selectedCategory === 'RECEPCION'
                      ? 'bg-teal-700 text-white'
                      : 'bg-white text-stone-600 hover:bg-teal-50 border border-stone-200'
                  }`}
                >
                  Recepción
                </button>
              </div>

              {/* Date Filter Bar */}
              <div className="flex items-center justify-between gap-1 pt-1 border-t border-stone-200 text-[10px]">
                <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                  <span className="font-extrabold text-stone-500 uppercase flex items-center gap-1 mr-1 shrink-0">
                    <Calendar className="w-3 h-3 text-stone-400" />
                    Fecha:
                  </span>
                  <button
                    type="button"
                    onClick={() => { setSelectedDateFilter('ALL'); setShowDatePicker(false); }}
                    className={`px-2 py-0.5 rounded-md font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      selectedDateFilter === 'ALL'
                        ? 'bg-stone-800 text-white'
                        : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
                    }`}
                  >
                    Todas
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSelectedDateFilter('TODAY'); setShowDatePicker(false); }}
                    className={`px-2 py-0.5 rounded-md font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      selectedDateFilter === 'TODAY'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-stone-600 hover:bg-blue-50 border border-stone-200'
                    }`}
                  >
                    Hoy
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSelectedDateFilter('WEEK'); setShowDatePicker(false); }}
                    className={`px-2 py-0.5 rounded-md font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      selectedDateFilter === 'WEEK'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-stone-600 hover:bg-blue-50 border border-stone-200'
                    }`}
                  >
                    7 días
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSelectedDateFilter('MONTH'); setShowDatePicker(false); }}
                    className={`px-2 py-0.5 rounded-md font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      selectedDateFilter === 'MONTH'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-stone-600 hover:bg-blue-50 border border-stone-200'
                    }`}
                  >
                    Mes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDateFilter('CUSTOM');
                      setShowDatePicker(!showDatePicker);
                    }}
                    className={`px-2 py-0.5 rounded-md font-bold transition-colors whitespace-nowrap cursor-pointer ${
                      selectedDateFilter === 'CUSTOM'
                        ? 'bg-purple-600 text-white'
                        : 'bg-white text-stone-600 hover:bg-purple-50 border border-stone-200'
                    }`}
                  >
                    Rango...
                  </button>
                </div>
              </div>

              {/* Custom Date Range Picker */}
              {selectedDateFilter === 'CUSTOM' && (
                <div className="p-2 bg-purple-50/50 border border-purple-200 rounded-xl space-y-1.5 animate-in fade-in">
                  <div className="flex items-center gap-2 text-[10px]">
                    <div className="flex-1">
                      <label className="block text-stone-500 font-bold mb-0.5">Desde:</label>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-stone-300 rounded-lg text-[11px] font-medium outline-none focus:border-purple-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-stone-500 font-bold mb-0.5">Hasta:</label>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-stone-300 rounded-lg text-[11px] font-medium outline-none focus:border-purple-500"
                      />
                    </div>
                    {(customStartDate || customEndDate) && (
                      <button
                        type="button"
                        onClick={() => { setCustomStartDate(''); setCustomEndDate(''); }}
                        className="self-end p-1 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                        title="Limpiar fechas"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* List of Notifications (Distinct Read vs Unread Styling) */}
            <div className="overflow-y-auto divide-y divide-stone-100 flex-1 max-h-[58vh] select-text">
              {filteredNotifications.length === 0 ? (
                <div className="p-8 text-center text-stone-400 space-y-2">
                  <Bell className="w-8 h-8 text-stone-300 mx-auto stroke-[1.5]" />
                  <p className="text-xs font-bold text-stone-600">
                    {searchQuery || selectedCategory !== 'ALL' || selectedDateFilter !== 'ALL'
                      ? 'No hay eventos que coincidan con la búsqueda y filtros'
                      : 'No tienes notificaciones'}
                  </p>
                  <p className="text-[11px] text-stone-400">
                    {searchQuery || selectedCategory !== 'ALL' || selectedDateFilter !== 'ALL'
                      ? 'Prueba modificando los filtros o fechas seleccionadas.'
                      : 'Te avisaremos en tiempo real ante cambios del circuito.'}
                  </p>
                </div>
              ) : (
                filteredNotifications.map((n) => {
                  const badge = getEventBadge(n.type);
                  const isUnread = !n.read;
                  return (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`p-3 sm:p-3.5 flex items-start space-x-3 cursor-pointer transition-all duration-150 ${
                        isUnread 
                          ? 'bg-amber-50/60 hover:bg-amber-100/50 border-l-4 border-l-amber-500' 
                          : 'bg-white hover:bg-stone-50 border-l-4 border-l-transparent'
                      }`}
                    >
                      <div className={`p-2 rounded-xl shrink-0 mt-0.5 border ${
                        isUnread ? 'bg-white border-amber-200 shadow-2xs' : 'bg-stone-100 border-stone-200'
                      }`}>
                        {badge.icon}
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-1 flex-wrap">
                          <span className={`text-[10px] font-black px-1.5 py-0.2 rounded border ${badge.bg}`}>
                            {badge.label}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-stone-400 font-mono">
                              {formatNotificationTime(n.createdAt)}
                            </span>
                            {isUnread && (
                              <span className={`w-2.5 h-2.5 rounded-full ${badge.dot} shrink-0 ring-2 ring-white animate-pulse`} />
                            )}
                          </div>
                        </div>

                        <p className={`text-xs ${isUnread ? 'font-black text-stone-900' : 'font-semibold text-stone-700'}`}>
                          {n.title}
                        </p>
                        
                        <p className={`text-[11px] leading-snug ${isUnread ? 'text-stone-800' : 'text-stone-500'}`}>
                          {n.message}
                        </p>

                        <div className="flex items-center justify-end pt-0.5">
                          <span className="text-[10px] font-extrabold text-stone-600 hover:text-stone-950 flex items-center gap-0.5 transition-colors">
                            <span>Ver detalle</span>
                            <ChevronRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer note */}
            {filteredNotifications.length > 0 && (
              <div className="p-2 bg-stone-50 border-t border-stone-100 text-center text-[10px] text-stone-400 font-medium shrink-0">
                Mostrando {filteredNotifications.length} de {notifications.length} eventos
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

