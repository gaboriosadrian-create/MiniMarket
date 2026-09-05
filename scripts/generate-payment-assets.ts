import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const outDir = path.join(process.cwd(), 'public/assets/payment-modes');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. Pago QR Point SVG (5:1 ratio, 1000x200)
const svgQrPoint = `
<svg width="1000" height="200" viewBox="0 0 1000 200" xmlns="http://www.w3.org/2000/svg">
  <!-- Deep black background -->
  <rect width="1000" height="200" fill="#000000" />

  <!-- Left Yellow Branding Block with Slanted Edge -->
  <polygon points="0,0 205,0 180,200 0,200" fill="#FFE600" />

  <!-- Mercado Pago Logo on Yellow Side -->
  <g transform="translate(30, 48)">
    <!-- MP Handshake Badge -->
    <ellipse cx="60" cy="30" rx="32" ry="24" fill="#002f6c" />
    <ellipse cx="60" cy="30" rx="28" ry="20" fill="#FFFFFF" />
    <path d="M48,30 C50,25 56,25 60,29 C64,25 70,25 72,30 C72,35 66,37 60,34 C54,37 48,35 48,30 Z" fill="#002f6c" />
    <path d="M54,28 L58,32 L66,26" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />

    <!-- Text: mercado pago -->
    <text x="60" y="74" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="22" fill="#002f6c" text-anchor="middle" letter-spacing="-0.5">mercado</text>
    <text x="60" y="96" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="22" fill="#002f6c" text-anchor="middle" letter-spacing="-0.5">pago</text>
  </g>

  <!-- Right Side: Mercado Pago Point Smart Terminal Graphic -->
  <g transform="translate(850, 15)">
    <!-- Terminal Body (Yellow Point Smart, angled) -->
    <g transform="rotate(12, 60, 80)">
      <!-- Main yellow casing -->
      <rect x="0" y="20" width="100" height="155" rx="18" fill="#FFE600" stroke="#E6CE00" stroke-width="2" />
      <rect x="12" y="20" width="76" height="22" rx="4" fill="#E6CE00" />
      <!-- White Paper Receipt -->
      <path d="M22,3 L78,3 L78,24 L22,24 Z" fill="#FFFFFF" stroke="#E5E7EB" stroke-width="1" />
      <line x1="28" y1="8" x2="72" y2="8" stroke="#9CA3AF" stroke-width="1.5" stroke-dasharray="3,2" />
      <line x1="32" y1="13" x2="68" y2="13" stroke="#D1D5DB" stroke-width="1.5" />
      <line x1="30" y1="18" x2="70" y2="18" stroke="#D1D5DB" stroke-width="1.5" />

      <!-- Screen Display -->
      <rect x="10" y="42" width="80" height="120" rx="8" fill="#FFFFFF" stroke="#D1D5DB" stroke-width="1" />
      <!-- MP Screen Header -->
      <rect x="10" y="42" width="80" height="14" rx="4" fill="#FFE600" />
      <text x="50" y="52" font-family="sans-serif" font-size="7" font-weight="bold" fill="#002f6c" text-anchor="middle">Total a cobrar</text>
      <!-- Amount Display on Screen -->
      <text x="75" y="70" font-family="sans-serif" font-size="12" font-weight="900" fill="#1F2937" text-anchor="end">$150.00</text>
      <line x1="16" y1="76" x2="84" y2="76" stroke="#E5E7EB" stroke-width="1" />
      <!-- Virtual Keypad Grid on Terminal -->
      <circle cx="26" cy="88" r="5" fill="#F3F4F6" />
      <circle cx="50" cy="88" r="5" fill="#F3F4F6" />
      <circle cx="74" cy="88" r="5" fill="#F3F4F6" />
      <circle cx="26" cy="102" r="5" fill="#F3F4F6" />
      <circle cx="50" cy="102" r="5" fill="#F3F4F6" />
      <circle cx="74" cy="102" r="5" fill="#F3F4F6" />
      <circle cx="26" cy="116" r="5" fill="#F3F4F6" />
      <circle cx="50" cy="116" r="5" fill="#F3F4F6" />
      <circle cx="74" cy="116" r="5" fill="#F3F4F6" />
      <rect x="20" y="126" width="60" height="10" rx="3" fill="#009EE3" />

      <!-- Side buttons -->
      <rect x="-4" y="60" width="4" height="16" rx="2" fill="#009EE3" />
      <rect x="-4" y="82" width="4" height="16" rx="2" fill="#009EE3" />
    </g>
  </g>
</svg>
`;

