# Integración Opcional de Mercado Pago Argentina (QR Orders Webhook) — MiniMarket

Este documento detalla la arquitectura backend, especificaciones de seguridad, manejo de eventos y procedimientos operativos para la integración opcional con **Mercado Pago Argentina** en MiniMarket.

---

## 1. Principio Fundamental y Separación Conceptual

La aplicación distingue estrictamente dos conceptos independientes:

### A) Mercado Pago como Medio de Pago (Manual / POS)
- **Funcionalidad nativa existente**: El vendedor puede registrar ventas cobradas por Mercado Pago presionando el botón "Mercado Pago" en la caja registradora.
- **Funcionamiento garantizado**: Permanece **100% activo e inalterado** independientemente de si la integración automática está configurada o desactivada.

### B) Integración Automática con Mercado Pago (Opcional / Backend)
- Infraestructura server-side que recibe notificaciones de órdenes de pago QR, consulta la API de Mercado Pago, valida la transacción y permite la auto-confirmación de operaciones vinculadas.
- **Estado por defecto**: **DESACTIVADA (`MERCADOPAGO_ENABLED=false`)**.

---

## 2. Variables de Entorno

Todas las credenciales privadas y configuraciones sensibles residen **exclusivamente en el backend / servidor**:

| Variable | Tipo | Default | Descripción |
| :--- | :--- | :--- | :--- |
| `MERCADOPAGO_ENABLED` | `boolean` | `false` | Activa la recepción y procesamiento de la integración. Si es `false` o no existe, la integración está totalmente inactiva. |
| `MERCADOPAGO_AUTO_CONFIRM` | `boolean` | `false` | Si es `true`, auto-confirma la operación server-side al validar pago exitoso. Si es `false`, audita el evento sin modificar el flujo manual del vendedor. |
| `MERCADOPAGO_ACCESS_TOKEN` | `string` | `""` | Access Token privado de Mercado Pago (**NUNCA exponer en cliente frontend**). |
| `MERCADOPAGO_USER_ID` | `string` | `3634603825` (PoC) | ID de la cuenta de Mercado Pago vinculada. |
| `MERCADOPAGO_SITE_ID` | `string` | `MLA` | Sitio de Mercado Pago (`MLA` para Argentina). |
| `MERCADOPAGO_EXTERNAL_STORE_ID` | `string` | `MINIMARKET-POC-SUC-01` | Identificador externo de la sucursal/comercio. |
| `MERCADOPAGO_EXTERNAL_POS_ID` | `string` | `MINIMARKETPOCCAJA01` | Identificador externo del punto de venta/caja. |
| `MERCADOPAGO_STORE_ID` | `string` | `86501276` | ID numérico de la sucursal en Mercado Pago. |
| `MERCADOPAGO_POS_ID` | `string` | `137101354` | ID numérico del POS asignado en Mercado Pago. |

---

## 3. Modos de Operación

```
                    MERCADO PAGO WEBHOOK
                             │
                             ▼
               POST /api/mercadopago/webhook
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
   MERCADOPAGO_ENABLED=false         MERCADOPAGO_ENABLED=true
            │                                 │
     200 OK (Sin efectos)             Consultar Order en MP
     Vendedor cobra manual                    │
                                      Validaciones & Ref
                                              │
                              ┌───────────────┴───────────────┐
                              ▼                               ▼
                 MERCADOPAGO_AUTO_CONFIRM=false  MERCADOPAGO_AUTO_CONFIRM=true
                              │                               │
                       Auditoría técnica             Confirmación Automática
                       Vendedor cobra manual         Idempotente en MiniMarket
```

### Modo 1: Integración Desactivada (`MERCADOPAGO_ENABLED=false`)
- El webhook responde HTTP 200 OK informando `{ status: "DISABLED" }`.
- No consulta APIs externas, no modifica ventas, no altera stock, no bloquea al comercio.
- El vendedor continúa utilizando el cobro manual con normalidad.

### Modo 2: Integración Activa sin Auto-Confirmación (`MERCADOPAGO_ENABLED=true`, `MERCADOPAGO_AUTO_CONFIRM=false`)
- El webhook recibe el evento y consulta la orden en la API oficial de Mercado Pago.
- Se realizan todas las validaciones de seguridad (moneda, monto, POS, user_id).
- Se genera un registro de auditoría técnica.
- **No se auto-confirma la venta en la caja**: el vendedor confirma el cobro manualmente cuando lo desee.

