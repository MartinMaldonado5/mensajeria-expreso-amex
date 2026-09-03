/**
 * DNI MATRIX EXPRESS - MOTOR DE EXPORTACIÓN A MICROSOFT WORD (.DOCX) Y ZIP
 * 
 * Genera documentos Word con cuadre milimétrico en formato A4 estándar:
 * - Hoja A4: 21.0 x 29.7 cm
 * - Márgenes: 2.0 cm en los cuatro lados (1134 twips)
 * - Dimensiones DNI: Escalado exacto a 12.0 cm x 7.5 cm (o proporcional dentro de la caja)
 * - Anverso centrado en la mitad superior
 * - Reverso centrado en la mitad inferior
 * - Separación calculada de 2.5 cm que garantiza 1 sola página estricta por expediente.
 */

import { Document, Paragraph, ImageRun, AlignmentType, Packer, WidthType, PageBreak, convertMillimetersToTwip } from 'docx';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { DniSlotData } from './db';

export type DniPrintSize = 'large' | 'xlarge' | 'standard';

export interface DniSizeConfig {
  id: DniPrintSize;
  name: string;
  widthCm: number;
  heightCm: number;
  widthMm: number;
  heightMm: number;
  widthPx: number;
  heightPx: number;
  spacingAfterTwips: number;
  marginMm: number;
  marginTwips: number;
  pdfX: number;
  pdfY1: number;
  pdfY2: number;
}

export const DNI_SIZE_PRESETS: Record<DniPrintSize, DniSizeConfig> = {
  large: {
    id: 'large',
    name: 'Grande (16.5 × 10.4 cm) [Recomendado - Ocupa la hoja]',
    widthCm: 16.5,
    heightCm: 10.4,
    widthMm: 165,
    heightMm: 104,
    widthPx: 624,
    heightPx: 393,
    spacingAfterTwips: 240, // ~1.2 cm
    marginMm: 18,
    marginTwips: convertMillimetersToTwip(18),
    pdfX: 22.5,
    pdfY1: 20,
    pdfY2: 138
  },
  xlarge: {
    id: 'xlarge',
    name: 'Extra Grande (17.5 × 11.0 cm) [Ocupación máxima]',
    widthCm: 17.5,
    heightCm: 11.0,
    widthMm: 175,
    heightMm: 110,
    widthPx: 661,
    heightPx: 416,
    spacingAfterTwips: 180, // ~0.9 cm
    marginMm: 15,
    marginTwips: convertMillimetersToTwip(15),
    pdfX: 17.5,
    pdfY1: 16,
    pdfY2: 140
  },
  standard: {
    id: 'standard',
    name: 'Estándar (12.0 × 7.5 cm) [Medida tradicional pequeña]',
    widthCm: 12.0,
    heightCm: 7.5,
    widthMm: 120,
    heightMm: 75,
    widthPx: 454,
    heightPx: 283,
    spacingAfterTwips: 360, // ~2.5 cm
    marginMm: 20,
    marginTwips: convertMillimetersToTwip(20),
    pdfX: 45,
    pdfY1: 25,
    pdfY2: 125
  }
};

/**
 * Normaliza y procesa una imagen base64 aplicando rotación y ajustándola al tamaño objetivo.
 */
export async function normalizeImage(
  base64Data: string,
  rotation = 0,
  targetWidthPx = DNI_SIZE_PRESETS.large.widthPx,
  targetHeightPx = DNI_SIZE_PRESETS.large.heightPx
): Promise<{ buffer: Uint8Array; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Canvas normalization requires browser environment'));
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const isRotated = rotation === 90 || rotation === 270;
      const naturalW = isRotated ? (img.naturalHeight || img.height) : (img.naturalWidth || img.width);
      const naturalH = isRotated ? (img.naturalWidth || img.width) : (img.naturalHeight || img.height);

      const ratio = naturalW / naturalH;
      let finalW = targetWidthPx;
      let finalH = Math.round(finalW / ratio);

      if (finalH > targetHeightPx) {
        finalH = targetHeightPx;
        finalW = Math.round(finalH * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = naturalW;
      canvas.height = naturalH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context could not be created'));
        return;
      }

      // Fondo blanco sólido
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Aplicar rotación
      if (rotation !== 0) {
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        if (isRotated) {
          ctx.drawImage(img, -canvas.height / 2, -canvas.width / 2);
        } else {
          ctx.drawImage(img, -canvas.width / 2, -canvas.height / 2);
        }
      } else {
        ctx.drawImage(img, 0, 0);
      }

      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            reject(new Error('Failed to convert canvas to blob'));
            return;
          }
          const arrayBuffer = await blob.arrayBuffer();
          resolve({
            buffer: new Uint8Array(arrayBuffer),
            width: finalW,
            height: finalH
          });
        },
        'image/jpeg',
        0.95
      );
    };

    img.onerror = () => reject(new Error('Failed to load image for normalization'));
    img.src = base64Data;
  });
}

