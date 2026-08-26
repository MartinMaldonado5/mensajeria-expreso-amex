import { NextRequest, NextResponse } from 'next/server';
import { analyzeInvoiceDocument } from '@/lib/gemini/analyzer';
import { getSessionUser } from '@/lib/auth/session';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Debes enviar una imagen o PDF de factura.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'El archivo supera el límite de 10 MB.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const result = await analyzeInvoiceDocument(base64, file.type);

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error analizando factura con IA';
    console.error('[Gemini AI Route Error]', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
