import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

// Cargar .env.local manualmente sin dependencias extra
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
  console.log('No se pudo leer .env.local:', e.message);
}

console.log('==================================================');
console.log('🧪 INICIANDO DIAGNÓSTICO DE SERVICIOS Y ENTORNO');
console.log('==================================================\n');

async function testSupabase() {
  console.log('▶ [1/3] Probando conexión a Supabase...');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.log('❌ Supabase: Faltan variables NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY');
    return false;
  }

  try {
    const supabase = createClient(url, key);
    const { data, error } = await supabase.from('almacenes_sedes').select('id, nombre').limit(5);
    if (error) {
      console.log(`⚠️ Supabase conectado, pero consulta a 'almacenes_sedes' retornó: ${error.message}`);
      const { data: pkgData, error: pkgError } = await supabase.from('paquetes').select('id').limit(1);
      if (pkgError) {
        console.log(`⚠️ Consulta a 'paquetes' retornó: ${pkgError.message}`);
        return false;
      } else {
        console.log('✅ Supabase conectado exitosamente (Tabla paquetes accesible).');
        return true;
      }
    } else {
      console.log(`✅ Supabase conectado exitosamente. (${data?.length || 0} sedes encontradas en almacenes_sedes)`);
      return true;
    }
  } catch (err) {
    console.log(`❌ Error al conectar con Supabase:`, err.message);
    return false;
  }
}

async function testCloudflareR2() {
  console.log('\n▶ [2/3] Probando Cloudflare R2 Storage...');
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'amex-courier-cloud';
  const rootFolder = process.env.CLOUDFLARE_R2_ROOT_FOLDER || 'FOLDER AMEX';
  const publicDomain = process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    console.log('❌ Cloudflare R2: Faltan credenciales en .env.local');
    return false;
  }

  try {
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const testFileName = `test-healthcheck-${Date.now()}.txt`;
    const testKey = `${rootFolder}/${testFileName}`;
    const testContent = Buffer.from('Healthcheck test from Amex Courier ERP');

    console.log(`  Subiendo archivo de prueba: "${testKey}" al bucket "${bucketName}"...`);
    await client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain',
    }));
    console.log(`  ✅ Archivo subido exitosamente a R2.`);

    // Eliminar archivo de prueba
    await client.send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: testKey,
    }));
    console.log(`  ✅ Archivo de prueba eliminado correctamente de R2.`);
    console.log(`  🔗 Dominio público configurado: ${publicDomain}`);
    return true;
  } catch (err) {
    console.log(`❌ Error al comunicarse con Cloudflare R2:`, err.message);
    return false;
  }
}

async function testGemini() {
  console.log('\n▶ [3/3] Probando Google Gemini AI...');
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.log('⚠️ Google Gemini AI: Variable GEMINI_API_KEY no configurada o vacía.');
    return false;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: 'Di "OK" si estás funcionando.',
    });
    console.log(`✅ Google Gemini respondió: ${response.text?.trim()}`);
    return true;
  } catch (err) {
    console.log(`❌ Error al conectar con Google Gemini:`, err.message);
    return false;
  }
}

async function runAll() {
  const supabaseOk = await testSupabase();
  const r2Ok = await testCloudflareR2();
  const geminiOk = await testGemini();

  console.log('\n==================================================');
  console.log('📊 RESUMEN DE DIAGNÓSTICO:');
  console.log(`- Supabase DB:     ${supabaseOk ? '✅ OPERATIVO' : '❌ ERROR / REVISAR'}`);
  console.log(`- Cloudflare R2:   ${r2Ok ? '✅ OPERATIVO' : '❌ ERROR / REVISAR'}`);
  console.log(`- Google Gemini:   ${geminiOk ? '✅ OPERATIVO' : '⚠️ PENDIENTE API KEY'}`);
  console.log('==================================================\n');
}

runAll();