function sanitizeFilename(text: string): string {
  return (text || '').replace(/[\\/:*?"<>|]/g, '_').trim();
}

/**
 * Crea las secciones / párrafos de un expediente dentro de Word con el tamaño seleccionado
 */
async function buildExpedienteChildren(
  slot: DniSlotData,
  sizePreset: DniPrintSize = 'large'
): Promise<Paragraph[]> {
  const children: Paragraph[] = [];
  const config = DNI_SIZE_PRESETS[sizePreset] || DNI_SIZE_PRESETS.large;

  // 1. ANVERSO (mitad superior)
  if (slot.anverso) {
    const anversoImg = await normalizeImage(
      slot.anverso,
      slot.anversoRotation || 0,
      config.widthPx,
      config.heightPx
    );
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: config.spacingAfterTwips },
        children: [
          new ImageRun({
            data: anversoImg.buffer,
            transformation: {
              width: anversoImg.width,
              height: anversoImg.height
            },
            type: 'jpg'
          })
        ]
      })
    );
  }

  // 2. REVERSO (mitad inferior)
  if (slot.reverso) {
    const reversoImg = await normalizeImage(
      slot.reverso,
      slot.reversoRotation || 0,
      config.widthPx,
      config.heightPx
    );
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new ImageRun({
            data: reversoImg.buffer,
            transformation: {
              width: reversoImg.width,
              height: reversoImg.height
            },
            type: 'jpg'
          })
        ]
      })
    );
  }

  return children;
}

/**
 * EXPORTAR DOCUMENTO WORD MAESTRO ÚNICO (.DOCX)
 * Contiene todas las páginas de los expedientes completos en un solo archivo.
 */
export async function exportMasterDocx(
  slots: DniSlotData[],
  onProgress?: (status: string) => void,
  sizePreset: DniPrintSize = 'large'
): Promise<void> {
  const completeSlots = slots.filter((s) => s.anverso && s.reverso);
  if (completeSlots.length === 0) {
    throw new Error('No hay expedientes completos (con anverso y reverso) para exportar.');
  }

  const config = DNI_SIZE_PRESETS[sizePreset] || DNI_SIZE_PRESETS.large;
  onProgress?.('Preparando documento Word Maestro A4...');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sections: any[] = [];

  for (let i = 0; i < completeSlots.length; i++) {
    const slot = completeSlots[i];
    onProgress?.(`Procesando expediente ${i + 1} de ${completeSlots.length} (#${slot.id})...`);
    const children = await buildExpedienteChildren(slot, sizePreset);

    sections.push({
      properties: {
        page: {
          size: {
            width: convertMillimetersToTwip(210), // A4 210 mm
            height: convertMillimetersToTwip(297) // A4 297 mm
          },
          margin: {
            top: config.marginTwips,
            bottom: config.marginTwips,
            left: config.marginTwips,
            right: config.marginTwips
          }
        }
      },
      children
    });
  }

  onProgress?.('Generando archivo final (.docx)...');

  const doc = new Document({
    title: `Lote Procesador de DNI - ${completeSlots.length} Expedientes`,
    creator: 'AMEX COURIER SISTEMA - Procesador de DNI',
    sections
  });

  const blob = await Packer.toBlob(doc);
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `DNI_Procesador_${completeSlots.length}_Expedientes_${dateStr}.docx`;

  saveAs(blob, filename);
  onProgress?.('¡Descarga completada!');
}

/**
 * EXPORTAR LOTE COMPRIMIDO EN ZIP (.ZIP)
 * Genera archivos .docx individuales para cada expediente dentro de un archivo .zip.
 */
