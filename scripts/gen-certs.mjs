import fs from 'fs';
import path from 'path';
import selfsigned from 'selfsigned';

const certDir = path.join(process.cwd(), 'certificates');
if (!fs.existsSync(certDir)) {
  fs.mkdirSync(certDir, { recursive: true });
}

const keyPath = path.join(certDir, 'localhost-key.pem');
const certPath = path.join(certDir, 'localhost.pem');

async function run() {
  console.log('Generando certificados SSL locales para HTTPS en celular...');
  const attrs = [{ name: 'commonName', value: '192.168.1.126' }];
  const pems = await selfsigned.generate(attrs, {
    days: 365,
    keySize: 2048,
    algorithm: 'sha256',
    extensions: [
      {
        name: 'basicConstraints',
        cA: true
      },
      {
        name: 'keyUsage',
        keyCertSign: true,
        digitalSignature: true,
        keyEncipherment: true
      },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: 'localhost' },
          { type: 7, ip: '127.0.0.1' },
          { type: 7, ip: '192.168.1.126' },
          { type: 7, ip: '0.0.0.0' }
        ]
      }
    ]
  });

  fs.writeFileSync(keyPath, pems.private);
  fs.writeFileSync(certPath, pems.cert);
  console.log('✅ Certificados SSL generados exitosamente en ./certificates/');
}

run();
