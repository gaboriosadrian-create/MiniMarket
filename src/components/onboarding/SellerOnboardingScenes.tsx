import React from 'react';

/**
 * Scene for Seller Step 1: Bienvenida al Equipo & Rol de Vendedor
 * Seller badge, friendly counter with business name sign and warm welcoming glow.
 */
export const SceneSellerWelcome: React.FC<{ businessName?: string; sellerName?: string }> = ({
  businessName,
  sellerName,
}) => (
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
        <ellipse cx="170" cy="90" rx="130" ry="5" fill="#000000" fillOpacity="0.06" />

        {/* Store Counter Base */}
        <rect x="75" y="44" width="190" height="44" rx="5" fill="#F8FAFC" stroke="#CBD5E1" strokeWidth="1.5" />
        <rect x="85" y="52" width="170" height="12" rx="3" fill="#E2E8F0" />

        {/* Business Badge on Counter */}
        <rect x="115" y="70" width="110" height="14" rx="3" fill="#006AFF" />
        <text
          x="170"
          y="80"
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="8"
          fontWeight="bold"
          fontFamily="system-ui, sans-serif"
        >
          {businessName ? (businessName.length > 20 ? `${businessName.slice(0, 18)}...` : businessName) : 'COMERCIO UWI'}
        </text>

        {/* Seller Avatar with Lanyard / Badge */}
        <g transform="translate(142, 6)">
          {/* Head & Face */}
          <circle cx="28" cy="20" r="15" fill="#8B5CF6" />
          <circle cx="28" cy="18" r="7" fill="#FFFFFF" />
          {/* Torso / Uniform */}
          <path d="M16 38 C16 28 22 26 28 26 C34 26 40 28 40 38 Z" fill="#6D28D9" />
          {/* ID Lanyard / Credencial */}
          <path d="M25 26 L26 34 L30 34 L31 26" stroke="#FBBF24" strokeWidth="1.5" fill="none" />
          <rect x="25" y="32" width="6" height="8" rx="1" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="0.5" />
          <rect x="26.5" y="34" width="3" height="2" fill="#006AFF" />
          {/* Friendly greeting wave */}
          <g transform="translate(42, 14)">
            <circle cx="5" cy="5" r="5" fill="#FBBF24" />
            <path d="M3 5 L5 7 L8 3" stroke="#92400E" strokeWidth="1" strokeLinecap="round" />
          </g>
        </g>

        {/* Left Decorative POS Register */}
        <g transform="translate(90, 22)">
          <rect x="0" y="8" width="28" height="18" rx="2" fill="#1E293B" />
          <polygon points="4,0 24,0 22,8 6,8" fill="#006AFF" />
          <rect x="6" y="2" width="16" height="4" rx="1" fill="#BAE6FD" />
          <circle cx="14" cy="21" r="2" fill="#10B981" />
        </g>

        {/* Right Welcome Stars & Sparkles */}
        <g transform="translate(235, 14)">
          <path d="M10 0 L12 6 L18 8 L12 10 L10 16 L8 10 L2 8 L8 6 Z" fill="#F59E0B" />
          <circle cx="2" cy="24" r="2" fill="#10B981" />
          <circle cx="18" cy="28" r="3" fill="#38BDF8" />
        </g>
      </svg>
    </div>
  </div>
);

/**
 * Scene for Seller Step 2: Punto de Venta & Cobro Rápido
 * POS screen with barcode laser, dynamic change calculation & payment channels.
 */
