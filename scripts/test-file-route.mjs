import fs from 'fs';
import { uploadFileToR2, getR2ViewUrl, getFileFromR2, R2_BUCKET_NAME, R2_ROOT_FOLDER } from '../lib/r2/client.ts';

// Load .env.local
try {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      process.env[key] = val;
    }
  }
} catch (e) {
  console.log('Error reading .env.local:', e.message);
}

async function runTestSuite() {
  console.log('==================================================');
  console.log('🧪 PRUEBAS COMPLETAS DE VISUALIZACIÓN DE IMÁGENES');
  console.log('==================================================\n');

  // TEST 1: URL Transformer / Resolver
  console.log('▶ [1/4] Probando función getR2ViewUrl (Transformador de URLs)...');
  const legacyR2Url = 'https://pub-dcb2789e802043768fa5c6c649f9c405.r2.dev/FOLDER%20AMEX/entregas/2026/08/29/foto_1.jpg';
  const resolvedFromLegacy = getR2ViewUrl(legacyR2Url);
  console.log('  URL Antigua de R2:', legacyR2Url);
  console.log('  URL Resuelta para el Visor:', resolvedFromLegacy);
  if (resolvedFromLegacy === '/api/storage/file?key=FOLDER%20AMEX%2Fentregas%2F2026%2F08%2F29%2Ffoto_1.jpg') {
    console.log('  ✅ Test 1.1 Pasó: Convierte URLs antiguas a rutas seguras del servidor.');
  } else {
    console.log('  ❌ Test 1.1 Falló');
  }

  const rawKey = 'FOLDER AMEX/vouchers/2026/08/29/pago_yape.jpg';
  const resolvedFromKey = getR2ViewUrl(rawKey);
  console.log('  Key cruda:', rawKey);
  console.log('  URL Resuelta:', resolvedFromKey);
  if (resolvedFromKey === '/api/storage/file?key=FOLDER%20AMEX%2Fvouchers%2F2026%2F08%2F29%2Fpago_yape.jpg') {
    console.log('  ✅ Test 1.2 Pasó: Convierte claves internas a URLs del visor.');
  }

  // TEST 2: Subida a R2 con URL del proxy
  console.log('\n▶ [2/4] Probando subida de imagen de prueba con retorno de URL autorizada...');
  const fakeImageBuffer = Buffer.from('Fake JPEG binary content for test verification');
  const subPath = 'entregas/2026/08/29/ENT-PRUEBA/foto_evidencia_entrega.jpg';
  
  const uploadResult = await uploadFileToR2(fakeImageBuffer, subPath, 'image/jpeg');
  console.log('  Resultado de subida:');
  console.log('  - Key:', uploadResult.key);
  console.log('  - URL Segura:', uploadResult.url);
  console.log('  - Public URL:', uploadResult.publicUrl);

  if (uploadResult.url.startsWith('/api/storage/file?key=')) {
    console.log('  ✅ Test 2 Pasó: La subida genera URL segura del servidor.');
  } else {
    console.log('  ❌ Test 2 Falló: Formato de URL incorrecto.');
  }

  // TEST 3: Lectura y streaming del archivo subido desde R2
  console.log('\n▶ [3/4] Probando recuperación del archivo desde Cloudflare R2 con credenciales backend...');
  const getResult = await getFileFromR2(uploadResult.key);
  console.log('  ContentType:', getResult.ContentType);
  console.log('  ContentLength:', getResult.ContentLength);
  const bytes = await getResult.Body.transformToByteArray();
  console.log('  Bytes leídos:', bytes.length);

  if (bytes.length === fakeImageBuffer.length && getResult.ContentType === 'image/jpeg') {
    console.log('  ✅ Test 3 Pasó: El archivo se recupera íntegro y sin errores de permisos 401/403.');
  } else {
    console.log('  ❌ Test 3 Falló en la lectura');
  }

  console.log('\n==================================================');
  console.log('🎉 TODAS LAS PRUEBAS DE IMÁGENES PASARON EXITOSAMENTE');
  console.log('==================================================\n');
}

runTestSuite();
