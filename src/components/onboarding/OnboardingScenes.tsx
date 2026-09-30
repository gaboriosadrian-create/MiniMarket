import React from 'react';

/**
 * Scene for Step 1: Identidad del Negocio
 * Storefront with awning, sign board and welcoming glow.
 */
export const SceneIdentity: React.FC<{ businessName?: string }> = ({ businessName }) => (
  <div className="w-full flex items-center justify-center py-2 select-none" aria-hidden="true">
    <div className="relative w-full max-w-[280px] sm:max-w-[340px] h-20 sm:h-24 flex items-center justify-center">
      {/* Background Soft Glow */}
      <div className="absolute inset-0 bg-blue-500/10 rounded-2xl filter blur-xl pointer-events-none" />
      
      <svg
        viewBox="0 0 340 100"
        className="w-full h-full text-blue-600 drop-shadow-xs"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Ground shadow */}
        <ellipse cx="170" cy="90" rx="140" ry="6" fill="currentColor" fillOpacity="0.08" />

        {/* Store base structure */}
        <rect x="95" y="32" width="150" height="56" rx="6" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="2" />

        {/* Door & Entrance */}
        <rect x="148" y="46" width="44" height="42" rx="3" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1.5" />
        <rect x="154" y="52" width="14" height="30" rx="1.5" fill="#FFFFFF" fillOpacity="0.8" />
        <rect x="172" y="52" width="14" height="30" rx="1.5" fill="#FFFFFF" fillOpacity="0.8" />
        <circle cx="166" cy="68" r="1.5" fill="#64748B" />

        {/* Left Window */}
        <rect x="105" y="48" width="34" height="32" rx="3" fill="#E0F2FE" stroke="#38BDF8" strokeWidth="1.5" />
        <line x1="122" y1="48" x2="122" y2="80" stroke="#BAE6FD" strokeWidth="1.5" />
        <line x1="105" y1="64" x2="139" y2="64" stroke="#BAE6FD" strokeWidth="1.5" />

        {/* Right Window */}
        <rect x="201" y="48" width="34" height="32" rx="3" fill="#E0F2FE" stroke="#38BDF8" strokeWidth="1.5" />
        <line x1="218" y1="48" x2="218" y2="80" stroke="#BAE6FD" strokeWidth="1.5" />
        <line x1="201" y1="64" x2="235" y2="64" stroke="#BAE6FD" strokeWidth="1.5" />

        {/* Awning (Toldo) */}
        <path d="M85 34 L255 34 L248 18 L92 18 Z" fill="#006AFF" />
        {/* Striped canopy segments */}
        <path d="M102 18 L96 34 L114 34 L118 18 Z" fill="#FFFFFF" fillOpacity="0.3" />
        <path d="M136 18 L134 34 L152 34 L154 18 Z" fill="#FFFFFF" fillOpacity="0.3" />
        <path d="M172 18 L172 34 L190 34 L188 18 Z" fill="#FFFFFF" fillOpacity="0.3" />
        <path d="M208 18 L210 34 L228 34 L224 18 Z" fill="#FFFFFF" fillOpacity="0.3" />
        {/* Awning scalloped edge */}
        <path
          d="M85 34 Q90 38 95 34 Q100 38 105 34 Q110 38 115 34 Q120 38 125 34 Q130 38 135 34 Q140 38 145 34 Q150 38 155 34 Q160 38 165 34 Q170 38 175 34 Q180 38 185 34 Q190 38 195 34 Q200 38 205 34 Q210 38 215 34 Q220 38 225 34 Q230 38 235 34 Q240 38 245 34 Q250 38 255 34"
          stroke="#0052CC"
          strokeWidth="2"
          fill="#006AFF"
        />

        {/* Store Signboard / Cartel */}
        <rect x="120" y="4" width="100" height="18" rx="4" fill="#0F172A" stroke="#334155" strokeWidth="1.5" />
        <circle cx="126" cy="13" r="2" fill="#38BDF8" />
        <text
          x="170"
          y="16"
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="9"
          fontWeight="bold"
          fontFamily="system-ui, sans-serif"
        >
          {businessName ? (businessName.length > 18 ? `${businessName.slice(0, 16)}...` : businessName) : 'TU COMERCIO'}
        </text>

        {/* Location Pin Pinpoint */}
        <g transform="translate(60, 24)">
          <path d="M10 0 C4.5 0 0 4.5 0 10 C0 17.5 10 26 10 26 C10 26 20 17.5 20 10 C20 4.5 15.5 0 10 0 Z" fill="#EF4444" />
          <circle cx="10" cy="10" r="4" fill="#FFFFFF" />
        </g>

        {/* Friendly Plant / Decor */}
        <rect x="256" y="66" width="12" height="16" rx="2" fill="#D97706" />
        <ellipse cx="262" cy="62" rx="10" ry="12" fill="#10B981" />
        <ellipse cx="260" cy="58" rx="6" ry="8" fill="#34D399" />
      </svg>
    </div>
  </div>
);

