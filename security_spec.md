# MiniMarket Security Specification & Threat Model

## 1. Data Invariants
1. **Multi-Tenant Isolation**: No authenticated or unauthenticated user can read, create, update, or delete data belonging to a different `businessId`.
2. **Role-Based Access Control (RBAC)**:
   - `SUPER_ADMIN`: Full system access across businesses.
   - `ADMIN`: Full operational and managerial access within their own `businessId`. Cannot modify other businesses or assign `SUPER_ADMIN` role.
   - `SELLER`: Access strictly restricted by granular `permissions` (Sales, Inventory, Receiving, Purchases, Cash, Replenishment). Inactive, blocked, or disabled users are rejected from all protected operations.
3. **Identity & Role Immutability**: Users cannot self-escalate roles, tamper with `businessId`, or unblock themselves.
4. **Terminal State Immutability**:
   - `receivings`: Once `status == 'CONFIRMED'`, no further edits can occur.
   - `stock_adjustments`: Once `status == 'CONFIRMED'`, stock changes are permanent and doc cannot be edited.
   - `sales`: Completed sales cannot be modified or deleted by sellers/admins.
   - `audit_logs`: Append-only collection; `update` and `delete` are strictly prohibited for all users.
5. **Supplier Order Security**:
   - `public_orders`: Public unauthenticated access allows `get` of specific token doc only (collection `list` queries are blocked).
   - Unauthenticated suppliers can ONLY transition a `PENDING` order to `CONFIRMED_BY_PROVIDER` and submit their `providerResponse` matching the exact schema without tampering with `businessRefId`, `orderRefId`, `items`, or `requestCode`.

---

## 2. The "Dirty Dozen" Malicious Payloads (Penetration Test Vectors)

1. **Cross-Tenant Product Read / Update (Tenant Breach)**:
   - *Payload*: Requesting `products/prod_123` with header `auth.uid` belonging to `business_B`, while doc belongs to `business_A`.
   - *Expected*: `PERMISSION_DENIED`.

2. **Self-Escalation Attack (Role Forgery)**:
   - *Payload*: `updateDoc(userRef, { role: 'SUPER_ADMIN' })` from a logged-in `SELLER` account.
   - *Expected*: `PERMISSION_DENIED`.

3. **Shadow Field Injection (Ghost Field)**:
   - *Payload*: `updateDoc(productRef, { name: 'Agua 500ml', isSuperVipPromoFree: true })`.
   - *Expected*: `PERMISSION_DENIED` or field rejected.

4. **Negative Quantity / Infinite Stock Exploit**:
   - *Payload*: `confirmStockAdjustment({ quantity: -999999 })` or `NaN` to subtract or inject infinite inventory.
   - *Expected*: `PERMISSION_DENIED` / Runtime Exception caught.

5. **Confirmed Receiving Tampering (State Shortcutting)**:
   - *Payload*: `updateDoc(receivingRef, { items: [{ productId: 'p1', receivedQuantity: 9999 }] })` on a doc with `status == 'CONFIRMED'`.
   - *Expected*: `PERMISSION_DENIED`.

6. **Public Order Business ID Hijacking**:
   - *Payload*: Unauthenticated PUT to `/public_orders/tok_xyz` with modified `{ businessRefId: 'attacker_biz', items: [] }`.
   - *Expected*: `PERMISSION_DENIED`.

7. **Collection Scraping via Blanket Query (Query Trust Test)**:
   - *Payload*: Unauthenticated `getDocs(collection(db, 'public_orders'))` or `getDocs(collection(db, 'public_code_index'))`.
   - *Expected*: `PERMISSION_DENIED` (only direct single-document `get` is allowed).

8. **Audit Trail Deletion / Tampering (Anti-Forensics)**:
   - *Payload*: `deleteDoc(doc(db, 'audit_logs', 'log_xyz'))` or `updateDoc(doc(db, 'audit_logs', 'log_xyz'), { details: 'fake' })`.
   - *Expected*: `PERMISSION_DENIED`.

9. **Email Spoofing (Unverified Email Admin Escalation)**:
   - *Payload*: Firebase Auth token with `email: 'superadmin@minimarket.com'` but unverified / different UID without Firestore superadmin role.
   - *Expected*: `PERMISSION_DENIED`.

10. **Sales Record Falsification (Post-Facto Price Tampering)**:
    - *Payload*: `updateDoc(saleRef, { total: 0.01 })` after sale completion.
    - *Expected*: `PERMISSION_DENIED`.

11. **Negative Cash Register Payment / Money Creation**:
    - *Payload*: `createCashMovement({ amount: -999999999 })` without active permissions.
    - *Expected*: `PERMISSION_DENIED`.

12. **Double Confirmation Race Condition (Replay Attack)**:
    - *Payload*: Concurrently firing two `confirmPurchaseTransaction` or `confirmReceivingTransaction` on the same draft.
    - *Expected*: Atomic Firestore transaction aborts the second attempt with `Transaction failed: status is not DRAFT`.
