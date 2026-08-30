import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Faltan credenciales de Supabase en .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const TABLES = [
  'almacenes_sedes',
  'paquetes',
  'ordenes_picking',
  'items_picking',
  'historial_trazabilidad',
  'movimientos_kardex',
  'escaneos_log',
  'estanterias_posiciones',
  'entregas_ordenes'
];

async function checkTables() {
  console.log('=== VERIFICACIÓN DETALLADA DE TABLAS EN SUPABASE ===\n');
  for (const table of TABLES) {
    try {
      const { data, count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.log(`❌ Tabla "${table}": ERROR (${error.message})`);
      } else {
        console.log(`✅ Tabla "${table}": OK (Total registros: ${count ?? 0})`);
      }
    } catch (err) {
      console.log(`❌ Tabla "${table}": EXCEPCIÓN (${err.message})`);
    }
  }
}

checkTables();