/**
 * Scene for Step 2: Catálogo y Primeros Productos
 * Shelves with products, barcode scanner and sample stock boxes.
 */
export const SceneProducts: React.FC = () => (
  <div className="w-full flex items-center justify-center py-2 select-none" aria-hidden="true">
    <div className="relative w-full max-w-[280px] sm:max-w-[340px] h-20 sm:h-24 flex items-center justify-center">
      <div className="absolute inset-0 bg-blue-500/10 rounded-2xl filter blur-xl pointer-events-none" />
      
      <svg
        viewBox="0 0 340 100"
        className="w-full h-full text-blue-600 drop-shadow-xs"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Base shadow */}
        <ellipse cx="170" cy="92" rx="140" ry="5" fill="#000000" fillOpacity="0.06" />

        {/* Shelving unit */}
        <rect x="70" y="16" width="200" height="72" rx="4" fill="#F1F5F9" stroke="#CBD5E1" strokeWidth="1.5" />
        <line x1="70" y1="48" x2="270" y2="48" stroke="#94A3B8" strokeWidth="2.5" />
        <line x1="70" y1="84" x2="270" y2="84" stroke="#94A3B8" strokeWidth="3" />

        {/* Shelf 1 Items (Bottles & Cans) */}
        {/* Drink bottle */}
        <rect x="85" y="24" width="10" height="24" rx="2" fill="#0284C7" />
        <rect x="88" y="20" width="4" height="4" rx="1" fill="#0369A1" />
        <rect x="100" y="22" width="12" height="26" rx="2" fill="#DC2626" />
        <rect x="103" y="18" width="6" height="4" rx="1" fill="#B91C1C" />
        
        {/* Snack box */}
        <rect x="120" y="26" width="18" height="22" rx="2" fill="#F59E0B" stroke="#D97706" strokeWidth="1" />
        <line x1="124" y1="32" x2="134" y2="32" stroke="#FFFFFF" strokeWidth="1.5" />
        
        {/* Dairy / Box */}
        <rect x="145" y="22" width="16" height="26" rx="2" fill="#10B981" />
        <path d="M145 28 L161 34 L161 48 L145 48 Z" fill="#059669" fillOpacity="0.4" />

        {/* Cleaning bottle */}
        <rect x="170" y="22" width="14" height="26" rx="3" fill="#8B5CF6" />
        <rect x="174" y="17" width="6" height="5" rx="1" fill="#7C3AED" />

        {/* Box package */}
        <rect x="194" y="24" width="22" height="24" rx="2" fill="#E2E8F0" stroke="#64748B" strokeWidth="1.5" />
        <line x1="198" y1="32" x2="212" y2="32" stroke="#3B82F6" strokeWidth="2" />
        <line x1="198" y1="38" x2="208" y2="38" stroke="#94A3B8" strokeWidth="1.5" />

        {/* Shelf 2 Items (Storage & Stock packs) */}
        <rect x="85" y="54" width="28" height="28" rx="3" fill="#FED7AA" stroke="#F97316" strokeWidth="1.5" />
        <line x1="85" y1="64" x2="113" y2="64" stroke="#EA580C" strokeWidth="1" strokeDasharray="2 2" />

        <rect x="120" y="58" width="34" height="24" rx="3" fill="#BAE6FD" stroke="#0284C7" strokeWidth="1.5" />
        {/* Barcode icon on package */}
        <g transform="translate(126, 66)">
          <line x1="0" y1="0" x2="0" y2="10" stroke="#0F172A" strokeWidth="1.5" />
          <line x1="3" y1="0" x2="3" y2="10" stroke="#0F172A" strokeWidth="1" />
          <line x1="6" y1="0" x2="6" y2="10" stroke="#0F172A" strokeWidth="2" />
          <line x1="10" y1="0" x2="10" y2="10" stroke="#0F172A" strokeWidth="1" />
          <line x1="13" y1="0" x2="13" y2="10" stroke="#0F172A" strokeWidth="1.5" />
          <line x1="17" y1="0" x2="17" y2="10" stroke="#0F172A" strokeWidth="2" />
          <line x1="20" y1="0" x2="20" y2="10" stroke="#0F172A" strokeWidth="1" />
        </g>

        <rect x="162" y="56" width="30" height="26" rx="3" fill="#BBF7D0" stroke="#16A34A" strokeWidth="1.5" />
        <circle cx="177" cy="69" r="6" fill="#16A34A" />
        <path d="M174 69 L176 71 L180 67" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />

        {/* Sparkle badge floating */}
        <g transform="translate(236, 12)">
          <circle cx="16" cy="16" r="14" fill="#006AFF" />
          <path d="M16 8 L18 13 L23 16 L18 19 L16 24 L14 19 L9 16 L14 13 Z" fill="#FFFFFF" />
        </g>
      </svg>
    </div>
  </div>
);

