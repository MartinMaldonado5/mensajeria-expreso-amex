import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
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

const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'amex-courier-cloud';
const rootFolder = process.env.CLOUDFLARE_R2_ROOT_FOLDER || 'FOLDER AMEX';

console.log('Testing R2 Config:');
console.log('accountId:', accountId);
console.log('accessKeyId:', accessKeyId);
console.log('secretAccessKey:', secretAccessKey ? `${secretAccessKey.slice(0, 4)}...${secretAccessKey.slice(-4)}` : 'missing');
console.log('bucketName:', bucketName);
console.log('rootFolder:', rootFolder);

const client = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

async function runUploadTest() {
  try {
    // Test 1: Simple file
    const key1 = `${rootFolder}/test_image_1.jpg`;
    console.log(`\nTest 1: Uploading to ${key1}...`);
    await client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: key1,
      Body: Buffer.from('Fake JPG binary data 12345'),
      ContentType: 'image/jpeg',
    }));
    console.log('✅ Test 1 Passed');

    // Test 2: Path with spaces and subfolders (e.g. entrega photo path)
    const key2 = `${rootFolder}/entregas/2026/08/28/ENT-20260828-001/foto_entrega_1.jpg`;
    console.log(`\nTest 2: Uploading to ${key2}...`);
    await client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: key2,
      Body: Buffer.from('Fake JPG binary data 12345'),
      ContentType: 'image/jpeg',
    }));
    console.log('✅ Test 2 Passed');

    // Test 3: Path with special characters or Spanish accents (e.g. Pérez)
    const key3 = `${rootFolder}/entregas/2026/08/28/ENT-20260828-001/foto_Juan_Perez.jpg`;
    console.log(`\nTest 3: Uploading to ${key3}...`);
    await client.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: key3,
      Body: Buffer.from('Fake JPG binary data 12345'),
      ContentType: 'image/jpeg',
    }));
    console.log('✅ Test 3 Passed');

  } catch (err) {
    console.error('❌ Upload Error:', err);
  }
}

runUploadTest();
