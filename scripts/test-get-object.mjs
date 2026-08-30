import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
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
  console.log('Error reading .env.local:', e.message);
}

const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'amex-courier-cloud';

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

async function testGet() {
  const key = 'FOLDER AMEX/test_image_1.jpg';
  try {
    console.log(`Getting object "${key}" from bucket "${bucketName}"...`);
    const res = await client.send(new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    }));
    console.log('Status: 200 OK');
    console.log('ContentType:', res.ContentType);
    console.log('ContentLength:', res.ContentLength);
    const bytes = await res.Body.transformToByteArray();
    console.log('Read bytes successfully! Length:', bytes.length);
  } catch (err) {
    console.error('Error getting object:', err);
  }
}

testGet();