/**
 * Scene for Step 3: Caja y Fondo Inicial
 * Cash register, coin stack and float fund bills.
 */
export const SceneCash: React.FC<{ floatAmount?: number }> = ({ floatAmount = 10000 }) => (
  <div className="w-full flex items-center justify-center py-2 select-none" aria-hidden="true">
    <div className="relative w-full max-w-[280px] sm:max-w-[340px] h-20 sm:h-24 flex items-center justify-center">
      <div className="absolute inset-0 bg-blue-500/10 rounded-2xl filter blur-xl pointer-events-none" />
      
      <svg
        viewBox="0 0 340 100"
        className="w-full h-full text-blue-600 drop-shadow-xs"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Base shadow */}
        <ellipse cx="170" cy="90" rx="130" ry="5" fill="#000000" fillOpacity="0.06" />

        {/* Counter surface */}
        <rect x="60" y="78" width="220" height="12" rx="3" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1.5" />

        {/* POS Cash Register body */}
        <rect x="130" y="38" width="80" height="42" rx="4" fill="#1E293B" stroke="#0F172A" strokeWidth="1.5" />

        {/* Register Screen */}
        <polygon points="142,16 198,16 194,38 146,38" fill="#0F172A" stroke="#334155" strokeWidth="1.5" />
        <polygon points="146,20 194,20 191,35 149,35" fill="#006AFF" />
        <text
          x="170"
          y="30"
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="9"
          fontWeight="bold"
          fontFamily="system-ui, monospace"
        >
          {`$${floatAmount.toLocaleString('es-AR')}`}
        </text>

        {/* Open Cash Drawer */}
        <rect x="122" y="68" width="96" height="16" rx="2" fill="#334155" stroke="#1E293B" strokeWidth="1" />
        {/* Drawer compartments with bills */}
        <rect x="126" y="71" width="26" height="10" rx="1" fill="#10B981" />
        <rect x="156" y="71" width="26" height="10" rx="1" fill="#3B82F6" />
        <circle cx="192" cy="76" r="3" fill="#F59E0B" />
        <circle cx="200" cy="76" r="3" fill="#F59E0B" />
        <circle cx="208" cy="76" r="3" fill="#E2E8F0" />

        {/* Banknote Stack (Left) */}
        <g transform="translate(82, 52)">
          <rect x="0" y="16" width="36" height="20" rx="2" fill="#059669" stroke="#047857" strokeWidth="1" />
          <rect x="2" y="10" width="36" height="20" rx="2" fill="#10B981" stroke="#059669" strokeWidth="1" />
          <rect x="4" y="4" width="36" height="20" rx="2" fill="#34D399" stroke="#10B981" strokeWidth="1" />
          <circle cx="22" cy="14" r="4" fill="#FFFFFF" fillOpacity="0.6" />
          <text x="22" y="17" textAnchor="middle" fill="#065F46" fontSize="8" fontWeight="bold">$</text>
        </g>

        {/* Golden Coin Stack (Right) */}
        <g transform="translate(230, 48)">
          <ellipse cx="14" cy="32" rx="12" ry="4" fill="#D97706" />
          <rect x="2" y="26" width="24" height="6" fill="#F59E0B" />
          <ellipse cx="14" cy="26" rx="12" ry="4" fill="#FBBF24" stroke="#D97706" strokeWidth="0.5" />

          <rect x="2" y="18" width="24" height="6" fill="#F59E0B" />
          <ellipse cx="14" cy="18" rx="12" ry="4" fill="#FBBF24" stroke="#D97706" strokeWidth="0.5" />

          <rect x="2" y="10" width="24" height="6" fill="#F59E0B" />
          <ellipse cx="14" cy="10" rx="12" ry="4" fill="#FDE68A" stroke="#D97706" strokeWidth="0.5" />
          <text x="14" y="13" textAnchor="middle" fill="#92400E" fontSize="7" fontWeight="black">★</text>
        </g>
      </svg>
    </div>
  </div>
);

/**
 * Scene for Step 4: Medios de Cobro
 * Payment methods: Cash, Bank Transfer, QR & Point.
 */