export async function exportZipDocx(
  slots: DniSlotData[],
  onProgress?: (current: number, total: number) => void,
  sizePreset: DniPrintSize = 'large'
): Promise<void> {
  const completeSlots = slots.filter((s) => s.anverso && s.reverso);
  if (completeSlots.length === 0) {
    throw new Error('No hay expedientes completos (con anverso y reverso) para exportar en ZIP.');
  }

  const config = DNI_SIZE_PRESETS[sizePreset] || DNI_SIZE_PRESETS.large;
  const zip = new JSZip();

  for (let i = 0; i < completeSlots.length; i++) {
    const slot = completeSlots[i];
    onProgress?.(i + 1, completeSlots.length);

    const children = await buildExpedienteChildren(slot, sizePreset);

    const doc = new Document({
      title: `Expediente #${slot.id}`,
      creator: 'AMEX COURIER SISTEMA - Procesador de DNI',
      sections: [
        {
          properties: {
            page: {
              size: {
                width: convertMillimetersToTwip(210),
                height: convertMillimetersToTwip(297)
              },
              margin: {
                top: config.marginTwips,
                bottom: config.marginTwips,
                left: config.marginTwips,
                right: config.marginTwips
              }
            }
          },
          children
        }
      ]
    });

    const docBlob = await Packer.toBlob(doc);
    const labelSuffix = slot.label ? `_${sanitizeFilename(slot.label)}` : '';
    const fileNum = String(slot.id).padStart(4, '0');
    const docxName = `Expediente_${fileNum}${labelSuffix}.docx`;

    zip.file(docxName, docBlob);
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  saveAs(zipBlob, `Lote_DNI_Matrix_${completeSlots.length}_Expedientes_${dateStr}.zip`);
}

/**
 * GUARDAR DIRECTAMENTE EN UNA CARPETA LOCAL (SIN COMPRIMIR)
 * Usa la File System Access API nativa del navegador (showDirectoryPicker)
 */
export async function exportToDirectoryFolder(
  slots: DniSlotData[],
  onProgress?: (msg: string, percent?: number) => void,
  sizePreset: DniPrintSize = 'large'
): Promise<{ success: boolean; count: number; cancelled?: boolean }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (!w.showDirectoryPicker) {
    throw new Error('Tu navegador no soporta la selección directa de carpetas. Usa Google Chrome o Microsoft Edge.');
  }

  const completeSlots = slots.filter((s) => s.anverso && s.reverso);
  if (completeSlots.length === 0) {
    throw new Error('No hay expedientes completos para exportar.');
  }

  const config = DNI_SIZE_PRESETS[sizePreset] || DNI_SIZE_PRESETS.large;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let dirHandle: any;
  try {
    dirHandle = await w.showDirectoryPicker({
      id: 'dni_export_folder',
      mode: 'readwrite',
      startIn: 'documents'
    });
  } catch (err: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((err as any)?.name === 'AbortError') {
      return { success: false, count: 0, cancelled: true };
    }
    throw err;
  }

  const total = completeSlots.length;
  for (let i = 0; i < total; i++) {
    const slot = completeSlots[i];
    const percent = Math.round(((i + 1) / total) * 100);
    onProgress?.(`Guardando expediente ${i + 1} de ${total}...`, percent);

    const children = await buildExpedienteChildren(slot, sizePreset);
    const doc = new Document({
      title: `Expediente #${slot.id}`,
      creator: 'AMEX COURIER SISTEMA - Procesador de DNI',
      sections: [
        {
          properties: {
            page: {
              size: {
                width: convertMillimetersToTwip(210),
                height: convertMillimetersToTwip(297)
              },
              margin: {
                top: config.marginTwips,
                bottom: config.marginTwips,
                left: config.marginTwips,
                right: config.marginTwips
              }
            }
          },
          children
        }
      ]
    });

    const docBlob = await Packer.toBlob(doc);
    const labelSuffix = slot.label ? `_${sanitizeFilename(slot.label)}` : '';
    const fileNum = String(slot.id).padStart(4, '0');
    const docxName = `Expediente_${fileNum}${labelSuffix}.docx`;

    const fileHandle = await dirHandle.getFileHandle(docxName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(docBlob);
    await writable.close();
  }

  onProgress?.('¡Todos los archivos Word han sido guardados con éxito!', 100);
  return { success: true, count: total };
}