// 2. Pago QR Físico SVG (5:1 ratio, 1000x200) matching user uploaded "Pago QR Físico.png"
const svgQrFisico = `
<svg width="1000" height="200" viewBox="0 0 1000 200" xmlns="http://www.w3.org/2000/svg">
  <!-- Deep black background across entire canvas -->
  <rect width="1000" height="200" fill="#000000" />

  <!-- Right Side: Physical QR Stand + Hand holding Smartphone -->
  <g transform="translate(815, 6)">
    <!-- Yellow QR Stand in background -->
    <g transform="translate(45, 10)">
      <rect x="0" y="0" width="118" height="175" rx="8" fill="#FFE600" stroke="#E6CE00" stroke-width="1.5" />
      
      <!-- Top MP Brand on Stand -->
      <ellipse cx="38" cy="22" rx="14" ry="10" fill="#002f6c" />
      <ellipse cx="38" cy="22" rx="12" ry="8" fill="#FFFFFF" />
      <path d="M32,22 C34,19 37,19 38,21 C39,19 42,19 44,22 C44,25 41,26 38,24 C35,26 32,25 32,22 Z" fill="#002f6c" />
      <text x="56" y="20" font-family="sans-serif" font-size="7" font-weight="bold" fill="#002f6c">mercado</text>
      <text x="56" y="27" font-family="sans-serif" font-size="7" font-weight="bold" fill="#002f6c">pago</text>

      <!-- QR Code on Stand -->
      <rect x="18" y="44" width="82" height="82" rx="4" fill="#FFFFFF" />
      <!-- QR Pattern Elements -->
      <rect x="24" y="50" width="22" height="22" fill="#000000" />
      <rect x="28" y="54" width="14" height="14" fill="#FFFFFF" />
      <rect x="31" y="57" width="8" height="8" fill="#000000" />

      <rect x="72" y="50" width="22" height="22" fill="#000000" />
      <rect x="76" y="54" width="14" height="14" fill="#FFFFFF" />
      <rect x="79" y="57" width="8" height="8" fill="#000000" />

      <rect x="24" y="98" width="22" height="22" fill="#000000" />
      <rect x="28" y="102" width="14" height="14" fill="#FFFFFF" />
      <rect x="31" y="105" width="8" height="8" fill="#000000" />

      <!-- QR random data clusters -->
      <rect x="52" y="52" width="8" height="8" fill="#000000" />
      <rect x="58" y="66" width="10" height="10" fill="#000000" />
      <rect x="50" y="80" width="18" height="18" fill="#000000" />
      <rect x="74" y="80" width="12" height="12" fill="#000000" />
      <rect x="54" y="104" width="14" height="14" fill="#000000" />
      <rect x="76" y="100" width="16" height="16" fill="#000000" />

      <!-- Bottom stand text -->
      <text x="59" y="140" font-family="sans-serif" font-size="8" font-weight="900" fill="#002f6c" text-anchor="middle">Escaneá</text>
      <text x="59" y="150" font-family="sans-serif" font-size="8" font-weight="900" fill="#002f6c" text-anchor="middle">y pagá</text>
    </g>

    <!-- Hand & Smartphone in Foreground (Held vertically, scanning) -->
    <g transform="translate(0, 32)">
      <!-- Smartphone Body -->
      <rect x="8" y="10" width="76" height="148" rx="12" fill="#111827" stroke="#374151" stroke-width="2" />
      <!-- Smartphone Screen -->
      <rect x="12" y="14" width="68" height="140" rx="8" fill="#FFFFFF" />

      <!-- Screen: Header with MP Logo -->
      <rect x="12" y="14" width="68" height="18" rx="6" fill="#009EE3" />
      <ellipse cx="22" cy="23" rx="6" ry="4" fill="#FFFFFF" />
      <text x="32" y="26" font-family="sans-serif" font-size="6" font-weight="bold" fill="#FFFFFF">mercado pago</text>

      <!-- Amount Header: $ 15.200 -->
      <text x="18" y="44" font-family="sans-serif" font-size="5" fill="#6B7280">PRECIO FINAL A PAGAR</text>
      <text x="18" y="55" font-family="sans-serif" font-size="10" font-weight="900" fill="#111827">$ 15.200</text>
      <!-- Green discount badge -->
      <rect x="56" y="46" width="20" height="9" rx="3" fill="#DCFCE7" />
      <text x="66" y="53" font-family="sans-serif" font-size="5.5" font-weight="bold" fill="#16A34A" text-anchor="middle">▼ 10%</text>

      <!-- Payment Method Card box -->
      <rect x="16" y="62" width="60" height="16" rx="3" fill="#1E293B" />
      <!-- Mastercard logo circles -->
      <circle cx="23" cy="70" r="3.5" fill="#EF4444" opacity="0.9" />
      <circle cx="27" cy="70" r="3.5" fill="#F59E0B" opacity="0.9" />
      <text x="34" y="72" font-family="sans-serif" font-size="5.5" fill="#FFFFFF">Crédito</text>

      <!-- Additional options on screen -->
      <rect x="16" y="82" width="60" height="8" rx="2" fill="#F3F4F6" />
      <rect x="16" y="93" width="60" height="8" rx="2" fill="#F3F4F6" />
      <rect x="16" y="104" width="60" height="8" rx="2" fill="#F3F4F6" />

      <!-- Bottom action bar with MP Blue circle -->
      <circle cx="24" cy="144" r="5" fill="#009EE3" />
      <rect x="34" y="141" width="38" height="6" rx="3" fill="#E5E7EB" />

      <!-- Human Hand holding phone on the right side with manicured nails -->
      <g transform="translate(58, 70)">
        <!-- Thumb and fingers holding the phone right edge -->
        <path d="M0,15 C8,10 18,12 24,18 C28,24 28,38 25,50 C22,65 24,80 28,95 L-5,95 Z" fill="#E2A679" />
        <!-- Fingernails -->
        <ellipse cx="6" cy="20" rx="3.5" ry="5.5" fill="#FCE7F3" stroke="#F472B6" stroke-width="0.5" />
        <ellipse cx="8" cy="40" rx="3.5" ry="5.5" fill="#FCE7F3" stroke="#F472B6" stroke-width="0.5" />
        <ellipse cx="9" cy="60" rx="3.5" ry="5.5" fill="#FCE7F3" stroke="#F472B6" stroke-width="0.5" />
      </g>
    </g>
  </g>
</svg>
`;

