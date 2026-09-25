import React from 'react';
import { Package, Plus, Check, ShoppingCart, ArrowRight } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { getThemeVariant, ThemeVariantType } from '../../lib/themeVariant';

export interface ProductItem {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  minStock?: number;
  image?: string;
  barcode?: string;
}

interface Props {
  product: ProductItem;
  onAddToCart?: (product: ProductItem) => void;
  variantOverride?: ThemeVariantType;
  className?: string;
}

export const ProductCardVariant: React.FC<Props> = ({
  product,
  onAddToCart,
  variantOverride,
  className = ''
}) => {
  const { activeTheme } = useTheme();
  const variant = variantOverride || getThemeVariant(activeTheme?.id, activeTheme?.layoutStyle);

  const formatPrice = (val: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(val);
  };

  const isLowStock = product.stock <= (product.minStock || 5);

  // 1. EDITORIAL VARIANT: Magazine product catalog item with serif header and minimalist line
  if (variant === 'editorial') {
    return (
      <div className={`p-4 font-serif border-b border-stone-300 hover:bg-stone-50 transition-colors flex flex-col justify-between ${className}`}>
        <div>
          <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-stone-500 block">
            {product.category}
          </span>
          <h4 className="text-lg font-serif font-black text-stone-900 mt-1 leading-tight">
            {product.name}
          </h4>
          <p className="text-xs font-sans text-stone-500 mt-1">
            Disponible: <strong className="text-stone-900">{product.stock} un.</strong>
          </p>
        </div>
        <div className="mt-4 pt-2 border-t border-stone-200 flex items-center justify-between">
          <span className="text-xl font-serif font-black text-stone-900">
            {formatPrice(product.price)}
          </span>
          {onAddToCart && (
            <button
              onClick={() => onAddToCart(product)}
              className="text-xs font-sans font-black uppercase tracking-wider text-black hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>Agregar</span> →
            </button>
          )}
        </div>
      </div>
    );
  }

  // 2. SWISS VARIANT: Pure 0px radius, stark 2px black border, grotesque typography
  if (variant === 'swiss') {
    return (
      <div className={`p-3.5 bg-white border-2 border-black rounded-none flex flex-col justify-between ${className}`}>
        <div>
          <div className="flex items-center justify-between border-b border-black pb-1.5 mb-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-black">
              {product.category}
            </span>
            <span className={`text-[9px] font-black uppercase px-1 ${isLowStock ? 'bg-black text-white' : 'text-black'}`}>
              STOCK: {product.stock}
            </span>
          </div>
          <h4 className="text-sm font-black uppercase tracking-tight text-black line-clamp-2">
            {product.name}
          </h4>
        </div>
        <div className="mt-3 pt-2 border-t border-black flex items-center justify-between">
          <span className="text-base font-black font-sans text-black">
            {formatPrice(product.price)}
          </span>
          {onAddToCart && (
            <button
              onClick={() => onAddToCart(product)}
              className="bg-black text-white hover:bg-stone-800 text-[10px] font-black uppercase px-2.5 py-1 transition-colors cursor-pointer"
            >
              + ADD
            </button>
          )}
        </div>
      </div>
    );
  }

  // 3. TERMINAL VARIANT: Monospace inventory register card
  if (variant === 'terminal') {
    return (
      <div className={`p-3 bg-[#0B0F19] border border-[#1F2937] text-stone-200 font-mono text-xs rounded-none flex flex-col justify-between ${className}`}>
        <div>
          <div className="text-[10px] text-sky-400 flex items-center justify-between border-b border-[#1F2937] pb-1 mb-1.5">
            <span>[SKU_{product.id.slice(0, 4).toUpperCase()}]</span>
            <span className={isLowStock ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
              [QTY: {product.stock}]
            </span>
          </div>
          <div className="text-xs font-bold text-stone-100 truncate">{product.name}</div>
          <div className="text-[10px] text-stone-500">{product.category}</div>
        </div>
        <div className="mt-2.5 pt-1.5 border-t border-[#1F2937] flex items-center justify-between">
          <span className="text-sky-400 font-bold">{formatPrice(product.price)}</span>
          {onAddToCart && (
            <button
              onClick={() => onAddToCart(product)}
              className="px-2 py-0.5 bg-[#1F2937] hover:bg-sky-900/40 text-sky-300 text-[10px] border border-sky-500/30 cursor-pointer"
            >
              +SEL
            </button>
          )}
        </div>
      </div>
    );
  }

  // 4. BENTO VARIANT: Modular tile with smooth 24px radius and prominent image/badge
  if (variant === 'bento') {
    return (
      <div className={`p-4 bg-white rounded-3xl border border-stone-200 shadow-xs hover:border-sky-300 hover:shadow-md transition-all flex flex-col justify-between ${className}`}>
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 bg-stone-100 px-2.5 py-1 rounded-full">
              {product.category}
            </span>
            <span className={`text-[11px] font-bold ${isLowStock ? 'text-amber-600' : 'text-stone-500'}`}>
              {product.stock} un.
            </span>
          </div>
          <h4 className="text-sm font-bold text-stone-800 line-clamp-2 mt-1">
            {product.name}
          </h4>
        </div>
        <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
          <span className="text-base font-black text-[#0284C7]">
            {formatPrice(product.price)}
          </span>
          {onAddToCart && (
            <button
              onClick={() => onAddToCart(product)}
              className="w-8 h-8 rounded-xl bg-[#0284C7] hover:bg-[#0369A1] text-white flex items-center justify-center shadow-xs transition-transform active:scale-95 cursor-pointer"
              title="Agregar al carrito"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // 5. AURORA VARIANT: Atmospheric glassmorphism product card with ambient border glow
  if (variant === 'aurora') {
    return (
      <div className={`p-4 rounded-2xl bg-[#161B22]/90 backdrop-blur-md border border-[#30363D] hover:border-violet-500/50 shadow-md text-white transition-all flex flex-col justify-between ${className}`}>
        <div>
          <div className="flex items-center justify-between text-xs text-stone-400 mb-1.5">
            <span className="text-[10px] text-violet-300 uppercase font-bold tracking-wider">{product.category}</span>
            <span className="text-[11px] text-stone-400">Stock: {product.stock}</span>
          </div>
          <h4 className="text-sm font-bold text-stone-100 line-clamp-2">{product.name}</h4>
        </div>
        <div className="mt-3.5 pt-2.5 border-t border-[#30363D] flex items-center justify-between">
          <span className="text-base font-black bg-gradient-to-r from-emerald-400 to-violet-300 bg-clip-text text-transparent">
            {formatPrice(product.price)}
          </span>
          {onAddToCart && (
            <button
              onClick={() => onAddToCart(product)}
              className="px-2.5 py-1 rounded-xl bg-violet-600/30 hover:bg-violet-600/50 text-violet-200 border border-violet-500/40 text-xs font-bold transition-all cursor-pointer"
            >
              + Cobrar
            </button>
          )}
        </div>
      </div>
    );
  }

  // 6. NEO VARIANT: Cyber platform product tile with neon micro-glow
  if (variant === 'neo') {
    return (
      <div className={`p-3.5 rounded-xl bg-[#12151C] border border-[#1F2737] hover:border-[#00F59B]/60 text-stone-200 font-mono text-xs shadow-md transition-all flex flex-col justify-between ${className}`}>
        <div>
          <div className="text-[9px] text-[#00F59B] uppercase tracking-wider flex justify-between border-b border-[#1F2737] pb-1 mb-1.5">
            <span>[ {product.category} ]</span>
            <span>QTY: {product.stock}</span>
          </div>
          <h4 className="text-xs font-bold text-white line-clamp-2">{product.name}</h4>
        </div>
        <div className="mt-3 pt-2 border-t border-[#1F2937] flex items-center justify-between">
          <span className="text-sm font-black text-[#00F59B] drop-shadow-[0_0_6px_rgba(0,245,155,0.2)]">
            {formatPrice(product.price)}
          </span>
          {onAddToCart && (
            <button
              onClick={() => onAddToCart(product)}
              className="px-2 py-1 rounded bg-[#181D27] hover:bg-[#222A3A] text-[#00F59B] border border-[#00F59B]/40 text-[10px] font-bold cursor-pointer"
            >
              + ADD
            </button>
          )}
        </div>
      </div>
    );
  }

  // 7. EMERALD VARIANT: Retail commercial card with stock focus
  if (variant === 'emerald') {
    return (
      <div className={`p-4 bg-white rounded-2xl border border-[#D9E3DF] hover:border-[#008060] shadow-xs transition-all flex flex-col justify-between ${className}`}>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#008060] bg-[#E6F4EE] px-2 py-0.5 rounded-md">
              {product.category}
            </span>
            <span className={`text-[11px] font-bold ${isLowStock ? 'text-amber-600' : 'text-stone-500'}`}>
              Stock: {product.stock}
            </span>
          </div>
          <h4 className="text-sm font-extrabold text-stone-900 line-clamp-2 mt-1">
            {product.name}
          </h4>
        </div>
        <div className="mt-3.5 pt-2.5 border-t border-stone-100 flex items-center justify-between">
          <span className="text-base font-black text-[#008060]">
            {formatPrice(product.price)}
          </span>
          {onAddToCart && (
            <button
              onClick={() => onAddToCart(product)}
              className="px-3 py-1.5 rounded-xl bg-[#008060] hover:bg-[#006E52] text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              + Vender
            </button>
          )}
        </div>
      </div>
    );
  }

  // 8. SOFT VARIANT: Rounded friendly card
  if (variant === 'soft') {
    return (
      <div className={`p-4 bg-white rounded-3xl border border-stone-200/90 shadow-xs hover:shadow-sm transition-all flex flex-col justify-between ${className}`}>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-stone-500">{product.category}</span>
            <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">{product.stock} disp.</span>
          </div>
          <h4 className="text-sm font-bold text-stone-800 line-clamp-2">{product.name}</h4>
        </div>
        <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between">
          <span className="text-base font-black text-stone-900">{formatPrice(product.price)}</span>
          {onAddToCart && (
            <button
              onClick={() => onAddToCart(product)}
              className="px-3.5 py-1.5 rounded-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs cursor-pointer"
            >
              Agregar
            </button>
          )}
        </div>
      </div>
    );
  }

  // 9. STANDARD CLEAN VARIANT (Default)
  return (
    <div className={`p-4 bg-white rounded-xl border border-stone-200 shadow-2xs hover:border-stone-300 transition-all flex flex-col justify-between ${className}`}>
      <div>
        <div className="flex items-center justify-between mb-1.5 text-xs text-stone-500">
          <span className="uppercase text-[10px] font-bold tracking-wider">{product.category}</span>
          <span>Stock: {product.stock}</span>
        </div>
        <h4 className="text-sm font-bold text-stone-900 line-clamp-2">{product.name}</h4>
      </div>
      <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between">
        <span className="text-base font-black text-stone-900">{formatPrice(product.price)}</span>
        {onAddToCart && (
          <button
            onClick={() => onAddToCart(product)}
            className="px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            + Agregar
          </button>
        )}
      </div>
    </div>
  );
};
