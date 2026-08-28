import fs from 'fs';
import { uploadFileToR2 } from '../lib/r2/client.ts';

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

async function testLibUpload() {
  console.log('=== TEST DIRECTO A lib/r2/client.ts ===');
  console.log('CLOUDFLARE_R2_ACCOUNT_ID:', process.env.CLOUDFLARE_R2_ACCOUNT_ID);
  console.log('CLOUDFLARE_R2_ACCESS_KEY_ID:', process.env.CLOUDFLARE_R2_ACCESS_KEY_ID);
  console.log('CLOUDFLARE_R2_SECRET_ACCESS_KEY (length):', process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.length);

  try {
    const buffer = Buffer.from('Test JPG Photo Binary Data from Antigravity');
    const subPath = 'entregas/2026/08/28/ENT-20260828-001/foto_prueba_local.jpg';
    console.log(`Subiendo a ${subPath}...`);
    const result = await uploadFileToR2(buffer, subPath, 'image/jpeg');
    console.log('✅ Subida exitosa:', result);
  } catch (err) {
    console.error('❌ Error:', err);
  }
}

testLibUpload();
