/**
 * AMEX Courier ERP - Cloudflare R2 Date-Partitioned & Human-Readable Upload Helper
 * Estructura y sanitiza las rutas de subida jerárquicas por Año/Mes/Día y Nombre de Cliente/WR.
 */

export function sanitizeFileName(name: string): string {
  if (!name) return 'DOCUMENTO';
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar tildes y diacríticos
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '_') // Reemplazar caracteres no alfanuméricos por guion bajo
    .replace(/_+/g, '_') // Quitar guiones bajos consecutivos
    .replace(/^_+|_+$/g, ''); // Quitar guiones al inicio o final
}

export function getDateSegments(date: Date = new Date()): { year: string; month: string; day: string } {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return { year, month, day };
}

/**
 * Genera la ruta jerárquica para un expediente de entrega:
 * FOLDER AMEX/entregas/YYYY/MM/DD/ENT-001_JUAN_PEREZ/foto_1.webp
 */
export function buildEntregaPath(
  codigoEntrega: string,
  clienteOReceptor: string,
  fileName: string,
  date: Date = new Date()
): string {
  const { year, month, day } = getDateSegments(date);
  const cleanCodigo = sanitizeFileName(codigoEntrega || 'ENT-001');
  const cleanReceptor = sanitizeFileName(clienteOReceptor || 'CLIENTE');
  const cleanFileName = sanitizeFileName(fileName.split('.')[0] || 'FOTO') + '.' + (fileName.split('.').pop() || 'webp').toLowerCase();

  const folderName = `${cleanCodigo}_${cleanReceptor}`;
  return `entregas/${year}/${month}/${day}/${folderName}/${cleanFileName}`;
}

/**
 * Genera la ruta para facturas de compra (Invoices):
 * FOLDER AMEX/facturas-invoices/YYYY/MM/DD/WR10452_JUAN_PEREZ_AMAZON.pdf
 */
export function buildInvoicePath(
  wrNumero: string,
  clienteNombre: string,
  tienda: string = 'COMPRA',
  fileName: string = 'factura.pdf',
  date: Date = new Date()
): string {
  const { year, month, day } = getDateSegments(date);
  const cleanWR = sanitizeFileName(wrNumero || 'WR');
  const cleanCliente = sanitizeFileName(clienteNombre || 'CLIENTE');
  const cleanTienda = sanitizeFileName(tienda || 'USA');
  const ext = (fileName.split('.').pop() || 'pdf').toLowerCase();

  return `facturas-invoices/${year}/${month}/${day}/${cleanWR}_${cleanCliente}_${cleanTienda}.${ext}`;
}

/**
 * Genera la ruta para copias de DNI de clientes:
 * FOLDER AMEX/documentos-dni/YYYY/MM/CAS4021_JUAN_PEREZ_DNI_ANVERSO.jpg
 */
export function buildDniPath(
  casillero: string,
  clienteNombre: string,
  tipo: 'ANVERSO' | 'REVERSO' | 'COMPLETO' = 'ANVERSO',
  ext: string = 'jpg',
  date: Date = new Date()
): string {
  const { year, month } = getDateSegments(date);
  const cleanCasillero = sanitizeFileName(casillero || 'CAS-000');
  const cleanCliente = sanitizeFileName(clienteNombre || 'CLIENTE');

  return `documentos-dni/${year}/${month}/${cleanCasillero}_${cleanCliente}_DNI_${tipo}.${ext.toLowerCase()}`;
}

/**
 * Genera la ruta para manifiestos de despacho y hojas de ruta:
 * FOLDER AMEX/manifiestos-despacho/YYYY/MM/DD/MANIFIESTO_CARRO_AMEX_20260825.pdf
 */
export function buildManifiestoPath(
  tipoRuta: string,
  identificador: string,
  ext: string = 'pdf',
  date: Date = new Date()
): string {
  const { year, month, day } = getDateSegments(date);
  const cleanRuta = sanitizeFileName(tipoRuta || 'CARRO_AMEX');
  const cleanId = sanitizeFileName(identificador || 'RUTA');

  return `manifiestos-despacho/${year}/${month}/${day}/MANIFIESTO_${cleanRuta}_${cleanId}.${ext.toLowerCase()}`;
}

/**
 * Genera la ruta para vouchers y comprobantes de pago (WhatsApp / Yape / BCP / Plin):
 * FOLDER AMEX/vouchers-pagos/YYYY/MM/DD/VOU-001_JUAN_PEREZ_YAPE.webp
 */
export function buildVoucherPath(
  codigoCobro: string,
  clienteNombre: string,
  metodoPago: string = 'YAPE',
  ext: string = 'webp',
  date: Date = new Date()
): string {
  const { year, month, day } = getDateSegments(date);
  const cleanCodigo = sanitizeFileName(codigoCobro || 'VOU-001');
  const cleanCliente = sanitizeFileName(clienteNombre || 'CLIENTE');
  const cleanMetodo = sanitizeFileName(metodoPago || 'PAGO');

  return `vouchers-pagos/${year}/${month}/${day}/${cleanCodigo}_${cleanCliente}_${cleanMetodo}.${ext.toLowerCase()}`;
}

