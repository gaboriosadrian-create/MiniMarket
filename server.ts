import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { processMercadoPagoWebhook } from './server/mercadopago/webhookService.js';
import { getSanitizedMercadoPagoConfig } from './server/mercadopago/config.js';
import { auditStore } from './server/mercadopago/auditStore.js';
import { createRealMercadoPagoOrder, cancelMercadoPagoOrder } from './server/mercadopago/orderService.js';
import { orderRegistry } from './server/mercadopago/orderRegistry.js';
import { tenantConfigStore } from './server/mercadopago/tenantConfigStore.js';
import { verifyMercadoPagoConnection } from './server/mercadopago/connectionVerifier.js';
import { validateMercadoPagoSalePayment } from './server/mercadopago/saleValidator.js';
import { checkAndSyncOrderStatus } from './server/mercadopago/statusChecker.js';
import { paymentProviderService, maskUserId } from './server/mercadopago/paymentProviderService.js';
import {
  getPlatformAppConfig,
  setPlatformAppConfig,
  getSanitizedPlatformConfig,
} from './server/mercadopago/platformConfig.js';
import { oauthStateStore } from './server/mercadopago/oauthStateStore.js';
import { persistenceService } from './server/mercadopago/persistenceService.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // JSON Body parsing for API routes and Webhooks
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // =========================================================================
  // API ROUTES (FIRST)
  // =========================================================================

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'MiniMarket Backend',
      timestamp: new Date().toISOString(),
    });
  });

  // Mercado Pago Status Endpoint (Safe, multi-tenant, no tokens or secrets exposed)
  app.get('/api/mercadopago/status', (req, res) => {
    const businessId = String(req.query.businessId || '').trim();
    const config = getSanitizedMercadoPagoConfig(businessId || undefined);
    const providerStatus = paymentProviderService.getSanitizedStatus(businessId || 'default');

    res.json({
      status: 'ok',
      enabled: providerStatus.enabled,
      connected: providerStatus.connected,
      connectionStatus: providerStatus.status,
      provider: 'mercadopago',
      accountInfo: providerStatus.accountInfo,
      config,
      recentAuditsCount: auditStore.getRecentLogs(10).length,
    });
  });

  // Mercado Pago Connect Endpoint (Initiates real OAuth or controlled unconfigured error)
  app.get('/api/mercadopago/connect', async (req, res) => {
    try {
      const businessId = String(req.query.businessId || '').trim();
      if (!businessId) {
        return res.status(400).json({ success: false, message: 'businessId es requerido para conectar Mercado Pago.' });
      }

      const uid = String(req.query.uid || req.headers['x-user-uid'] || 'anonymous').trim();
      const host = req.get('host') || 'localhost:3000';
      const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const platformConfig = getPlatformAppConfig();
      const redirectUri = platformConfig.redirectUri || `${protocol}://${host}/api/mercadopago/callback`;

      // 1. Verify if Uwi platform application credentials are fully configured
      if (!platformConfig.isConfigured) {
        // Test suite / explicit test environment fallback
        const isExplicitTestMode = req.query.mode === 'TEST' || process.env.NODE_ENV === 'test';
        if (isExplicitTestMode) {
          const result = await paymentProviderService.connectBusiness({
            businessId,
            mode: 'TEST',
            accountNickname: 'Cuenta Comercial Sandbox',
          });
          if (req.headers.accept?.includes('application/json') || req.query.format === 'json') {
            return res.json({ success: true, connected: true, provider: result.provider });
          }
          return res.redirect('/?mp_status=connected#minegocio');
        }

        // Strict Production Mode: Return controlled technical error. DO NOT simulate connection.
        return res.status(400).json({
          success: false,
          error: 'MERCADOPAGO_NOT_CONFIGURED',
          message: 'Mercado Pago no está configurado para conexión de comercios.',
        });
      }

      // 2. Generate cryptographically secure, time-limited, single-use state bound to user and businessId
      const state = oauthStateStore.createState({
        uid,
        businessId,
      });

      const authUrl = `https://auth.mercadopago.com.ar/authorization?client_id=${encodeURIComponent(platformConfig.clientId)}&response_type=code&platform_id=mp&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}`;

      if (req.headers.accept?.includes('application/json') || req.query.format === 'json') {
        return res.json({
          success: true,
          authUrl,
          state,
        });
      }

      return res.redirect(authUrl);
    } catch (err: any) {
      console.error('[MercadoPago Connect Error]:', err);
      res.status(500).json({ success: false, message: err.message || 'Error al conectar Mercado Pago.' });
    }
  });

  // Mercado Pago OAuth Callback Endpoint
  app.get('/api/mercadopago/callback', async (req, res) => {
    try {
      const error = String(req.query.error || '').trim();
      const errorDescription = String(req.query.error_description || '').trim();

      if (error) {
        console.warn('[MercadoPago Callback] User cancelled or error returned from MP:', error, errorDescription);
        return res.redirect(`/?mp_error=${encodeURIComponent(errorDescription || error || 'Autorización cancelada')}#minegocio`);
      }

      const code = String(req.query.code || '').trim();
      const state = String(req.query.state || '').trim();

      if (!code) {
        return res.redirect(`/?mp_error=${encodeURIComponent('No se recibió código de autorización de Mercado Pago')}#minegocio`);
      }

      // Validate & consume state (anti-CSRF, anti-replay, one-time use, expiration)
      const stateValidation = oauthStateStore.validateAndConsumeState(state);
      if (!stateValidation.valid || !stateValidation.data) {
        console.error('[MercadoPago Callback] State validation failed:', stateValidation.error, stateValidation.message);
        return res.redirect(`/?mp_error=${encodeURIComponent(stateValidation.message || 'Error de validación de seguridad (state inválido o expirado)')}#minegocio`);
      }

      const { businessId } = stateValidation.data;

      const host = req.get('host') || 'localhost:3000';
      const protocol = req.protocol === 'https' || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
      const platformConfig = getPlatformAppConfig();
      const redirectUri = platformConfig.redirectUri || `${protocol}://${host}/api/mercadopago/callback`;

      await paymentProviderService.connectBusiness({
        businessId,
        code,
        redirectUri,
      });

      res.redirect('/?mp_status=connected#minegocio');
    } catch (err: any) {
      console.error('[MercadoPago Callback Error]:', err);
      res.redirect(`/?mp_error=${encodeURIComponent(err.message || 'Error de autorización')}#minegocio`);
    }
  });

  // Mercado Pago Disconnect Endpoint
  app.post('/api/mercadopago/disconnect', (req, res) => {
    try {
      const businessId = String(req.body?.businessId || req.query?.businessId || '').trim();
      if (!businessId) {
        return res.status(400).json({ success: false, message: 'businessId es requerido para desconectar Mercado Pago.' });
      }

      const result = paymentProviderService.disconnectBusiness(businessId);
      res.json(result);
    } catch (err: any) {
      console.error('[MercadoPago Disconnect Error]:', err);
      res.status(500).json({ success: false, message: err.message || 'Error al desconectar Mercado Pago.' });
    }
  });

  // Super Admin: Mercado Pago Platform App Configuration (GET - sanitized)
  app.get('/api/mercadopago/platform-config', (_req, res) => {
    const config = getSanitizedPlatformConfig();
    res.json({
      success: true,
      config,
    });
  });

  // Super Admin: Mercado Pago Platform App Configuration (POST - update)
  app.post('/api/mercadopago/platform-config', (req, res) => {
    try {
      const { clientId, clientSecret, redirectUri } = req.body || {};
      setPlatformAppConfig({
        clientId,
        clientSecret,
        redirectUri,
      });
      res.json({
        success: true,
        message: 'Configuración técnica de Mercado Pago guardada exitosamente.',
        config: getSanitizedPlatformConfig(),
      });
    } catch (err: any) {
      console.error('[MercadoPago Platform Config Error]:', err);
      res.status(500).json({
        success: false,
        message: 'Error al guardar la configuración técnica de Mercado Pago.',
      });
    }
  });

  // Super Admin: List all connected merchants and their statuses
  app.get('/api/mercadopago/merchants', (_req, res) => {
    try {
      const allPersisted = persistenceService.getAllConnections();
      const merchants = allPersisted.map((conn) => ({
        businessId: conn.businessId,
        status: conn.status,
        provider: 'mercadopago',
        userId: maskUserId(conn.userId),
        siteId: conn.siteId || 'MLA',
        externalStoreId: conn.externalStoreId,
        storeId: conn.storeId,
        externalPosId: conn.externalPosId,
        posId: conn.posId,
        accountNickname: conn.accountNickname,
        accountEmail: conn.accountEmail,
        connectedAt: conn.connectedAt,
        updatedAt: conn.updatedAt,
      }));
      res.json({
        success: true,
        merchants,
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Error al listar comercios.' });
    }
  });

  // Mercado Pago Tenant Configuration - GET (Sanitized, no tokens)
  app.get('/api/mercadopago/config', (req, res) => {
    try {
      const businessId = String(req.query.businessId || 'default').trim();
      const sanitized = tenantConfigStore.getSanitizedConfig(businessId);
      res.json({
        success: true,
        config: sanitized,
      });
    } catch (err: any) {
      console.error('[MercadoPago Get Config Error]:', err);
      res.status(500).json({
        success: false,
        message: 'No se pudo obtener la configuración de Mercado Pago',
      });
    }
  });

  // Mercado Pago Tenant Configuration - POST (Update, Admin only)
  app.post('/api/mercadopago/config', (req, res) => {
    try {
      const {
        businessId = 'default',
        enabled,
        mode,
        autoConfirm,
        testConfig,
        productionConfig,
        updatedBy,
      } = req.body || {};

      tenantConfigStore.saveConfig(String(businessId).trim(), {
        enabled,
        mode,
        autoConfirm,
        testConfig,
        productionConfig,
        updatedBy,
      });

      const sanitized = tenantConfigStore.getSanitizedConfig(String(businessId).trim());
      res.json({
        success: true,
        message: 'Configuración de Mercado Pago guardada correctamente.',
        config: sanitized,
      });
    } catch (err: any) {
      console.error('[MercadoPago Save Config Error]:', err);
      res.status(500).json({
        success: false,
        message: 'Error al guardar la configuración de Mercado Pago',
      });
    }
  });

  // Mercado Pago Connection Test - POST (Ping without creating orders or sales)
  app.post('/api/mercadopago/config/test', async (req, res) => {
    try {
      const { businessId = 'default', mode, testedBy } = req.body || {};
      const result = await verifyMercadoPagoConnection({
        businessId: String(businessId).trim(),
        mode,
        testedBy,
      });
      res.json(result);
    } catch (err: any) {
      console.error('[MercadoPago Verify Connection Error]:', err);
      res.status(500).json({
        success: false,
        status: 'ERROR',
        message: 'No se pudo verificar la integración con Mercado Pago.',
        testedAt: new Date().toISOString(),
      });
    }
  });

  // Mercado Pago Recent Audit Logs Endpoint (Safe, no tokens)
  app.get('/api/mercadopago/audits', (req, res) => {
    const limit = Number(req.query.limit) || 50;
    const logs = auditStore.getRecentLogs(limit);
    res.json({
      success: true,
      logs,
    });
  });

  // Mercado Pago Create Real Order Endpoint (from POS cart)
  app.post('/api/mercadopago/create-order', async (req, res) => {
    try {
      const result = await createRealMercadoPagoOrder(req.body);
      res.json(result);
    } catch (err: any) {
      console.error('[MercadoPago Create Order Error]:', err);
      res.status(500).json({
        success: false,
        status: 'ERROR',
        message: 'No se pudo crear la orden de Mercado Pago.',
        details: err?.message || 'Error interno',
      });
    }
  });

  // Mercado Pago Cancel Order Endpoint
  app.post('/api/mercadopago/cancel-order', async (req, res) => {
    try {
      const { externalReference, orderId, businessId } = req.body || {};
      const ref = String(externalReference || orderId || '').trim();
      const result = await cancelMercadoPagoOrder(ref, businessId);
      res.json(result);
    } catch (err: any) {
      console.error('[MercadoPago Cancel Order Error]:', err);
      res.status(500).json({
        success: false,
        message: 'Error al cancelar la orden en Mercado Pago.',
      });
    }
  });

  // Mercado Pago Order Status Query Endpoint
  app.get('/api/mercadopago/order-status', async (req, res) => {
    const reference = String(req.query.external_reference || req.query.ref || req.query.order_id || '').trim();
    const businessId = String(req.query.businessId || '').trim();
    if (!reference) {
      return res.status(400).json({
        ok: false,
        success: false,
        message: 'Se requiere external_reference u order_id',
      });
    }

    try {
      const statusResult = await checkAndSyncOrderStatus(reference, businessId || undefined);
      res.json(statusResult);
    } catch (err: any) {
      res.status(500).json({
        ok: false,
        success: false,
        message: 'Error al consultar estado de orden',
        details: err?.message,
      });
    }
  });

  // Mercado Pago Order Status by ID Endpoint (RESTful pattern: /api/mercadopago/orders/:orderId/status)
  app.get('/api/mercadopago/orders/:orderId/status', async (req, res) => {
    const orderId = String(req.params.orderId || '').trim();
    const businessId = String(req.query.businessId || '').trim();
    if (!orderId) {
      return res.status(400).json({
        ok: false,
        success: false,
        message: 'Se requiere orderId válido',
      });
    }

    try {
      const statusResult = await checkAndSyncOrderStatus(orderId, businessId || undefined);
      res.json(statusResult);
    } catch (err: any) {
      res.status(500).json({
        ok: false,
        success: false,
        message: 'Error al consultar estado de orden',
        details: err?.message,
      });
    }
  });

  // Mercado Pago Validate Sale Confirmation Endpoint (Server-Side Verification)
  app.post('/api/mercadopago/validate-sale', async (req, res) => {
    try {
      const {
        externalReference,
        orderId,
        expectedAmount,
        businessId,
        posId,
        mercadoPagoSource,
      } = req.body || {};

      const validation = await validateMercadoPagoSalePayment({
        externalReference,
        orderId,
        expectedAmount: expectedAmount !== undefined ? Number(expectedAmount) : undefined,
        businessId,
        posId,
        mercadoPagoSource,
      });

      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          valid: false,
          reason: validation.reason,
          code: validation.code,
        });
      }

      res.json({
        success: true,
        valid: true,
        order: validation.order,
      });
    } catch (err: any) {
      console.error('[MercadoPago Validate Sale Error]:', err);
      res.status(500).json({
        success: false,
        valid: false,
        reason: 'Error al validar la orden de Mercado Pago en servidor.',
      });
    }
  });

  // Mercado Pago Webhook Endpoint
  app.post('/api/mercadopago/webhook', async (req, res) => {
    try {
      const result = await processMercadoPagoWebhook(req.body, req.query, req.headers);
      res.status(result.statusCode).json(result.body);
    } catch (err: any) {
      console.error('[MercadoPago Webhook Server Error]:', err);
      // Always return 200/500 cleanly to avoid hanging socket
      res.status(200).json({
        success: false,
        status: 'ERROR',
        message: 'Internal server error processing webhook',
        details: err?.message || 'Unknown error',
      });
    }
  });

  // =========================================================================
  // VITE MIDDLEWARE (DEV) & STATIC FILE SERVING (PROD)
  // =========================================================================
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MiniMarket Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start MiniMarket server:', err);
});