### Modo 3: Integración Completa con Auto-Confirmación (`MERCADOPAGO_ENABLED=true`, `MERCADOPAGO_AUTO_CONFIRM=true`)
- Al validar que la orden está procesada y tiene un pago aprobado, el backend auto-confirma la operación vinculada a través de `external_reference`.
- La operación es 100% idempotente: no se duplican ventas ni movimientos de stock si Mercado Pago reenvía el webhook.

---

## 4. Endpoints Backend Creados

### `POST /api/mercadopago/webhook`
Endpoint receptor de notificaciones Webhook de Mercado Pago.
- Compatible con payloads estándar:
  ```json
  {
    "action": "order.processed",
    "api_version": "v1",
    "data": { "id": "123456789" },
    "date_created": "2026-08-24T10:00:00.000Z",
    "id": 998877,
    "live_mode": false,
    "type": "order",
    "user_id": 3634603825
  }
  ```
- Soporta también notificaciones vía Query Params (`?data.id=...`, `?id=...`, `?topic=merchant_order`).

### `GET /api/mercadopago/status`
Endpoint seguro para diagnóstico del estado de la integración (no expone tokens ni secretos).
- Respuesta:
  ```json
  {
    "status": "ok",
    "config": {
      "enabled": false,
      "autoConfirm": false,
      "hasAccessToken": false,
      "siteId": "MLA",
      "userId": "3634603825",
      "externalStoreId": "MINIMARKET-POC-SUC-01",
      "externalPosId": "MINIMARKETPOCCAJA01"
    },
    "recentAuditsCount": 0
  }
  ```

### `GET /api/health`
Endpoint de salud del backend.

---

## 5. Idempotencia y Seguridad

1. **Fuente de Verdad**: Nunca se confía únicamente en el payload del Webhook. La confirmación siempre consulta `GET https://api.mercadopago.com/v1/orders/{order_id}` con autenticación Bearer.
2. **Control de Idempotencia**: Cada `order_id` y `payment_id` es registrado en un almacén de idempotencia. Si Mercado Pago reenvía el mismo evento, se devuelve HTTP 200 con estado `DUPLICATE` y **no se ejecutan efectos secundarios por segunda vez**.
3. **Validación de Moneda**: Se exige `currency_id: "ARS"`.
4. **Validación de Identificadores**: Se verifica la correspondencia de `user_id` y `external_pos_id` si están configurados.
5. **external_reference Obligatorio**: No se confirma ninguna orden que no posea un identificador vinculante con una operación de MiniMarket.

---

## 6. Procedimiento de Pruebas

### Ejecutar la Suite de Tests Automatizados
MiniMarket incluye 26 tests automatizados que cubren todos los escenarios:

```bash
npm test
```

Los tests validan:
- Integración apagada vs encendida
- Auto-confirmación activada vs desactivada
- Webhooks válidos, inválidos y sin order_id
- Detección de duplicados (Idempotencia)
- Órdenes en estado `created`, `processed`, `failed`, `expired`
- Manejo de errores HTTP (401, 403, 404, 500, 503, timeout)
- No regresión del POS manual

### Prueba Local con cURL
Para simular un webhook en desarrollo local:

```bash
curl -X POST http://localhost:3000/api/mercadopago/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "action": "order.processed",
    "type": "order",
    "data": { "id": "123456789" }
  }'
```

---

## 7. Despliegue en Vercel

Para desplegar en Vercel con soporte de Serverless Functions:
1. En el panel de Vercel (Project Settings > Environment Variables), configurar:
   - `MERCADOPAGO_ENABLED=false` (o `true` para activar)
   - `MERCADOPAGO_AUTO_CONFIRM=false` (o `true` para auto-confirmar)
   - `MERCADOPAGO_ACCESS_TOKEN=<tu_access_token_privado>`
   - `MERCADOPAGO_USER_ID=...`
   - `MERCADOPAGO_EXTERNAL_POS_ID=...`
2. Las funciones serverless en `/api/mercadopago/webhook` responderán de forma automática con la misma lógica.

---

## 8. Cómo Activar la Integración Posteriormente

Para que un comercio active la integración cuando esté listo:
1. Configurar `MERCADOPAGO_ACCESS_TOKEN` con el token de producción/sandbox de Mercado Pago.
2. Establecer `MERCADOPAGO_ENABLED=true`.
3. (Opcional) Establecer `MERCADOPAGO_AUTO_CONFIRM=true` si se desea confirmación automática en caja.
4. Reiniciar la aplicación o dev server.
