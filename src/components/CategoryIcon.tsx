import React from 'react';
import {
  Package,
  CupSoda,
  Beer,
  Wine,
  Coffee,
  Milk,
  Cookie,
  Candy,
  Pizza,
  Sandwich,
  IceCream,
  Apple,
  Carrot,
  Beef,
  Fish,
  Egg,
  Utensils,
  Sparkles,
  SprayCan,
  Shirt,
  Flame,
  Tag,
  Boxes,
  ShoppingBag,
  LucideProps
} from 'lucide-react';
import { getDefaultIconForCategoryOrProduct } from '../lib/categoryUtils';

const ICON_MAP: Record<string, React.FC<LucideProps>> = {
  Package,
  CupSoda,
  Beer,
  Wine,
  Coffee,
  Milk,
  Cookie,
  Candy,
  Pizza,
  Sandwich,
  IceCream,
  Apple,
  Carrot,
  Beef,
  Fish,
  Egg,
  Utensils,
  Sparkles,
  SprayCan,
  Shirt,
  Flame,
  Tag,
  Boxes,
  ShoppingBag
};

interface CategoryIconProps extends LucideProps {
  iconName?: string | null;
  category?: string | null;
  productName?: string | null;
  fallbackIcon?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  iconName,
  category,
  productName,
  fallbackIcon = 'Package',
  className = 'w-4 h-4',
  ...props
}) => {
  let resolvedName = iconName;

  if (!resolvedName && (category || productName)) {
    resolvedName = getDefaultIconForCategoryOrProduct(productName || category || '');
  }

  if (!resolvedName || !ICON_MAP[resolvedName]) {
    resolvedName = fallbackIcon;
  }

  const IconComponent = ICON_MAP[resolvedName] || Package;

  return <IconComponent className={className} {...props} />;
};