export const SceneSellerPOS: React.FC = () => (
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

        {/* POS Screen Console (Center) */}
        <rect x="95" y="10" width="150" height="74" rx="6" fill="#0F172A" stroke="#334155" strokeWidth="2" />
        <rect x="101" y="16" width="138" height="62" rx="4" fill="#1E293B" />

        {/* Ticket / Order lines on screen */}
        <rect x="108" y="22" width="70" height="4" rx="1" fill="#94A3B8" />
        <rect x="108" y="29" width="50" height="4" rx="1" fill="#64748B" />
        <rect x="108" y="36" width="60" height="4" rx="1" fill="#64748B" />

        {/* Total & Vuelto Box on screen */}
        <rect x="108" y="46" width="124" height="26" rx="3" fill="#0284C7" />
        <text x="114" y="56" fill="#BAE6FD" fontSize="6.5" fontWeight="bold" fontFamily="monospace">
          TOTAL: $3.500
        </text>
        <text x="114" y="66" fill="#FFFFFF" fontSize="8" fontWeight="bold" fontFamily="monospace">
          VUELTO: $1.500
        </text>

        {/* Barcode scanner gun with red laser (Left) */}
        <g transform="translate(50, 24)">
          <path d="M0 16 L16 8 L24 14 L12 28 Z" fill="#334155" stroke="#1E293B" strokeWidth="1" />
          <rect x="20" y="12" width="8" height="12" rx="2" fill="#006AFF" />
          {/* Laser beam */}
          <line x1="28" y1="18" x2="60" y2="28" stroke="#EF4444" strokeWidth="1.5" strokeDasharray="3 2" />
          <circle cx="60" cy="28" r="2" fill="#EF4444" />
        </g>

        {/* Payment Methods quick badges (Right) */}
        <g transform="translate(254, 18)">
          {/* Cash icon badge */}
          <rect x="0" y="0" width="28" height="18" rx="3" fill="#ECFDF5" stroke="#10B981" strokeWidth="1" />
          <text x="14" y="12" textAnchor="middle" fill="#047857" fontSize="8" fontWeight="bold">$</text>

          {/* QR badge */}
          <rect x="0" y="22" width="28" height="18" rx="3" fill="#EFF6FF" stroke="#006AFF" strokeWidth="1" />
          <rect x="6" y="26" width="4" height="4" fill="#006AFF" />
          <rect x="18" y="26" width="4" height="4" fill="#006AFF" />
          <rect x="12" y="32" width="4" height="4" fill="#006AFF" />

          {/* Card / MP badge */}
          <rect x="0" y="44" width="28" height="18" rx="3" fill="#F0F9FF" stroke="#0284C7" strokeWidth="1" />
          <rect x="4" y="49" width="20" height="3" fill="#0284C7" />
          <rect x="6" y="55" width="4" height="3" fill="#FBBF24" />
        </g>
      </svg>
    </div>
  </div>
);

/**
 * Scene for Seller Step 3: Turno y Control de Caja
 * Cash drawer with compartments, shift float and clean balancing.
 */
export const SceneSellerCashShift: React.FC = () => (
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
        <rect x="65" y="76" width="210" height="12" rx="3" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1.5" />

        {/* Cash Register Main Body */}
        <rect x="125" y="32" width="90" height="46" rx="4" fill="#1E293B" stroke="#0F172A" strokeWidth="1.5" />

        {/* Shift Display / Turno Abierto */}
        <polygon points="140,12 200,12 195,32 145,32" fill="#0F172A" stroke="#334155" strokeWidth="1.5" />
        <polygon points="144,15 196,15 192,29 148,29" fill="#006AFF" />
        <text
          x="170"
          y="25"
          textAnchor="middle"
          fill="#FFFFFF"
          fontSize="7.5"
          fontWeight="bold"
          fontFamily="system-ui, monospace"
        >
          TURNO ACTIVO
        </text>

        {/* Open Cash Drawer */}
        <rect x="116" y="64" width="108" height="18" rx="2" fill="#334155" stroke="#1E293B" strokeWidth="1" />
        {/* Bill slots */}
        <rect x="122" y="67" width="28" height="12" rx="1" fill="#10B981" />
        <rect x="154" y="67" width="28" height="12" rx="1" fill="#3B82F6" />
        {/* Coins */}
        <circle cx="192" cy="73" r="3.5" fill="#F59E0B" />
        <circle cx="202" cy="73" r="3.5" fill="#FBBF24" />
        <circle cx="212" cy="73" r="3.5" fill="#E2E8F0" />

        {/* Left Stack of bills (Float / Fondo inicial) */}
        <g transform="translate(75, 46)">
          <rect x="0" y="14" width="34" height="18" rx="2" fill="#059669" stroke="#047857" strokeWidth="1" />
          <rect x="2" y="8" width="34" height="18" rx="2" fill="#10B981" stroke="#059669" strokeWidth="1" />
          <rect x="4" y="2" width="34" height="18" rx="2" fill="#34D399" stroke="#10B981" strokeWidth="1" />
          <circle cx="21" cy="11" r="4" fill="#FFFFFF" fillOpacity="0.7" />
          <text x="21" y="14" textAnchor="middle" fill="#065F46" fontSize="7" fontWeight="bold">FONDO</text>
        </g>

        {/* Right Balance / Arqueo Check (Transparent closing) */}
        <g transform="translate(230, 42)">
          <rect x="0" y="0" width="38" height="32" rx="4" fill="#EFF6FF" stroke="#006AFF" strokeWidth="1.5" />
          <circle cx="19" cy="12" r="7" fill="#10B981" />
          <path d="M16 12 L18 14 L22 10" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />
          <text x="19" y="26" textAnchor="middle" fill="#0052CC" fontSize="6.5" fontWeight="bold">ARQUEO</text>
        </g>
      </svg>
    </div>
  </div>
);