// 3. Pago Combinado SVG (5:1 ratio, 1000x200) matching user uploaded "Pago Combinado.png"
const svgCombinado = `
<svg width="1000" height="200" viewBox="0 0 1000 200" xmlns="http://www.w3.org/2000/svg">
  <!-- Deep black background across entire canvas -->
  <rect width="1000" height="200" fill="#000000" />

  <!-- Right Side: Yellow Point Terminal with $500.00 screen + Argentine Cash Banknotes ($1000, $200) -->
  <g transform="translate(850, 10)">
    <!-- Yellow Terminal in background standing upright -->
    <g transform="translate(20, 0)">
      <!-- Main yellow casing -->
      <rect x="0" y="20" width="85" height="155" rx="12" fill="#FFE600" stroke="#E6CE00" stroke-width="2" />
      <!-- White Paper Receipt on top -->
      <rect x="10" y="2" width="65" height="24" rx="2" fill="#FFFFFF" stroke="#E5E7EB" stroke-width="1" />
      <ellipse cx="42" cy="10" rx="10" ry="4" fill="#E5E7EB" />
      <line x1="16" y1="16" x2="68" y2="16" stroke="#9CA3AF" stroke-width="1" stroke-dasharray="2,2" />
      <rect x="16" y="18" width="52" height="6" fill="#F3F4F6" />
      <text x="42" y="23" font-family="sans-serif" font-size="5" font-weight="bold" fill="#374151" text-anchor="middle">Total $500.00</text>

      <!-- Terminal Screen -->
      <rect x="8" y="36" width="69" height="128" rx="6" fill="#FFFFFF" stroke="#D1D5DB" stroke-width="1" />
      <line x1="8" y1="46" x2="77" y2="46" stroke="#FFE600" stroke-width="3" />
      <text x="14" y="54" font-family="sans-serif" font-size="5" fill="#6B7280">Importe</text>
      <!-- Terminal screen amount: $ 500,00 -->
      <text x="42" y="68" font-family="sans-serif" font-size="11" font-weight="900" fill="#1F2937" text-anchor="middle">$ 500,00</text>
      <!-- Keypad lines/grid -->
      <line x1="12" y1="78" x2="73" y2="78" stroke="#E5E7EB" stroke-width="1" />
      <text x="22" y="92" font-family="sans-serif" font-size="7" fill="#6B7280">1</text>
      <text x="42" y="92" font-family="sans-serif" font-size="7" fill="#6B7280">2</text>
      <text x="62" y="92" font-family="sans-serif" font-size="7" fill="#6B7280">3</text>
      <text x="22" y="106" font-family="sans-serif" font-size="7" fill="#6B7280">4</text>
      <text x="42" y="106" font-family="sans-serif" font-size="7" fill="#6B7280">5</text>
      <text x="62" y="106" font-family="sans-serif" font-size="7" fill="#6B7280">6</text>
    </g>

    <!-- Cash Banknotes ($1000 orange, $200 blue) fanning across bottom right -->
    <g transform="translate(-40, 60)">
      <!-- Blue $200 Bill (bottom angled) -->
      <g transform="rotate(-36, 120, 100)">
        <rect x="0" y="0" width="120" height="65" rx="3" fill="#BFDBFE" stroke="#60A5FA" stroke-width="1.5" />
        <rect x="8" y="8" width="35" height="48" rx="2" fill="#DBEAFE" />
        <text x="100" y="30" font-family="sans-serif" font-weight="900" font-size="18" fill="#1E40AF" text-anchor="end">200</text>
      </g>

      <!-- Light Blue $200 Bill (middle angled) -->
      <g transform="rotate(-25, 120, 100)">
        <rect x="10" y="10" width="120" height="65" rx="3" fill="#BAE6FD" stroke="#38BDF8" stroke-width="1.5" />
        <text x="110" y="38" font-family="sans-serif" font-weight="900" font-size="18" fill="#0369A1" text-anchor="end">200</text>
      </g>

      <!-- Orange $1000 Bill (top angled) -->
      <g transform="rotate(-12, 120, 100)">
        <rect x="20" y="20" width="130" height="70" rx="3" fill="#FED7AA" stroke="#FB923C" stroke-width="1.5" />
        <circle cx="50" cy="55" r="12" fill="#FDBA74" />
        <text x="135" y="52" font-family="sans-serif" font-weight="900" font-size="22" fill="#C2410C" text-anchor="end">1000</text>
        <text x="135" y="66" font-family="sans-serif" font-size="7" font-weight="bold" fill="#EA580C" text-anchor="end">REPÚBLICA</text>
      </g>

      <!-- Hand holding cash from bottom -->
      <g transform="translate(120, 85)">
        <path d="M0,45 C15,35 45,30 65,40 C75,45 80,65 80,85 L0,85 Z" fill="#E2A679" />
        <ellipse cx="25" cy="40" rx="14" ry="10" fill="#D49567" />
      </g>
    </g>
  </g>
</svg>
`;

