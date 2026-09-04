import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

function getEnv(name: string, defaultValue: string = ''): string {
  const val = process.env[name];
  if (typeof val === 'string') {
    return val.trim();
  }
  return defaultValue.trim();
}

export function getR2Client(): S3Client {
  const rawAccountId = getEnv('CLOUDFLARE_R2_ACCOUNT_ID');
  const accessKeyId = getEnv('CLOUDFLARE_R2_ACCESS_KEY_ID');
  const secretAccessKey = getEnv('CLOUDFLARE_R2_SECRET_ACCESS_KEY');
  const customEndpoint = getEnv('CLOUDFLARE_R2_ENDPOINT');

  // Sanitizar accountId en caso de que se haya pegado la URL completa
  const accountId = rawAccountId
    .replace(/^https?:\/\//i, '')
    .replace(/\.r2\.cloudflarestorage\.com.*$/i, '')
    .trim();

  if (!accountId && !customEndpoint) {
    throw new Error('Falta CLOUDFLARE_R2_ACCOUNT_ID en las variables de entorno.');
  }

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Faltan credenciales CLOUDFLARE_R2_ACCESS_KEY_ID o CLOUDFLARE_R2_SECRET_ACCESS_KEY.');
  }

  const endpoint = customEndpoint
    ? (customEndpoint.startsWith('http') ? customEndpoint : `https://${customEndpoint}`)
    : `https://${accountId}.r2.cloudflarestorage.com`;

  return new S3Client({
    region: 'auto',
    endpoint: endpoint.replace(/\/+$/, ''),
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export const R2_BUCKET_NAME = getEnv('CLOUDFLARE_R2_BUCKET_NAME', 'amex-courier-cloud');
export const R2_PUBLIC_DOMAIN = getEnv('CLOUDFLARE_R2_PUBLIC_DOMAIN', 'https://pub-dcb2789e802043768fa5c6c649f9c405.r2.dev').replace(/\/+$/, '');
export const R2_ROOT_FOLDER = getEnv('CLOUDFLARE_R2_ROOT_FOLDER', 'FOLDER AMEX');

/**
 * Convierte cualquier URL o Key de Cloudflare R2 a una URL de streaming autorizada del servidor
 * Permite que todas las imágenes y documentos carguen sin errores 401/403 de permisos.
 */
export function getR2ViewUrl(urlOrKey: string | null | undefined): string {
  if (!urlOrKey) return '';
  const str = String(urlOrKey).trim();
  
  // Si es un Blob o Data URL local, mantener tal cual
  if (str.startsWith('data:') || str.startsWith('blob:')) {
    return str;
  }

  // Si ya es una ruta de nuestro proxy
  if (str.startsWith('/api/storage/file') || str.startsWith('/api/storage/upload')) {
    return str;
  }

  // Si es una URL de R2 (r2.dev, cloudflarestorage o pub-)
  if (str.includes('.r2.dev/') || str.includes('.cloudflarestorage.com/') || str.includes('pub-')) {
    try {
      const parsed = new URL(str);
      const pathKey = decodeURIComponent(parsed.pathname.replace(/^\/+/, ''));
      return `/api/storage/file?key=${encodeURIComponent(pathKey)}`;
    } catch {
      const match = str.match(/https?:\/\/[^\/]+\/(.+)$/);
      if (match) {
        const pathKey = decodeURIComponent(match[1]);
        return `/api/storage/file?key=${encodeURIComponent(pathKey)}`;
      }
    }
  }

  // Si no empieza con http:// ni https://, asumimos que es una clave interna de R2
  if (!str.startsWith('http://') && !str.startsWith('https://')) {
    return `/api/storage/file?key=${encodeURIComponent(str)}`;
  }

  return str;
}

/**
 * Subir archivo a Cloudflare R2 dentro del directorio raíz 'FOLDER AMEX'
 */
export async function uploadFileToR2(
  fileBuffer: Buffer,
  subPath: string,
  contentType: string
): Promise<{ url: string; publicUrl: string; key: string }> {
  // Asegura que todos los archivos se guarden dentro de 'FOLDER AMEX/'
  const cleanSubPath = subPath.replace(/^\/+/, '');
  const key = `${R2_ROOT_FOLDER}/${cleanSubPath}`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
    Body: fileBuffer,
    ContentType: contentType,
  });

  const client = getR2Client();
  await client.send(command);

  // URL del servidor proxy (100% garantizada contra permisos 401/403)
  const url = `/api/storage/file?key=${encodeURIComponent(key)}`;

  // Codificar URI para enlace público directo si se habilita en Cloudflare Dashboard
  const encodedKey = key.split('/').map(segment => encodeURIComponent(segment)).join('/');
  const publicUrl = `${R2_PUBLIC_DOMAIN}/${encodedKey}`;

  return { url, publicUrl, key };
}

/**
 * Obtener archivo de Cloudflare R2
 */
export async function getFileFromR2(key: string) {
  const client = getR2Client();
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: key,
  });
  return await client.send(command);
}
