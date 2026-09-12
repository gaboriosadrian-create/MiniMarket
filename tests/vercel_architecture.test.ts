import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('\n======================================================');
console.log('  UWI: VERCEL ARCHITECTURE & PERSISTENCE TESTS');
console.log('======================================================\n');

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  try {
    const res = fn();
    if (res instanceof Promise) {
      return res
        .then(() => {
          console.log(`  ✓ ${name}`);
          passed++;
        })
        .catch((err: any) => {
          console.error(`  ✗ FAIL: ${name}:`, err.message);
          failed++;
          process.exit(1);
        });
    } else {
      console.log(`  ✓ ${name}`);
      passed++;
    }
  } catch (err: any) {
    console.error(`  ✗ FAIL: ${name}:`, err.message);
    failed++;
    process.exit(1);
  }
}

async function runAllTests() {
  // =========================================================================
  // 1. ROUTING: Vercel Rewrites Inspection
  // =========================================================================
  const vercelConfigPath = path.join(process.cwd(), 'vercel.json');
  assert.ok(fs.existsSync(vercelConfigPath), 'vercel.json debe existir');
  const vercelConfig = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf-8'));

  test('1. ROUTING: vercel.json no contiene ningún rewrite hacia Cloud Run (ais-pre/run.app)', () => {
    const rewrites = vercelConfig.rewrites || [];
    for (const r of rewrites) {
      assert.ok(
        !r.destination.includes('run.app') && !r.destination.includes('ais-pre'),
        `El rewrite para ${r.source} apunta a Cloud Run: ${r.destination}`
      );
      if (r.source.startsWith('/api')) {
        assert.ok(
          r.destination.startsWith('/api/mercadopago/'),
          `Rewrite para API debe ser exclusivamente local: ${r.destination}`
        );
      }
    }
  });

  test('2. ROUTING: vercel.json preserva rewrites internos locales y fallback SPA', () => {
    const rewrites = vercelConfig.rewrites || [];
    const spaRewrite = rewrites.find((r: any) => r.source === '/((?!api/).*)');
    assert.ok(spaRewrite, 'Debe existir el rewrite de SPA fallback');
    assert.strictEqual(spaRewrite.destination, '/index.html');

    const apiRewrites = rewrites.filter((r: any) => r.source.startsWith('/api/'));
    assert.strictEqual(apiRewrites.length, 6, 'Debe haber exactamente 6 rewrites internos para las Functions consolidadas');
    for (const ar of apiRewrites) {
      assert.ok(
        ar.destination.startsWith('/api/mercadopago/'),
        `Destino debe ser Serverless Function local: ${ar.destination}`
      );
    }
  });

  test('3. ROUTING: vercel.json preserva headers de Service Worker y Manifests', () => {
    const headers = vercelConfig.headers || [];
    assert.ok(headers.length >= 3, 'Debe contener los headers de PWA y cache');
    const sources = headers.map((h: any) => h.source);
    assert.ok(sources.includes('/sw.js'), 'Debe incluir header para /sw.js');
    assert.ok(sources.includes('/manifest.webmanifest'), 'Debe incluir header para /manifest.webmanifest');
    assert.ok(sources.includes('/manifest.json'), 'Debe incluir header para /manifest.json');
  });

  // =========================================================================
  // 2. BUNDLE: Backend Isolation from Public Static Directory (dist/)
  // =========================================================================
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

  test('4. BUNDLE: package.json compila el bundle de Cloud Run en dist-server/ y NO en dist/', () => {
    assert.ok(
      packageJson.scripts.build.includes('dist-server/server.cjs'),
      'scripts.build debe generar el bundle en dist-server/server.cjs'
    );
    assert.ok(
      !packageJson.scripts.build.includes('dist/server.cjs'),
      'scripts.build NO debe generar el bundle dentro de dist/'
    );
  });

  test('5. BUNDLE: package.json inicia Cloud Run desde dist-server/server.cjs', () => {
    assert.strictEqual(
      packageJson.scripts.start,
      'node dist-server/server.cjs',
      'scripts.start debe ejecutar node dist-server/server.cjs'
    );
  });

  test('6. BUNDLE: .gitignore incluye dist-server/ para evitar commit del binario backend', () => {
    const gitignore = fs.readFileSync(path.join(process.cwd(), '.gitignore'), 'utf-8');
    assert.ok(gitignore.includes('dist-server/'), '.gitignore debe incluir dist-server/');
  });

  // =========================================================================
  // 3. PERSISTENCE: Serverless Execution Without Filesystem Dependency
  // =========================================================================
  // Simulate Serverless Environment (Vercel)
  process.env.VERCEL = '1';

  // Dynamically import persistenceService under simulated serverless mode
  const { persistenceService } = await import('../server/mercadopago/persistenceService.js');

  await test('7. PERSISTENCIA: Lectura por businessId funciona en Serverless sin archivo local', async () => {
    const dummyBusiness = 'BIZ_VERCEL_MOCK_123';
    const conn = await persistenceService.getConnectionAsync(dummyBusiness);
    // Connection does not exist yet, returns null gracefully without disk read errors
    assert.strictEqual(conn, null);
  });

  await test('8. PERSISTENCIA: No ejecuta listado global getDocs en flujo Serverless', async () => {
    const all = await persistenceService.getAllConnectionsAsync();
    assert.ok(Array.isArray(all), 'getAllConnectionsAsync debe retornar un array');
  });

  await test('9. PERSISTENCIA: Guardado en Serverless no crea ni escribe en data/mercadopago_connections.json', async () => {
    const testBusiness = 'BIZ_VERCEL_ISOLATION_99';
    await persistenceService.saveConnectionAsync({
      businessId: testBusiness,
      provider: 'mercadopago',
      status: 'CONNECTED',
      accountNickname: 'Test Serverless Vercel',
      siteId: 'MLA',
    });

    // Verify cache has the updated record
    const retrieved = await persistenceService.getConnectionAsync(testBusiness);
    assert.ok(retrieved !== null, 'El registro guardado debe ser recuperable');
    assert.strictEqual(retrieved?.businessId, testBusiness);
    assert.strictEqual(retrieved?.status, 'CONNECTED');

    // Clean up
    await persistenceService.removeConnectionAsync(testBusiness);
    const afterDelete = await persistenceService.getConnectionAsync(testBusiness);
    assert.strictEqual(afterDelete, null, 'El registro eliminado debe retornar null');
  });

  // =========================================================================
  // 4. CONSOLIDATION: Physical Functions Count Verification
  // =========================================================================
  test('10. CONSOLIDACION: Existen exactamente 12 Serverless Functions físicas en /api', () => {
    function countTsFiles(dir: string): string[] {
      let files: string[] = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files = files.concat(countTsFiles(full));
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.js')) {
          files.push(full);
        }
      }
      return files;
    }
    const apiFiles = countTsFiles(path.join(process.cwd(), 'api'));
    assert.strictEqual(
      apiFiles.length,
      12,
      `Debe haber exactamente 12 funciones físicas en api/, encontradas: ${apiFiles.length}`
    );
  });

  console.log('\n------------------------------------------------------');
  console.log(` RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('------------------------------------------------------\n');
}

runAllTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