export const ScenePayments: React.FC = () => (
  <div className="w-full flex items-center justify-center py-2 select-none" aria-hidden="true">
    <div className="relative w-full max-w-[280px] sm:max-w-[340px] h-20 sm:h-24 flex items-center justify-center">
      <div className="absolute inset-0 bg-blue-500/10 rounded-2xl filter blur-xl pointer-events-none" />
      
      <svg
        viewBox="0 0 340 100"
        className="w-full h-full text-blue-600 drop-shadow-xs"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Base shadow */}
        <ellipse cx="170" cy="90" rx="130" ry="5" fill="#000000" fillOpacity="0.06" />

        {/* 1. Cash Card (Left) */}
        <g transform="translate(60, 24)">
          <rect x="0" y="0" width="56" height="56" rx="8" fill="#ECFDF5" stroke="#10B981" strokeWidth="1.5" />
          <rect x="8" y="14" width="40" height="24" rx="3" fill="#10B981" />
          <circle cx="28" cy="26" r="6" fill="#FFFFFF" fillOpacity="0.8" />
          <text x="28" y="29" textAnchor="middle" fill="#047857" fontSize="10" fontWeight="bold">$</text>
          <text x="28" y="48" textAnchor="middle" fill="#065F46" fontSize="7" fontWeight="bold">EFECTIVO</text>
        </g>

        {/* 2. Bank Transfer / QR (Center) */}
        <g transform="translate(142, 14)">
          <rect x="0" y="0" width="56" height="66" rx="8" fill="#EFF6FF" stroke="#006AFF" strokeWidth="1.5" />
          {/* QR code pattern */}
          <rect x="12" y="8" width="32" height="32" rx="3" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" />
          <rect x="15" y="11" width="10" height="10" fill="#006AFF" />
          <rect x="17" y="13" width="6" height="6" fill="#FFFFFF" />
          <rect x="19" y="15" width="2" height="2" fill="#006AFF" />
          
          <rect x="31" y="11" width="10" height="10" fill="#006AFF" />
          <rect x="33" y="13" width="6" height="6" fill="#FFFFFF" />
          <rect x="35" y="15" width="2" height="2" fill="#006AFF" />

          <rect x="15" y="27" width="10" height="10" fill="#006AFF" />
          <rect x="17" y="29" width="6" height="6" fill="#FFFFFF" />
          <rect x="19" y="31" width="2" height="2" fill="#006AFF" />

          <rect x="29" y="27" width="4" height="4" fill="#006AFF" />
          <rect x="37" y="27" width="4" height="4" fill="#006AFF" />
          <rect x="33" y="33" width="8" height="4" fill="#006AFF" />

          <text x="28" y="54" textAnchor="middle" fill="#0052CC" fontSize="7" fontWeight="bold">TRANSFERENCIA</text>
          <text x="28" y="61" textAnchor="middle" fill="#64748B" fontSize="6">ALIAS / CBU</text>
        </g>

        {/* 3. Mercado Pago / Card Terminal (Right) */}
        <g transform="translate(224, 24)">
          <rect x="0" y="0" width="56" height="56" rx="8" fill="#F0F9FF" stroke="#0284C7" strokeWidth="1.5" />
          {/* Card shape */}
          <rect x="10" y="12" width="36" height="24" rx="3" fill="#0284C7" />
          <line x1="10" y1="18" x2="46" y2="18" stroke="#0369A1" strokeWidth="3" />
          <rect x="14" y="26" width="6" height="4" rx="1" fill="#FDE047" />
          <circle cx="36" cy="28" r="3" fill="#FFFFFF" fillOpacity="0.6" />
          <text x="28" y="48" textAnchor="middle" fill="#0369A1" fontSize="7" fontWeight="bold">MERCADO PAGO</text>
        </g>
      </svg>
    </div>
  </div>
);

/**
 * Scene for Step 5: Equipo y Vendedores
 * Admin badge and cashier / seller collaboration.
 */
