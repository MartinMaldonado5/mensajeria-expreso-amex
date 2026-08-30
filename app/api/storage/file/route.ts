import { NextRequest, NextResponse } from 'next/server';
import { getR2Client, R2_BUCKET_NAME, R2_ROOT_FOLDER } from '@/lib/r2/client';
import { GetObjectCommand } from '@aws-sdk/client-s3';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    let key = searchParams.get('key');
    const download = searchParams.get('download') === 'true';

    if (!key) {
      return NextResponse.json({ error: 'Falta el parámetro "key".' }, { status: 400 });
    }

    // Limpiar y decodificar key
    key = decodeURIComponent(key).trim().replace(/^\/+/, '');

    const client = getR2Client();

    let response;
    let finalKey = key;

    try {
      response = await client.send(
        new GetObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: finalKey,
        })
      );
    } catch (firstErr: unknown) {
      // Si falló y la clave no tenía R2_ROOT_FOLDER, intentar anteponer R2_ROOT_FOLDER
      if (!key.startsWith(R2_ROOT_FOLDER)) {
        finalKey = `${R2_ROOT_FOLDER}/${key}`;
        try {
          response = await client.send(
            new GetObjectCommand({
              Bucket: R2_BUCKET_NAME,
              Key: finalKey,
            })
          );
        } catch {
          throw firstErr;
        }
      } else {
        throw firstErr;
      }
    }

    if (!response || !response.Body) {
      return NextResponse.json({ error: 'Archivo no encontrado en R2.' }, { status: 404 });
    }

    // Convertir el stream de AWS SDK a Web ReadableStream
    const byteArray = await response.Body.transformToByteArray();
    const contentType = response.ContentType || 'application/octet-stream';
    const fileName = finalKey.split('/').pop() || 'archivo';

    const headers = new Headers();
    headers.set('Content-Type', contentType);
    if (response.ContentLength) {
      headers.set('Content-Length', String(response.ContentLength));
    }
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    headers.set(
      'Content-Disposition',
      download
        ? `attachment; filename="${encodeURIComponent(fileName)}"`
        : `inline; filename="${encodeURIComponent(fileName)}"`
    );
    headers.set('Accept-Ranges', 'bytes');

    return new NextResponse(Buffer.from(byteArray), {
      status: 200,
      headers,
    });
  } catch (err: unknown) {
    const errorObj = err as { name?: string; message?: string; $metadata?: { httpStatusCode?: number } };
    console.error('[R2 File Serve Error]', err);
    if (errorObj?.name === 'NoSuchKey' || errorObj?.$metadata?.httpStatusCode === 404) {
      return NextResponse.json({ error: 'Archivo no encontrado en Cloudflare R2.' }, { status: 404 });
    }
    return NextResponse.json(
      { error: errorObj?.message || 'Error al recuperar archivo desde Cloudflare R2.' },
      { status: 500 }
    );
  }
}
