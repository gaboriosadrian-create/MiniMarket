/**
 * Migration Script: Mercado Pago Connections (JSON to Firestore)
 * 
 * Safely transfers stored connections from data/mercadopago_connections.json
 * to the durable 'business_payment_providers' Firestore collection.
 * 
 * Features:
 * - Multi-tenant isolation by businessId
 * - Anti-overwrite protection (preserves newer Firestore records)
 * - Safe logging: NEVER outputs access tokens or refresh tokens
 * - Non-destructive: keeps data/mercadopago_connections.json intact as backup
 */

import { persistenceService } from '../server/mercadopago/persistenceService.js';

async function runMigration() {
  console.log('======================================================');
  console.log('  UWI: MERCADO PAGO CONNECTION MIGRATION TO FIRESTORE');
  console.log('======================================================');
  console.log(`Starting migration at: ${new Date().toISOString()}`);

  try {
    const result = await persistenceService.migrateFromDiskToFirestore();
    console.log('\n--- MIGRATION SUMMARY ---');
    console.log(`Total Migrated: ${result.migrated}`);
    console.log(`Total Skipped:  ${result.skipped}`);
    console.log(`Total Errors:   ${result.errors}`);

    if (result.details.length > 0) {
      console.log('\n--- RECORD DETAILS ---');
      for (const d of result.details) {
        console.log(`- Business: [${d.businessId}] | Status: ${d.status} | Result: ${d.result}${d.reason ? ` (${d.reason})` : ''}`);
      }
    }
    console.log('======================================================');
    process.exit(result.errors > 0 ? 1 : 0);
  } catch (err: any) {
    console.error('Fatal error during migration:', err?.message || err);
    process.exit(1);
  }
}

runMigration();