export const SceneTeam: React.FC<{ teamMode?: 'solo' | 'seller' }> = ({ teamMode = 'solo' }) => (
  <div className="w-full flex items-center justify-center py-2 select-none" aria-hidden="true">
    <div className="relative w-full max-w-[280px] sm:max-w-[340px] h-20 sm:h-24 flex items-center justify-center">
      <div className="absolute inset-0 bg-blue-500/10 rounded-2xl filter blur-xl pointer-events-none" />
      
      <svg
        viewBox="0 0 340 100"
        className="w-full h-full text-blue-600 drop-shadow-xs"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Base shadow */}
        <ellipse cx="170" cy="90" rx="120" ry="5" fill="#000000" fillOpacity="0.06" />

        {/* Admin Avatar (Center-Left) */}
        <g transform="translate(110, 16)">
          <circle cx="28" cy="20" r="16" fill="#006AFF" />
          <circle cx="28" cy="16" r="7" fill="#FFFFFF" />
          <path d="M16 32 C16 26 21 24 28 24 C35 24 40 26 40 32 Z" fill="#FFFFFF" />
          {/* Crown / Admin badge */}
          <path d="M22 6 L25 9 L28 4 L31 9 L34 6 L33 11 L23 11 Z" fill="#FBBF24" />
          <text x="28" y="52" textAnchor="middle" fill="#0052CC" fontSize="8" fontWeight="bold">ADMINISTRADOR</text>
        </g>

        {/* Link / Partnership Line */}
        {teamMode === 'seller' ? (
          <g>
            <line x1="166" y1="36" x2="194" y2="36" stroke="#006AFF" strokeWidth="2" strokeDasharray="3 3" />
            <circle cx="180" cy="36" r="3" fill="#10B981" />
          </g>
        ) : (
          <g transform="translate(180, 26)">
            <rect x="0" y="0" width="46" height="24" rx="4" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1" />
            <text x="23" y="15" textAnchor="middle" fill="#64748B" fontSize="7" fontWeight="semibold">MODO SIMPLE</text>
          </g>
        )}

        {/* Seller Avatar (Center-Right) */}
        {teamMode === 'seller' && (
          <g transform="translate(196, 16)">
            <circle cx="28" cy="20" r="16" fill="#8B5CF6" />
            <circle cx="28" cy="16" r="7" fill="#FFFFFF" />
            <path d="M16 32 C16 26 21 24 28 24 C35 24 40 26 40 32 Z" fill="#FFFFFF" />
            {/* Tag icon */}
            <circle cx="38" cy="10" r="5" fill="#10B981" />
            <path d="M36 10 L37.5 11.5 L40.5 8.5" stroke="#FFFFFF" strokeWidth="1" strokeLinecap="round" />
            <text x="28" y="52" textAnchor="middle" fill="#6D28D9" fontSize="8" fontWeight="bold">VENDEDOR / CAJA</text>
          </g>
        )}
      </svg>
    </div>
  </div>
);

/**
 * Scene for Step 6: ¡Listo para Vender!
 * Launch celebration, checklist trophy and shining checkmark.
 */
export const SceneLaunch: React.FC = () => (
  <div className="w-full flex items-center justify-center py-2 select-none" aria-hidden="true">
    <div className="relative w-full max-w-[280px] sm:max-w-[340px] h-20 sm:h-24 flex items-center justify-center">
      <div className="absolute inset-0 bg-emerald-500/10 rounded-2xl filter blur-xl pointer-events-none" />
      
      <svg
        viewBox="0 0 340 100"
        className="w-full h-full text-emerald-600 drop-shadow-xs"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Base shadow */}
        <ellipse cx="170" cy="90" rx="120" ry="5" fill="#000000" fillOpacity="0.06" />

        {/* Center Big Success Shield Badge */}
        <g transform="translate(142, 10)">
          <circle cx="28" cy="34" r="32" fill="#ECFDF5" stroke="#10B981" strokeWidth="2" />
          <circle cx="28" cy="34" r="24" fill="#10B981" />
          <path d="M20 34 L25 39 L36 28" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>

        {/* Left Floating Star & Celebration */}
        <g transform="translate(80, 20)">
          <path d="M12 0 L15 8 L24 12 L15 16 L12 24 L9 16 L0 12 L9 8 Z" fill="#FBBF24" />
          <circle cx="28" cy="32" r="3" fill="#38BDF8" />
          <circle cx="8" cy="40" r="2" fill="#34D399" />
        </g>

        {/* Right Floating Star & Celebration */}
        <g transform="translate(236, 18)">
          <path d="M14 0 L17 9 L28 14 L17 19 L14 28 L11 19 L0 14 L11 9 Z" fill="#F59E0B" />
          <circle cx="-10" cy="32" r="3" fill="#818CF8" />
          <circle cx="20" cy="44" r="2.5" fill="#F43F5E" />
        </g>

        {/* Rocket / Launch Trail Accent */}
        <path d="M100 70 Q130 55 146 50" stroke="#10B981" strokeWidth="2" strokeDasharray="2 4" strokeLinecap="round" />
        <path d="M240 70 Q210 55 194 50" stroke="#10B981" strokeWidth="2" strokeDasharray="2 4" strokeLinecap="round" />
      </svg>
    </div>
  </div>
);