// 4. Pago Efectivo SVG (5:1 ratio, 1000x200) matching user uploaded "Pago efectivo.png"
const svgEfectivo = `
<svg width="1000" height="200" viewBox="0 0 1000 200" xmlns="http://www.w3.org/2000/svg">
  <!-- Deep black background -->
  <rect width="1000" height="200" fill="#000000" />

  <!-- Left Light Green / Mint Branding Block with Slanted Edge -->
  <polygon points="0,0 205,0 180,200 0,200" fill="#4ADE80" />

  <!-- Efectivo Branding on Green Side -->
  <g transform="translate(35, 38)">
    <!-- Dollar in Circle Icon -->
    <circle cx="55" cy="40" r="34" fill="none" stroke="#002f6c" stroke-width="6.5" />
    <text x="55" y="52" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="38" fill="#002f6c" text-anchor="middle">$</text>
    
    <!-- Text: efectivo -->
    <text x="55" y="104" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-weight="900" font-size="25" fill="#002f6c" text-anchor="middle" letter-spacing="-0.5">efectivo</text>
  </g>

  <!-- Right Side: Argentine Cash Banknotes ($1000 orange, $200 blue, etc.) fan with hand holding -->
  <g transform="translate(800, 40)">
    <!-- Blue $200 Bill (bottom angled) -->
    <g transform="rotate(-38, 140, 120)">
      <rect x="0" y="0" width="130" height="70" rx="3" fill="#BFDBFE" stroke="#60A5FA" stroke-width="1.5" />
      <!-- Bill watermark & details -->
      <rect x="10" y="10" width="40" height="50" rx="2" fill="#DBEAFE" />
      <text x="110" y="32" font-family="sans-serif" font-weight="900" font-size="20" fill="#1E40AF" text-anchor="end">200</text>
      <text x="110" y="48" font-family="sans-serif" font-size="7" font-weight="bold" fill="#3B82F6" text-anchor="end">BANCO CENTRAL</text>
      <circle cx="95" cy="55" r="8" fill="#93C5FD" />
    </g>

    <!-- Light Blue/Cyan $200 Bill (middle angled) -->
    <g transform="rotate(-28, 140, 120)">
      <rect x="15" y="10" width="130" height="70" rx="3" fill="#BAE6FD" stroke="#38BDF8" stroke-width="1.5" />
      <rect x="25" y="20" width="40" height="50" rx="2" fill="#E0F2FE" />
      <text x="125" y="42" font-family="sans-serif" font-weight="900" font-size="20" fill="#0369A1" text-anchor="end">200</text>
      <text x="125" y="58" font-family="sans-serif" font-size="7" font-weight="bold" fill="#0284C7" text-anchor="end">REPÚBLICA</text>
      <circle cx="110" cy="65" r="8" fill="#7DD3FC" />
    </g>

    <!-- Orange $1000 Hornero Bill (top foreground angled) -->
    <g transform="rotate(-15, 140, 120)">
      <rect x="30" y="20" width="140" height="75" rx="3" fill="#FED7AA" stroke="#FB923C" stroke-width="1.5" />
      <!-- Bill details & Hornero nest silhouette -->
      <rect x="40" y="30" width="45" height="55" rx="2" fill="#FFEDD5" />
      <circle cx="62" cy="58" r="14" fill="#FDBA74" />
      <text x="150" y="54" font-family="sans-serif" font-weight="900" font-size="24" fill="#C2410C" text-anchor="end">1000</text>
      <text x="150" y="70" font-family="sans-serif" font-size="8" font-weight="bold" fill="#EA580C" text-anchor="end">REPÚBLICA</text>
      <text x="150" y="80" font-family="sans-serif" font-size="6" fill="#9A3412" text-anchor="end">EN UNIÓN Y LIBERTAD</text>
    </g>

    <!-- Hand holding the cash bills from bottom right -->
    <g transform="translate(140, 95)">
      <path d="M0,45 C15,35 45,30 65,40 C75,45 80,65 80,85 L0,85 Z" fill="#E2A679" />
      <ellipse cx="25" cy="40" rx="14" ry="10" fill="#D49567" />
    </g>
  </g>
</svg>
`;

