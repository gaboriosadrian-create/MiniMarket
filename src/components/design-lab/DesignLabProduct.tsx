import React from 'react';
import { useTheme } from '../../lib/themeContext';
import { getThemeVariant, getThemeDescriptor } from '../../lib/themeVariant';
import { ProductCardVariant, ProductItem } from '../common/ProductCardVariant';

export const DesignLabProduct: React.FC = () => {
  const { activeTheme } = useTheme();
  const variant = getThemeVariant(activeTheme?.id, activeTheme?.layoutStyle);
  const descriptor = getThemeDescriptor(variant);

  const sampleProducts: ProductItem[] = [
    {
      id: 'p1',
      name: 'Tortitas de Manteca',
      category: 'Panificados',
      price: 1500,
      stock: 24,
      minStock: 5
    },
    {
      id: 'p2',
      name: 'Medialunas de Grasa',
      category: 'Panificados',
      price: 1200,
      stock: 2,
      minStock: 5
    },
    {
      id: 'p3',
      name: 'Alfajor Triple Chocolate',
      category: 'Golosinas',
      price: 950,
      stock: 14,
      minStock: 5
    }
  ];

  return (
    <div 
      className="p-4 sm:p-6 border transition-all space-y-4"
      style={{
        backgroundColor: 'var(--dl-surface)',
        borderColor: 'var(--dl-border)',
        borderRadius: 'var(--dl-radius-lg)',
        boxShadow: 'var(--dl-shadow-sm)'
      }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b gap-2" style={{ borderColor: 'var(--dl-border-subtle)' }}>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black" style={{ color: 'var(--dl-text)' }}>
              4. Tarjeta y Ficha de Producto
            </h3>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase" style={{ backgroundColor: 'var(--dl-primary-subtle)', color: 'var(--dl-primary)' }}>
              {descriptor.name}
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--dl-text-muted)' }}>
            Estructura visual nativa del producto según la dirección activa
          </p>
        </div>
        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--dl-surface-subtle)', color: 'var(--dl-text-muted)' }}>
          {sampleProducts.length} Items
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sampleProducts.map((prod) => (
          <ProductCardVariant 
            key={prod.id} 
            product={prod} 
            onAddToCart={() => {}}
          />
        ))}
      </div>
    </div>
  );
};
