import JSZip from 'jszip';
import jsPDF from 'jspdf';
import { saveAs } from 'file-saver';
import { DniSlotData } from './db';
import { normalizeImage, DniPrintSize, DNI_SIZE_PRESETS } from './docx-exporter';

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convierte un único archivo .docx a un documento PDF A4 con medidas exactas
 */
export async function convertDocxBufferToPdf(
  arrayBuffer: ArrayBuffer,
  sizePreset: DniPrintSize = 'large'
): Promise<Blob> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const config = DNI_SIZE_PRESETS[sizePreset] || DNI_SIZE_PRESETS.large;

  // Las imágenes del documento Word residen en word/media/
  const mediaKeys = Object.keys(zip.files).filter(
    (key) => key.startsWith('word/media/') && !zip.files[key].dir
  );
  mediaKeys.sort(); // image1.jpeg (Anverso), image2.jpeg (Reverso)

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4' // 210 x 297 mm
  });

  const x = config.pdfX;
  const w = config.widthMm;
  const h = config.heightMm;

  // Anverso (mitad superior)
  if (mediaKeys.length > 0) {
    const anversoB64 = await zip.files[mediaKeys[0]].async('base64');
    doc.addImage(`data:image/jpeg;base64,${anversoB64}`, 'JPEG', x, config.pdfY1, w, h);
  }

  // Reverso (mitad inferior)
  if (mediaKeys.length > 1) {
    const reversoB64 = await zip.files[mediaKeys[1]].async('base64');
    doc.addImage(`data:image/jpeg;base64,${reversoB64}`, 'JPEG', x, config.pdfY2, w, h);
  }

  return doc.output('blob');
}

/**
 * Convierte en lote todos los archivos .docx de una carpeta seleccionada
 * y escribe directamente los archivos .pdf resultantes en Windows,
 * creando automáticamente la carpeta "PDFs/" si se seleccionó esa opción.
 */
export async function convertDocxFolderToPdf(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dirHandle: any,
  sameFolder = false,
  onProgress?: (current: number, total: number, filename: string) => void,
  sizePreset: DniPrintSize = 'large'
): Promise<{ success: boolean; total: number; errors: number; destFolder: string }> {
  // 1. Escaneo de archivos .docx en la carpeta seleccionada
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const docxEntries: { name: string; handle: any }[] = [];
  for await (const entry of dirHandle.values()) {
    if (
      entry.kind === 'file' &&
      entry.name.toLowerCase().endsWith('.docx') &&
      !entry.name.startsWith('~$')
    ) {
      docxEntries.push({ name: entry.name, handle: entry });
    }
  }

  if (docxEntries.length === 0) {
    throw new Error('No se encontraron archivos Word (.docx) válidos en la carpeta seleccionada.');
  }

  // 2. Crear o seleccionar la carpeta de destino
  let targetDirHandle = dirHandle;
  let destName = dirHandle.name;
  if (!sameFolder) {
    targetDirHandle = await dirHandle.getDirectoryHandle('PDFs', { create: true });
    destName = `${dirHandle.name}/PDFs`;
  }

  let converted = 0;
  let errors = 0;

  for (let i = 0; i < docxEntries.length; i++) {
    const { name, handle } = docxEntries[i];
    onProgress?.(i + 1, docxEntries.length, name);

    try {
      const file = await handle.getFile();
      const arrayBuffer = await file.arrayBuffer();
      const pdfBlob = await convertDocxBufferToPdf(arrayBuffer, sizePreset);

      const baseName = name.replace(/\.docx$/i, '');
      const pdfFilename = `${baseName}.pdf`;

      // Escribir el archivo .pdf directamente en el disco duro del usuario
      const pdfFileHandle = await targetDirHandle.getFileHandle(pdfFilename, { create: true });
      const writable = await pdfFileHandle.createWritable();
      await writable.write(pdfBlob);
      await writable.close();
      converted++;
    } catch (e) {
      console.error(`Error al convertir ${name}:`, e);
      errors++;
    }
  }

  return { success: true, total: converted, errors, destFolder: destName };
}

/**
 * Genera y descarga un PDF A4 individual para un slot
 */
export async function createPdfForSlot(
  slot: DniSlotData,
  sizePreset: DniPrintSize = 'large'
): Promise<Blob> {
  const config = DNI_SIZE_PRESETS[sizePreset] || DNI_SIZE_PRESETS.large;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const x = config.pdfX;
  const w = config.widthMm;
  const h = config.heightMm;

  if (slot.anverso) {
    const anversoImg = await normalizeImage(
      slot.anverso,
      slot.anversoRotation || 0,
      config.widthPx,
      config.heightPx
    );
    const anversoDataUrl = `data:image/jpeg;base64,${uint8ArrayToBase64(anversoImg.buffer)}`;
    doc.addImage(anversoDataUrl, 'JPEG', x, config.pdfY1, w, h);
  }

  if (slot.reverso) {
    const reversoImg = await normalizeImage(
      slot.reverso,
      slot.reversoRotation || 0,
      config.widthPx,
      config.heightPx
    );
    const reversoDataUrl = `data:image/jpeg;base64,${uint8ArrayToBase64(reversoImg.buffer)}`;
    doc.addImage(reversoDataUrl, 'JPEG', x, config.pdfY2, w, h);
  }

  return doc.output('blob');
}

/**
 * Exporta todos los expedientes completos directamente a un archivo ZIP con PDFs
 */
export async function exportPdfZip(
  slots: DniSlotData[],
  onProgress?: (current: number, total: number) => void,
  sizePreset: DniPrintSize = 'large'
): Promise<void> {
  const completeSlots = slots.filter((s) => s.anverso && s.reverso);
  if (completeSlots.length === 0) {
    throw new Error('No hay expedientes completos para exportar en PDF.');
  }

  const zip = new JSZip();

  for (let i = 0; i < completeSlots.length; i++) {
    const slot = completeSlots[i];
    onProgress?.(i + 1, completeSlots.length);

    const pdfBlob = await createPdfForSlot(slot, sizePreset);
    const numStr = String(slot.id).padStart(3, '0');
    const labelSuffix = slot.label ? `_${slot.label.replace(/[\\/:*?"<>|]/g, '_').trim()}` : '';
    const filename = `Expediente_${numStr}${labelSuffix}.pdf`;

    zip.file(filename, pdfBlob);
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const dateStr = new Date().toISOString().slice(0, 10);
  saveAs(zipBlob, `Lote_PDFs_${completeSlots.length}_Expedientes_${dateStr}.zip`);
}