async function generateAssets() {
  console.log('Generating high-resolution payment mode assets...');

  // Save SVGs
  fs.writeFileSync(path.join(outDir, 'pago-qr-point.svg'), svgQrPoint.trim());
  fs.writeFileSync(path.join(outDir, 'pago-qr-fisico.svg'), svgQrFisico.trim());
  fs.writeFileSync(path.join(outDir, 'pago-combinado.svg'), svgCombinado.trim());
  fs.writeFileSync(path.join(outDir, 'pago-efectivo.svg'), svgEfectivo.trim());

  // Render Crisp PNGs (1000x200)
  await sharp(Buffer.from(svgQrPoint))
    .png({ quality: 100 })
    .toFile(path.join(outDir, 'pago-qr-point.png'));

  await sharp(Buffer.from(svgQrFisico))
    .png({ quality: 100 })
    .toFile(path.join(outDir, 'pago-qr-fisico.png'));

  await sharp(Buffer.from(svgCombinado))
    .png({ quality: 100 })
    .toFile(path.join(outDir, 'pago-combinado.png'));

  await sharp(Buffer.from(svgEfectivo))
    .png({ quality: 100 })
    .toFile(path.join(outDir, 'pago-efectivo.png'));

  // Also support original names with spaces if referenced directly
  fs.copyFileSync(path.join(outDir, 'pago-qr-point.png'), path.join(outDir, 'Pago QR Point.png'));
  fs.copyFileSync(path.join(outDir, 'pago-qr-fisico.png'), path.join(outDir, 'Pago QR Físico.png'));
  fs.copyFileSync(path.join(outDir, 'pago-combinado.png'), path.join(outDir, 'Pago Combinado.png'));
  fs.copyFileSync(path.join(outDir, 'pago-efectivo.png'), path.join(outDir, 'Pago efectivo.png'));
  fs.copyFileSync(path.join(outDir, 'pago-efectivo.png'), path.join(outDir, 'Pago Efectivo.png'));

  console.log('Successfully generated assets in public/assets/payment-modes/');
}

generateAssets().catch((err) => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
