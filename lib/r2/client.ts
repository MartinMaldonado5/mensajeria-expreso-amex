import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

function getEnv(name: string, defaultValue: string = ''): string {
  return process.env[name] || defaultValue;
}

export function getR2Client(): S3Client {
  const accountId = getEnv('CLOUDFLARE_R2_ACCOUNT_ID');
  const accessKeyId = getEnv('CLOUDFLARE_R2_ACCESS_KEY_ID');
  const secretAccessKey = getEnv('CLOUDFLARE_R2_SECRET_ACCESS_KEY');

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Faltan credenciales de Cloudflare R2 en .env.local');
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export const R2_BUCKET_NAME = getEnv('CLOUDFLARE_R2_BUCKET_NAME', 'amex-courier-cloud');
export const R2_PUBLIC_DOMAIN = getEnv('CLOUDFLARE_R2_PUBLIC_DOMAIN', 'https://pub-dcb2789e802043768fa5c6c649f9c405.r2.dev');
export const R2_ROOT_FOLDER = getEnv('CLOUDFLARE_R2_ROOT_FOLDER', 'FOLDER AMEX');

/**
 * Subir archivo a Cloudflare R2 dentro del directorio raíz 'FOLDER AMEX'
 */
export async function uploadFileToR2(
  fileBuffer: Buffer,
  subPath: string,
  contentType: string
): Promise<{ url: string; key: string }> {
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

  // Codificar URI para evitar problemas con espacios en 'FOLDER AMEX'
  const encodedKey = key.split('/').map(segment => encodeURIComponent(segment)).join('/');
  const url = `${R2_PUBLIC_DOMAIN}/${encodedKey}`;

  return { url, key };
}
