import * as XLSX from 'xlsx';
import { Paquete, MovimientoKardex, Cliente, OrdenPicking, ItemPicking } from '@/types';

/**
 * Utilidad genérica para exportar cualquier arreglo de objetos a un archivo Excel (.xlsx) profesional
 * con auto-ajuste de ancho de columnas y cabeceras limpias.
 */
export function exportToExcel(
  filename: string,
  sheetName: string,
  data: Record<string, any>[]
) {
  if (!data || data.length === 0) {
    alert('No hay datos disponibles para exportar a Excel.');
    return;
  }

  // 1. Crear hoja de cálculo a partir del JSON
  const worksheet = XLSX.utils.json_to_sheet(data);

  // 2. Auto-calcular el ancho óptimo de las columnas (wch)
  const headers = Object.keys(data[0]);
  const colWidths = headers.map(key => {
    let maxLen = key.length;
    for (const row of data) {
      const val = row[key];
      const strVal = val !== null && val !== undefined ? String(val) : '';
      if (strVal.length > maxLen) {
        maxLen = strVal.length;
      }
    }
    // Añadimos padding y limitamos entre 10 y 60 caracteres
    return { wch: Math.min(Math.max(maxLen + 3, 11), 60) };
  });
  worksheet['!cols'] = colWidths;

  // 3. Crear el libro de Excel y adjuntar la hoja
  const workbook = XLSX.utils.book_new();
  const safeSheetName = sheetName.slice(0, 31).replace(/[\\/?*[\]]/g, '');
  XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName || 'Datos AMEX');

  // 4. Descargar archivo en el navegador
  const finalFilename = filename.toLowerCase().endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  XLSX.writeFile(workbook, finalFilename);
}

/**
 * Exportador profesional de Paquetes / Inventario a Excel (.xlsx)
 */
export function exportPaquetesToExcel(paquetes: Paquete[], filenamePrefix = 'Inventario_AMEX_Lince') {
  const formattedData = paquetes.map((p, idx) => ({
    'N°': idx + 1,
    'Guía WR': p.numeroReciboBodega,
    'Código Casillero': p.codigoCasillero,
    'Consignatario': p.nombreConsignatario || 'No asignado',
    'DNI / Documento': p.dniConsignatario || '',
    'Tracking USA': p.trackingUsa || '',
    'Descripción del Paquete': p.descripcion || '',
    'Tipo Empaque': p.tipoEmpaque || 'CAJA',
    'Peso (Kg)': Number(p.pesoKg || 0),
    'Valor Decl. ($ USD)': Number(p.valorDeclaradoUsd || 0),
    'Almacén Actual': p.ubicacionActual === 'AmexLince'
      ? 'Almacén Central Lince'
      : p.ubicacionActual === 'TibCourierMiami'
      ? 'Miami Hub (USA)'
      : p.ubicacionActual === 'TibTingoMaria'
      ? 'Tingo María'
      : p.ubicacionActual,
    'Anaquel': p.anaquel || '',
    'Piso': p.piso || '',
    'Posición WMS': p.posicionEstante || (p.anaquel && p.piso ? `${p.anaquel}-${p.piso}` : 'REC'),
    'Método Entrega': p.metodoEntrega,
    'Estado Entrega': p.estadoEntrega === 'EnAlmacen'
      ? 'En Almacén'
      : p.estadoEntrega === 'EnRutaCarroAmex'
      ? 'En Ruta Carro Amex'
      : p.estadoEntrega === 'ListoParaRecojo'
      ? 'Listo para Recojo'
      : p.estadoEntrega === 'Entregado'
      ? 'Entregado'
      : p.estadoEntrega,
    'Fecha de Registro': p.creadoEn ? new Date(p.creadoEn).toLocaleString('es-PE') : ''
  }));

  const dateStr = new Date().toISOString().slice(0, 10);
  exportToExcel(`${filenamePrefix}_${dateStr}`, 'Inventario', formattedData);
}

/**
 * Exportador profesional de Kardex de Movimientos a Excel (.xlsx)
 */
export function exportKardexToExcel(kardexList: MovimientoKardex[], filenamePrefix = 'Kardex_Movimientos_AMEX') {
  const formattedData = kardexList.map((k, idx) => ({
    'N°': idx + 1,
    'Fecha y Hora': new Date(k.creadoEn).toLocaleString('es-PE'),
    'Guía / WR': k.codigoPaquete,
    'Consignatario / Casillero': k.consignatario || '',
    'Origen': k.origenDescripcion,
    'Destino': k.destinoDescripcion,
    'Tipo Movimiento': k.tipoMovimiento,
    'Motivo': k.motivo || '',
    'Operador Responsable': k.usuarioOperador
  }));

  const dateStr = new Date().toISOString().slice(0, 10);
  exportToExcel(`${filenamePrefix}_${dateStr}`, 'Kardex WMS', formattedData);
}

/**
 * Exportador profesional de Cola de Escaneo a Excel (.xlsx)
 */
export function exportScannerLogsToExcel(
  logs: Array<{
    code: string;
    format: string;
    location?: string;
    nombreConsignatario?: string;
    codigoCasillero?: string;
    time: string;
    synced?: boolean;
  }>,
  filenamePrefix = 'Lecturas_Escaneo_AMEX'
) {
  const formattedData = logs.map((l, idx) => ({
    'N°': idx + 1,
    'Código WR / Tracking': l.code,
    'Formato': l.format,
    'Ubicación Estante WMS': l.location || 'N/A',
    'Consignatario': l.nombreConsignatario || '',
    'Código Casillero': l.codigoCasillero || '',
    'Hora Escaneo': l.time,
    'Estado Sincronización': l.synced ? 'Sincronizado Master' : 'Borrador Local (Pendiente)'
  }));

  const dateStr = new Date().toISOString().slice(0, 10);
  exportToExcel(`${filenamePrefix}_${dateStr}`, 'Lecturas Escáner', formattedData);
}

