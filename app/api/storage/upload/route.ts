import { NextRequest, NextResponse } from 'next/server';
import { uploadFileToR2 } from '@/lib/r2/client';
import { getSessionUser } from '@/lib/auth/session';
import {
  buildEntregaPath,
  buildInvoicePath,
  buildDniPath,
  buildManifiestoPath,
  getDateSegments,
  sanitizeFileName
} from '@/lib/r2/datePartitionedUpload';

const ALLOWED_FOLDERS = new Set([
  'entregas',
  'expedientes',
  'facturas',
  'facturas-invoices',
  'dnis',
  'documentos-dni',
  'manifiestos',
  'manifiestos-despacho',
  'fotos',
  'documentos'
]);

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'No autorizado. Inicia sesión.' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const folder = ((formData.get('folder') as string) || 'entregas').toLowerCase().replace(/^\/+|\/+$/g, '');

    // Parámetros contextuales opcionales para nomenclatura amigable
    const codigoEntrega = (formData.get('codigoEntrega') as string) || '';
    const clienteNombre = (formData.get('clienteNombre') as string) || '';
    const receptorNombre = (formData.get('receptorNombre') as string) || '';
    const wrNumero = (formData.get('wrNumero') as string) || '';
    const casillero = (formData.get('casillero') as string) || '';
    const tienda = (formData.get('tienda') as string) || '';
    const tipoDni = (formData.get('tipoDni') as 'ANVERSO' | 'REVERSO' | 'COMPLETO') || 'ANVERSO';

    if (!file) {
      return NextResponse.json({ error: 'No se envió ningún archivo.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'El archivo supera el límite permitido de 25 MB.' }, { status: 400 });
    }

    if (!ALLOWED_FOLDERS.has(folder)) {
      return NextResponse.json({ error: 'Carpeta de destino no permitida.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let subPath = '';

    // Generar ruta inteligente según el módulo
    if (folder === 'entregas' || folder === 'expedientes' || folder === 'fotos') {
      const clienteOReceptor = receptorNombre || clienteNombre || 'CLIENTE';
      subPath = buildEntregaPath(codigoEntrega, clienteOReceptor, file.name);
    } else if (folder === 'facturas' || folder === 'facturas-invoices') {
      subPath = buildInvoicePath(wrNumero, clienteNombre, tienda, file.name);
    } else if (folder === 'dnis' || folder === 'documentos-dni') {
      const ext = file.name.split('.').pop() || 'jpg';
      subPath = buildDniPath(casillero, clienteNombre, tipoDni, ext);
    } else if (folder === 'manifiestos' || folder === 'manifiestos-despacho') {
      const ext = file.name.split('.').pop() || 'pdf';
      subPath = buildManifiestoPath('CARRO_AMEX', codigoEntrega || 'RUTA', ext);
    } else {
      const { year, month, day } = getDateSegments();
      const cleanName = sanitizeFileName(file.name.split('.')[0]) + '.' + (file.name.split('.').pop() || 'bin');
      subPath = `documentos/${year}/${month}/${day}/${cleanName}`;
    }

    const { url, key } = await uploadFileToR2(buffer, subPath, file.type || 'application/octet-stream');

    return NextResponse.json({
      success: true,
      url,
      key,
      path: subPath,
      fileName: file.name,
      sizeBytes: file.size
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error al subir archivo a Cloudflare R2';
    console.error('[R2 Upload Error]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
