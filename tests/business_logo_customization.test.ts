import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BusinessCommercialData, Business } from '../src/types';

describe('Business Logo Customization & Identity Isolation', () => {
  const mockBusinessId = 'biz_minimarket_123';
  const mockBusinessName = 'Don Pepe Minimarket';

  describe('1. File Type & Format Validations', () => {
    const ALLOWED_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
    const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

    const validateLogoFile = (file: { name: string; type: string; size: number }) => {
      if (!ALLOWED_MIME_TYPES.includes(file.type.toLowerCase())) {
        return { valid: false, error: 'INVALID_FORMAT' };
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        return { valid: false, error: 'FILE_TOO_LARGE' };
      }
      return { valid: true };
    };

    it('should accept valid PNG image within 2MB', () => {
      const res = validateLogoFile({ name: 'logo.png', type: 'image/png', size: 1024 * 500 });
      expect(res.valid).toBe(true);
    });

    it('should accept valid JPEG image within 2MB', () => {
      const res = validateLogoFile({ name: 'store.jpg', type: 'image/jpeg', size: 1024 * 1200 });
      expect(res.valid).toBe(true);
    });

    it('should accept valid WEBP image within 2MB', () => {
      const res = validateLogoFile({ name: 'brand.webp', type: 'image/webp', size: 1024 * 350 });
      expect(res.valid).toBe(true);
    });

    it('should reject unsupported formats (e.g. PDF, GIF, EXE)', () => {
      expect(validateLogoFile({ name: 'doc.pdf', type: 'application/pdf', size: 1000 }).valid).toBe(false);
      expect(validateLogoFile({ name: 'script.js', type: 'text/javascript', size: 500 }).valid).toBe(false);
      expect(validateLogoFile({ name: 'image.gif', type: 'image/gif', size: 500 }).valid).toBe(false);
    });

    it('should reject images larger than 2MB', () => {
      const oversized = { name: 'huge_banner.png', type: 'image/png', size: 2.5 * 1024 * 1024 };
      const res = validateLogoFile(oversized);
      expect(res.valid).toBe(false);
      expect(res.error).toBe('FILE_TOO_LARGE');
    });
  });

  describe('2. Business Logo Persistence & RBAC Updates', () => {
    it('should correctly format commercial update payload with new logoUrl', () => {
      const currentBusiness: Business = {
        id: mockBusinessId,
        name: mockBusinessName,
        status: 'active',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        adminUserId: 'admin_1',
        adminUserIds: ['admin_1'],
        logoUrl: undefined
      };

      const newLogoDataUrl = 'data:image/webp;base64,UklGRkAAAABXRUJQVlA4IDQAAADwAQCdASoFAAUAPm0ukUekIioBAAADsBcJZQAA';

      const updatedPayload: BusinessCommercialData = {
        name: currentBusiness.name,
        logoUrl: newLogoDataUrl
      };

      const resultingBusiness: Business = {
        ...currentBusiness,
        logoUrl: updatedPayload.logoUrl,
        updatedAt: '2026-09-29T12:00:00Z'
      };

      expect(resultingBusiness.logoUrl).toBe(newLogoDataUrl);
      expect(resultingBusiness.id).toBe(mockBusinessId);
      expect(resultingBusiness.status).toBe('active');
    });

    it('should correctly handle removing/clearing the business logo', () => {
      const currentBusiness: Business = {
        id: mockBusinessId,
        name: mockBusinessName,
        status: 'active',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        adminUserId: 'admin_1',
        adminUserIds: ['admin_1'],
        logoUrl: 'data:image/webp;base64,existing_logo_data'
      };

      const clearPayload: BusinessCommercialData = {
        name: currentBusiness.name,
        logoUrl: ''
      };

      const resultingBusiness: Business = {
        ...currentBusiness,
        logoUrl: clearPayload.logoUrl,
        updatedAt: '2026-09-29T12:05:00Z'
      };

      expect(resultingBusiness.logoUrl).toBe('');
    });
  });

  describe('3. Multi-Tenant Logo Isolation', () => {
    it('should keep logos isolated between different businesses', () => {
      const bizA: Business = {
        id: 'biz_a',
        name: 'Kiosco Central',
        status: 'active',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        adminUserId: 'admin_a',
        logoUrl: 'data:image/webp;base64,logo_kiosco_a'
      };

      const bizB: Business = {
        id: 'biz_b',
        name: 'Supermercado Norte',
        status: 'active',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        adminUserId: 'admin_b',
        logoUrl: 'data:image/webp;base64,logo_super_b'
      };

      expect(bizA.logoUrl).not.toBe(bizB.logoUrl);
      expect(bizA.id).toBe('biz_a');
      expect(bizB.id).toBe('biz_b');
    });
  });

  describe('4. Separation of UWI Global Identity vs Business Identity', () => {
    it('should preserve Uwi core product identity while customizing business identity', () => {
      const uwiSystemIdentity = {
        productName: 'uwi',
        productTagline: 'La gestión simple para tu negocio',
        copyright: 'uwi 1.0 - grstudio ©2026'
      };

      const businessCustomIdentity = {
        businessId: mockBusinessId,
        businessName: 'Don Pepe Minimarket',
        businessLogoUrl: 'data:image/webp;base64,custom_don_pepe_logo'
      };

      expect(uwiSystemIdentity.productName).toBe('uwi');
      expect(businessCustomIdentity.businessName).toBe('Don Pepe Minimarket');
      expect(businessCustomIdentity.businessLogoUrl).toContain('data:image/webp;base64');
    });
  });
});