/**
 * Scene for Seller Step 4: Catálogo, Stock y Operaciones
 * Product catalog lookup, stock level badges, delivery reception box.
 */
export const SceneSellerCatalog: React.FC = () => (
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

        {/* Catalog Card Display (Left-Center) */}
        <g transform="translate(70, 14)">
          <rect x="0" y="0" width="115" height="70" rx="6" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.5" />
          {/* Header search bar */}
          <rect x="8" y="8" width="99" height="12" rx="3" fill="#F1F5F9" />
          <circle cx="16" cy="14" r="3" fill="#0284C7" />
          <line x1="18" y1="16" x2="21" y2="19" stroke="#0284C7" strokeWidth="1" />
          <rect x="24" y="12" width="50" height="4" rx="1" fill="#94A3B8" />

          {/* Product row 1 */}
          <rect x="8" y="26" width="14" height="14" rx="2" fill="#E0F2FE" />
          <rect x="26" y="28" width="40" height="4" rx="1" fill="#334155" />
          <rect x="26" y="34" width="24" height="3" rx="1" fill="#94A3B8" />
          <rect x="76" y="28" width="30" height="8" rx="2" fill="#DCFCE7" />
          <text x="91" y="34.5" textAnchor="middle" fill="#15803D" fontSize="5.5" fontWeight="bold">24 u.</text>

          {/* Product row 2 */}
          <rect x="8" y="46" width="14" height="14" rx="2" fill="#FEF3C7" />
          <rect x="26" y="48" width="45" height="4" rx="1" fill="#334155" />
          <rect x="26" y="54" width="20" height="3" rx="1" fill="#94A3B8" />
          <rect x="76" y="48" width="30" height="8" rx="2" fill="#FEF08A" />
          <text x="91" y="54.5" textAnchor="middle" fill="#A16207" fontSize="5.5" fontWeight="bold">Bajo (3)</text>
        </g>

        {/* Operational Modules badges (Right) */}
        {/* Reception / Delivery Box */}
        <g transform="translate(196, 18)">
          <rect x="0" y="0" width="68" height="28" rx="4" fill="#F8FAFC" stroke="#818CF8" strokeWidth="1.5" />
          <rect x="6" y="6" width="16" height="16" rx="2" fill="#EEF2FF" stroke="#6366F1" strokeWidth="1" />
          <path d="M10 14 L14 10 L18 14" stroke="#6366F1" strokeWidth="1.5" strokeLinecap="round" />
          <text x="26" y="14" fill="#4338CA" fontSize="6.5" fontWeight="bold">RECEPCIÓN</text>
          <text x="26" y="21" fill="#64748B" fontSize="5.5">Mercadería</text>
        </g>

        {/* Replenishment Request */}
        <g transform="translate(196, 52)">
          <rect x="0" y="0" width="68" height="28" rx="4" fill="#F8FAFC" stroke="#C084FC" strokeWidth="1.5" />
          <rect x="6" y="6" width="16" height="16" rx="2" fill="#FAF5FF" stroke="#A855F7" strokeWidth="1" />
          <path d="M10 14 H18" stroke="#A855F7" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M10 11 H15" stroke="#A855F7" strokeWidth="1.5" strokeLinecap="round" />
          <text x="26" y="14" fill="#7E22CE" fontSize="6.5" fontWeight="bold">REPOSICIÓN</text>
          <text x="26" y="21" fill="#64748B" fontSize="5.5">Solicitudes</text>
        </g>
      </svg>
    </div>
  </div>
);

/**
 * Scene for Seller Step 5: ¡Listo para tu primer turno!
 * Celebration shield, glowing checkmark, stars and confident launch vibes.
 */
export const SceneSellerLaunch: React.FC = () => (
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
