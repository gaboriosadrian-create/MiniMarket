import React from 'react';
import { 
  Store, 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Truck, 
  ClipboardList, 
  History, 
  Settings, 
  ChevronRight,
  User,
  LogOut
} from 'lucide-react';

export const DesignLabNavigation: React.FC = () => {
  const navLinks = [
    { id: 'dash', label: 'Dashboard', icon: LayoutDashboard, isActive: true },
    { id: 'ventas', label: 'Ventas / POS', icon: ShoppingCart },
    { id: 'inv', label: 'Inventario', icon: Package },
    { id: 'recep', label: 'Recepción', icon: Truck, badge: '2' },
    { id: 'solic', label: 'Solicitud', icon: ClipboardList, badge: '3' },
    { id: 'hist', label: 'Historial', icon: History },
    { id: 'conf', label: 'Configuración', icon: Settings },
  ];

  return (
    <div 
      className="p-4 sm:p-6 border transition-all"
      style={{
        backgroundColor: 'var(--dl-surface)',
        borderColor: 'var(--dl-border)',
        borderRadius: 'var(--dl-radius-lg)',
        boxShadow: 'var(--dl-shadow-sm)'
      }}
    >
      <div className="flex items-center justify-between pb-3 mb-4 border-b" style={{ borderColor: 'var(--dl-border-subtle)' }}>
        <div>
          <h3 className="text-sm font-black" style={{ color: 'var(--dl-text)' }}>
            1. Navegación Lateral (Sidebar)
          </h3>
          <p className="text-xs" style={{ color: 'var(--dl-text-muted)' }}>
            Representación de la barra de navegación lateral según el Design System
          </p>
        </div>
        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--dl-surface-subtle)', color: 'var(--dl-text-muted)' }}>
          uwi Core Nav
        </span>
      </div>

      <div className="max-w-xs mx-auto md:mx-0">
        <div 
          className="border p-3 space-y-3"
          style={{
            backgroundColor: 'var(--dl-surface)',
            borderColor: 'var(--dl-border)',
            borderRadius: 'var(--dl-radius-md)',
            boxShadow: 'var(--dl-shadow-xs)'
          }}
        >
          {/* Header Brand */}
          <div 
            className="p-3 flex items-center justify-between"
            style={{
              backgroundColor: 'var(--dl-primary-subtle)',
              borderRadius: 'var(--dl-radius-sm)'
            }}
          >
            <div className="flex items-center gap-2.5">
              <div 
                className="w-8 h-8 flex items-center justify-center font-bold"
                style={{
                  backgroundColor: 'var(--dl-primary)',
                  color: 'var(--dl-primary-text)',
                  borderRadius: 'var(--dl-radius-sm)'
                }}
              >
                <Store className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-black leading-tight lowercase" style={{ color: 'var(--dl-text)' }}>
                  uwi
                </h4>
                <p className="text-[10px] font-medium leading-tight" style={{ color: 'var(--dl-text-muted)' }}>
                  Kiosco Central
                </p>
              </div>
            </div>
            <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--dl-surface)', color: 'var(--dl-primary)' }}>
              v1.0
            </span>
          </div>

          {/* User mini badge */}
          <div 
            className="p-2 flex items-center gap-2 border"
            style={{
              backgroundColor: 'var(--dl-surface-subtle)',
              borderColor: 'var(--dl-border-subtle)',
              borderRadius: 'var(--dl-radius-sm)'
            }}
          >
            <div className="w-6 h-6 rounded-full bg-stone-300 flex items-center justify-center text-stone-700">
              <User className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold truncate leading-tight" style={{ color: 'var(--dl-text)' }}>
                Adrián Ríos
              </p>
              <p className="text-[9px] truncate leading-tight" style={{ color: 'var(--dl-text-muted)' }}>
                Admin
              </p>
            </div>
          </div>

          {/* Nav Items */}
          <div className="space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <div
                  key={link.id}
                  className="px-3 py-2 text-xs font-bold flex items-center justify-between transition-all cursor-pointer"
                  style={{
                    backgroundColor: link.isActive ? 'var(--dl-primary)' : 'transparent',
                    color: link.isActive ? 'var(--dl-primary-text)' : 'var(--dl-text)',
                    borderRadius: 'var(--dl-radius-sm)'
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4" />
                    <span>{link.label}</span>
                  </div>
                  {link.badge ? (
                    <span 
                      className="text-[10px] px-1.5 py-0.2 rounded font-black"
                      style={{
                        backgroundColor: link.isActive ? 'rgba(255,255,255,0.25)' : 'var(--dl-primary-subtle)',
                        color: link.isActive ? '#FFFFFF' : 'var(--dl-primary)'
                      }}
                    >
                      {link.badge}
                    </span>
                  ) : (
                    <ChevronRight className="w-3 h-3 opacity-60" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Action */}
          <div className="pt-2 border-t" style={{ borderColor: 'var(--dl-border-subtle)' }}>
            <div 
              className="px-3 py-2 text-xs font-bold flex items-center gap-2 cursor-pointer"
              style={{
                color: 'var(--dl-danger)',
                borderRadius: 'var(--dl-radius-sm)'
              }}
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar Sesión</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