/**
 * Exportador profesional de Manifiesto / Orden de Picking a Excel (.xlsx)
 */
export function exportPickingOrderToExcel(order: OrdenPicking, items: ItemPicking[]) {
  const formattedData = items.map((item, idx) => ({
    'Item N°': idx + 1,
    'Orden Picking': order.codigoOrden,
    'Guía WR': item.codigoReciboBodega,
    'Tracking USA': item.trackingUsa || '',
    'Ubicación Anaquel': item.ubicacionAnaquel || 'REC',
    'Consignatario': item.consignatario || '',
    'DNI': item.dniConsignatario || '',
    'Teléfono': item.telefonoConsignatario || '',
    'Ciudad Destino': item.ciudadDestino || order.destinoCiudad || 'Lima / Provincia',
    'Transportista / Agencia': order.transportistaAgencia,
    'Peso (Kg)': Number(item.pesoKg || 0),
    'Estado Picking': item.estadoItem === 'RECOLECTADO' ? 'RECOLECTADO / EN BARRIDO' : 'PENDIENTE',
    'Hora Recolección': item.recolectadoEn ? new Date(item.recolectadoEn).toLocaleTimeString('es-PE') : '-'
  }));

  const dateStr = new Date().toISOString().slice(0, 10);
  exportToExcel(`Manifiesto_Picking_${order.codigoOrden}_${dateStr}`, `Orden_${order.codigoOrden}`, formattedData);
}

/**
 * Exportador profesional de Clientes / Casilleros a Excel (.xlsx)
 */
export function exportClientesToExcel(clientes: Cliente[]) {
  const formattedData = clientes.map((c, idx) => ({
    'N°': idx + 1,
    'Código Casillero': c.codigoCasillero,
    'Importador / Cliente': c.nombre,
    'DNI / RUC': c.documentoIdentidad,
    'WhatsApp / Teléfono': c.telefono,
    'Email': c.email || '',
    'Departamento': c.departamento,
    'Provincia': c.provincia,
    'Distrito': c.distrito,
    'Dirección': c.direccionEntrega || '',
    'Agencia Preferida': c.transportistaPreferido || '',
    'Fecha de Registro': c.creadoEn ? new Date(c.creadoEn).toLocaleString('es-PE') : ''
  }));

  const dateStr = new Date().toISOString().slice(0, 10);
  exportToExcel(`Directorio_Casilleros_AMEX_${dateStr}`, 'Casilleros', formattedData);
}

/**
 * Exportador profesional de Liquidaciones Financieras a Excel (.xlsx)
 */
export function exportLiquidacionesToExcel(paquetes: Paquete[]) {
  const formattedData = paquetes.map((p, idx) => {
    const flete = Number(p.pesoKg || 0) * 12.0;
    const admin = 5.0;
    const totalUsd = flete + admin;
    const totalPen = totalUsd * 3.80;

    return {
      'N°': idx + 1,
      'Código Casillero': p.codigoCasillero,
      'Cliente Importador': p.nombreConsignatario || 'No asignado',
      'Guía WR #': p.numeroReciboBodega,
      'Peso (Kg)': Number(p.pesoKg || 0),
      'Flete ($ USD)': flete,
      'Admin Fee ($ USD)': admin,
      'Total USD ($)': totalUsd,
      'Total Soles (S/)': totalPen,
      'Estado Pago': 'PAGADO YAPE/BCP'
    };
  });

  const dateStr = new Date().toISOString().slice(0, 10);
  exportToExcel(`Liquidaciones_AMEX_${dateStr}`, 'Liquidaciones', formattedData);
}

/**
 * Exportador profesional de Hoja de Ruta de Reparto (Carro AMEX) a Excel (.xlsx)
 */
export function exportHojaDeRutaToExcel(
  paquetes: (Paquete & { cliente?: Cliente })[],
  chofer = 'Carlos Mendoza (Camioneta AMEX)',
  ruta = 'Ruta Lima Metropolitana'
) {
  const formattedData = paquetes.map((p, idx) => ({
    'Parada N°': idx + 1,
    'Guía WR': p.numeroReciboBodega,
    'Casillero': p.codigoCasillero,
    'Cliente / Consignatario': p.nombreConsignatario || p.cliente?.nombre || 'No asignado',
    'DNI / Documento': p.dniConsignatario || p.cliente?.documentoIdentidad || '',
    'Teléfono / WhatsApp': p.cliente?.telefono || '',
    'Distrito': p.cliente?.distrito || 'Lima',
    'Dirección de Entrega': p.cliente?.direccionEntrega || 'Dirección de contacto',
    'Tipo Empaque': p.tipoEmpaque,
    'Peso (Kg)': Number(p.pesoKg || 0),
    'Estado Entrega': p.estadoEntrega === 'EnRutaCarroAmex' ? 'EN RUTA' : p.estadoEntrega,
    'Conductor Asignado': chofer,
    'Zona / Ruta': ruta,
    'Firma de Conformidad': ''
  }));

  const dateStr = new Date().toISOString().slice(0, 10);
  exportToExcel(`Hoja_Ruta_CarroAMEX_${dateStr}`, 'Hoja de Ruta', formattedData);
}


