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

// Medidas estándar A4 en twips (1 mm = 56.7 twips)
// 210 mm = 11906 twips, 297 mm = 16838 twips
// 20 mm margen = 1134 twips
const MARGIN_TWIPS = convertMillimetersToTwip(20);

// Medidas objetivo para imagen DNI en píxeles (96 DPI):
// 12.0 cm = 120 mm = ~454 px
// 7.5 cm = 75 mm = ~283 px
const TARGET_WIDTH_PX = 454;
const TARGET_HEIGHT_PX = 283;

/**
 * Normaliza y procesa una imagen base64 aplicando rotación y ajustándola al marco A4.
 */
export async function normalizeImage(
  base64Data: string,
  rotation = 0
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
      let finalW = TARGET_WIDTH_PX;
      let finalH = Math.round(finalW / ratio);

      if (finalH > TARGET_HEIGHT_PX) {
        finalH = TARGET_HEIGHT_PX;
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
 * Crea las secciones / párrafos de un expediente dentro de Word
 */
async function buildExpedienteChildren(slot: DniSlotData): Promise<Paragraph[]> {
  const children: Paragraph[] = [];

  // Título o identificación discreta del expediente
  const labelText = slot.label
    ? `Expediente #${String(slot.id).padStart(4, '0')} - ${slot.label}`
    : `Expediente #${String(slot.id).padStart(4, '0')}`;

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: []
    })
  );

  // 1. ANVERSO (mitad superior)
  if (slot.anverso) {
    const anversoImg = await normalizeImage(slot.anverso, slot.anversoRotation || 0);
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 360 }, // Espacio intermedio (~2.5 cm)
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
    const reversoImg = await normalizeImage(slot.reverso, slot.reversoRotation || 0);
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
  onProgress?: (status: string) => void
): Promise<void> {
  const completeSlots = slots.filter((s) => s.anverso && s.reverso);
  if (completeSlots.length === 0) {
    throw new Error('No hay expedientes completos (con anverso y reverso) para exportar.');
  }

  onProgress?.('Preparando documento Word Maestro A4...');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sections: any[] = [];

  for (let i = 0; i < completeSlots.length; i++) {
    const slot = completeSlots[i];
    onProgress?.(`Procesando expediente ${i + 1} de ${completeSlots.length} (#${slot.id})...`);
    const children = await buildExpedienteChildren(slot);

    sections.push({
      properties: {
        page: {
          size: {
            width: convertMillimetersToTwip(210), // A4 210 mm
            height: convertMillimetersToTwip(297) // A4 297 mm
          },
          margin: {
            top: MARGIN_TWIPS,
            bottom: MARGIN_TWIPS,
            left: MARGIN_TWIPS,
            right: MARGIN_TWIPS
          }
        }
      },
      children
    });
  }

  onProgress?.('Generando archivo final (.docx)...');

  const doc = new Document({
    title: `Lote DNI Matrix Express - ${completeSlots.length} Expedientes`,
    creator: 'Amex Courier ERP - DNI Matrix Express',
    sections
  });

  const blob = await Packer.toBlob(doc);
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `DNI_Matrix_Maestro_${completeSlots.length}_Expedientes_${dateStr}.docx`;

  saveAs(blob, filename);
  onProgress?.('¡Descarga completada!');
}

/**
 * EXPORTAR LOTE COMPRIMIDO EN ZIP (.ZIP)
 * Genera archivos .docx individuales para cada expediente dentro de un archivo .zip.
 */
export async function exportZipDocx(
  slots: DniSlotData[],
  onProgress?: (current: number, total: number) => void
): Promise<void> {
  const completeSlots = slots.filter((s) => s.anverso && s.reverso);
  if (completeSlots.length === 0) {
    throw new Error('No hay expedientes completos (con anverso y reverso) para exportar en ZIP.');
  }

  const zip = new JSZip();

  for (let i = 0; i < completeSlots.length; i++) {
    const slot = completeSlots[i];
    onProgress?.(i + 1, completeSlots.length);

    const children = await buildExpedienteChildren(slot);

    const doc = new Document({
      title: `Expediente #${slot.id}`,
      creator: 'Amex Courier ERP - DNI Matrix Express',
      sections: [
        {
          properties: {
            page: {
              size: {
                width: convertMillimetersToTwip(210),
                height: convertMillimetersToTwip(297)
              },
              margin: {
                top: MARGIN_TWIPS,
                bottom: MARGIN_TWIPS,
                left: MARGIN_TWIPS,
                right: MARGIN_TWIPS
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
