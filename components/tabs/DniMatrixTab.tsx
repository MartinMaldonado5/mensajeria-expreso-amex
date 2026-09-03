'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import './dni-matrix.css';
import { dniDb, DniSlotData } from '@/lib/dni-matrix/db';
import { exportMasterDocx, exportZipDocx, exportToDirectoryFolder, DniPrintSize, DNI_SIZE_PRESETS } from '@/lib/dni-matrix/docx-exporter';
import { convertDocxFolderToPdf, exportPdfZip } from '@/lib/dni-matrix/pdf-converter';
import { Paquete, Cliente } from '@/types';

interface DniMatrixTabProps {
  paquetes?: Paquete[];
  clientes?: Cliente[];
}

interface ToastMessage {
  id: number;
  text: string;
  type: 'info' | 'success' | 'error';
}

export default function DniMatrixTab({ paquetes = [], clientes = [] }: DniMatrixTabProps) {
  // Configuración y Estados
  const [totalSlots, setTotalSlots] = useState<number>(100);
  const [printSize, setPrintSize] = useState<DniPrintSize>('large');
  const [activeSlotId, setActiveSlotId] = useState<number>(1);
  const [focusedSide, setFocusedSide] = useState<'anverso' | 'reverso' | null>(null);
  const [slotsData, setSlotsData] = useState<Record<number, DniSlotData>>({});
  const [currentFilter, setCurrentFilter] = useState<'all' | 'ready' | 'partial' | 'empty'>('all');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [quickJumpVal, setQuickJumpVal] = useState<string>('');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Modales
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [showPreviewModal, setShowPreviewModal] = useState<boolean>(false);
  const [showPdfModal, setShowPdfModal] = useState<boolean>(false);
  const [showAmexLinkModal, setShowAmexLinkModal] = useState<boolean>(false);

  // Estados de exportación
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportStatusMessage, setExportStatusMessage] = useState<string>('');

  // Estados de Conversor PDF
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pdfDirHandle, setPdfDirHandle] = useState<any>(null);
  const [pdfDestOption, setPdfDestOption] = useState<'subfolder' | 'same'>('subfolder');
  const [pdfFolderPath, setPdfFolderPath] = useState<string>('');
  const [pdfScanCount, setPdfScanCount] = useState<number | null>(null);
  const [pdfConverting, setPdfConverting] = useState<boolean>(false);
  const [pdfProgressMsg, setPdfProgressMsg] = useState<string>('');
  const [pdfProgressPercent, setPdfProgressPercent] = useState<number>(0);
  const [pdfSuccessDone, setPdfSuccessDone] = useState<boolean>(false);
  const [pdfConvertedInfo, setPdfConvertedInfo] = useState<{ total: number; dest: string } | null>(null);

  const activeSlotRef = useRef<number>(activeSlotId);
  activeSlotRef.current = activeSlotId;

  // Toast helper
  const showToast = useCallback((text: string, type: 'info' | 'success' | 'error' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, text, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  }, []);

  // Web Audio API feedback
  const playSound = useCallback(
    (type: 'complete' | 'paste' | 'click' | 'error') => {
      if (!soundEnabled || typeof window === 'undefined') return;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        if (type === 'complete') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(587.33, ctx.currentTime);
          osc.frequency.setValueAtTime(880.0, ctx.currentTime + 0.1);
          gain.gain.setValueAtTime(0.2, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.4);
        } else if (type === 'paste') {
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(440, ctx.currentTime);
          gain.gain.setValueAtTime(0.12, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.16);
        } else if (type === 'click') {
          osc.type = 'sine';
          osc.frequency.setValueAtTime(320, ctx.currentTime);
          gain.gain.setValueAtTime(0.05, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.08);
        }
      } catch {
        // Silencioso si no hay soporte de audio
      }
    },
    [soundEnabled]
  );

  // Carga inicial
  useEffect(() => {
    async function initData() {
      const savedSlots = await dniDb.loadAllSlots();
      const map: Record<number, DniSlotData> = {};
      savedSlots.forEach((s) => {
        map[s.id] = s;
      });
      setSlotsData(map);

      const savedTotal = await dniDb.getSetting<number>('totalSlots', 100);
      setTotalSlots(savedTotal);

      const savedSound = await dniDb.getSetting<boolean>('soundEnabled', true);
      setSoundEnabled(savedSound);

      const savedPrintSize = await dniDb.getSetting<DniPrintSize>('dniPrintSize', 'large');
      setPrintSize(savedPrintSize);
    }
    initData();
  }, []);

  const padNum = (num: number): string => String(num).padStart(3, '0');

  const getSlot = useCallback(
    (id: number): DniSlotData => {
      return slotsData[id] || { id };
    },
    [slotsData]
  );

  const updateSlot = useCallback(async (slot: DniSlotData) => {
    setSlotsData((prev) => ({ ...prev, [slot.id]: slot }));
    await dniDb.saveSlot(slot);
  }, []);

  const getSlotStatus = (slot?: DniSlotData): 'ready' | 'partial' | 'empty' => {
    if (!slot) return 'empty';
    if (slot.anverso && slot.reverso) return 'ready';
    if (slot.anverso || slot.reverso) return 'partial';
    return 'empty';
  };

  // Salto al siguiente incompleto
  const jumpToNextIncompleteSlot = useCallback(() => {
    let nextId: number | null = null;
    for (let id = activeSlotRef.current + 1; id <= totalSlots; id++) {
      if (getSlotStatus(slotsData[id]) !== 'ready') {
        nextId = id;
        break;
      }
    }
    if (!nextId) {
      for (let id = 1; id < activeSlotRef.current; id++) {
        if (getSlotStatus(slotsData[id]) !== 'ready') {
          nextId = id;
          break;
        }
      }
    }

    if (nextId) {
      playSound('click');
      setActiveSlotId(nextId);
      setFocusedSide(null);
      showToast(`Saltando a cupo pendiente #${padNum(nextId)}`, 'info');
    } else {
      showToast('¡Felicidades! Todos los cupos están 100% completos.', 'success');
      playSound('complete');
    }
  }, [slotsData, totalSlots, playSound, showToast]);

  // Rotar imagen 90 grados
  const rotateSide = async (side: 'anverso' | 'reverso', degrees: number) => {
    const slot = getSlot(activeSlotId);
    if (!slot[side]) return;
    playSound('click');
    showToast(`Rotando ${side}...`);

    const rotKey = side === 'anverso' ? 'anversoRotation' : 'reversoRotation';
    const currentRot = slot[rotKey] || 0;
    const newRot = (currentRot + degrees + 360) % 360;

    await updateSlot({ ...slot, [rotKey]: newRot });
  };

  // Limpiar cara
  const clearSide = async (side: 'anverso' | 'reverso') => {
    const slot = getSlot(activeSlotId);
    if (!slot[side]) return;
    playSound('click');
    const rotKey = side === 'anverso' ? 'anversoRotation' : 'reversoRotation';
    await updateSlot({ ...slot, [side]: null, [rotKey]: 0 });
    showToast(`${side === 'anverso' ? 'Anverso' : 'Reverso'} eliminado`);
  };

  // Intercambiar anverso y reverso
  const swapSides = async () => {
    const slot = getSlot(activeSlotId);
    if (!slot.anverso && !slot.reverso) return;
    playSound('click');
    await updateSlot({
      ...slot,
      anverso: slot.reverso,
      reverso: slot.anverso,
      anversoRotation: slot.reversoRotation || 0,
      reversoRotation: slot.anversoRotation || 0
    });
    showToast('Caras intercambiadas exitosamente', 'success');
  };

  // ==========================================================================
  // EXTRACCIÓN Y PROCESAMIENTO UNIVERSAL DE IMÁGENES (Ctrl+V y Arrastre de WhatsApp Web)
  // ==========================================================================
  const [dragHoverSide, setDragHoverSide] = useState<'anverso' | 'reverso' | 'surface' | null>(null);

  const processImagePayload = useCallback(
    async (base64Data: string, explicitSide?: 'anverso' | 'reverso' | null) => {
      const currentId = activeSlotRef.current;
      const currentSlot = getSlot(currentId);

      let sideToAssign = explicitSide || focusedSide;
      if (!sideToAssign) {
        if (!currentSlot.anverso) {
          sideToAssign = 'anverso';
        } else if (!currentSlot.reverso) {
          sideToAssign = 'reverso';
        } else {
          sideToAssign = 'anverso';
        }
      }

      const rotKey = sideToAssign === 'anverso' ? 'anversoRotation' : 'reversoRotation';
      const updatedSlot: DniSlotData = {
        ...currentSlot,
        [sideToAssign]: base64Data,
        [rotKey]: 0
      };

      await updateSlot(updatedSlot);
      const sideName = sideToAssign === 'anverso' ? 'Anverso' : 'Reverso';
      showToast(`${sideName} cargado en Expediente #${padNum(currentId)}`, 'success');

      const isNowComplete = Boolean(updatedSlot.anverso && updatedSlot.reverso);
      if (isNowComplete) {
        playSound('complete');
        setTimeout(() => {
          jumpToNextIncompleteSlot();
        }, 350);
      } else {
        playSound('paste');
        setFocusedSide('reverso');
      }
    },
    [focusedSide, getSlot, updateSlot, showToast, playSound, jumpToNextIncompleteSlot]
  );

  const extractBase64FromDataTransfer = async (dt: DataTransfer): Promise<string | null> => {
    // 1. Archivos directos
    if (dt.files && dt.files.length > 0) {
      for (let i = 0; i < dt.files.length; i++) {
        const f = dt.files[i];
        if (f.type.startsWith('image/')) {
          return new Promise((resolve) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result as string);
            r.onerror = () => resolve(null);
            r.readAsDataURL(f);
          });
        }
      }
    }

    // 2. DataTransfer Items
    if (dt.items && dt.items.length > 0) {
      for (let i = 0; i < dt.items.length; i++) {
        const item = dt.items[i];
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            return new Promise((resolve) => {
              const r = new FileReader();
              r.onload = () => resolve(r.result as string);
              r.onerror = () => resolve(null);
              r.readAsDataURL(file);
            });
          }
        }
      }
    }

    // 3. HTML (Cuando se arrastra desde WhatsApp Web suele viajar un elemento <img>)
    const html = dt.getData('text/html');
    if (html) {
      const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (match && match[1]) {
        const src = match[1];
        if (src.startsWith('data:image')) return src;
        try {
          return await convertUrlToBase64(src);
        } catch {
          // Fallback
        }
      }
    }

    // 4. URI-List o Texto plano (URL directa o blob)
    const uri = dt.getData('text/uri-list') || dt.getData('text/plain');
    if (uri && (uri.startsWith('blob:') || uri.startsWith('http') || uri.startsWith('data:image'))) {
      if (uri.startsWith('data:image')) return uri;
      try {
        return await convertUrlToBase64(uri);
      } catch {
        // Fallback
      }
    }

    return null;
  };

  const convertUrlToBase64 = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject('No canvas context');
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg', 0.95));
        } catch {
          fetchBlobUrl(url).then(resolve).catch(reject);
        }
      };
      img.onerror = () => {
        fetchBlobUrl(url).then(resolve).catch(reject);
      };
      img.src = url;
    });
  };

  const fetchBlobUrl = (url: string): Promise<string> => {
    return fetch(url)
      .then((res) => res.blob())
      .then(
        (blob) =>
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          })
      );
  };

  // PREVENCIÓN GLOBAL: Impide que el navegador abra el archivo en una pestaña nueva
  useEffect(() => {
    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleWindowDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragHoverSide(null);

      const dt = e.dataTransfer;
      if (!dt) return;

      const base64 = await extractBase64FromDataTransfer(dt);
      if (base64) {
        await processImagePayload(base64, focusedSide);
      }
    };

    window.addEventListener('dragenter', handleWindowDragOver, false);
    window.addEventListener('dragover', handleWindowDragOver, false);
    window.addEventListener('drop', handleWindowDrop, false);

    return () => {
      window.removeEventListener('dragenter', handleWindowDragOver);
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, [focusedSide, processImagePayload]);

  // Pegado global (Ctrl + V / WhatsApp Web)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (
        document.activeElement &&
        (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')
      ) {
        return;
      }

      const items = e.clipboardData?.items;
      if (!items) return;

      let imageItem: DataTransferItem | null = null;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          imageItem = items[i];
          break;
        }
      }

      if (!imageItem) return;

      e.preventDefault();
      const file = imageItem.getAsFile();
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = event.target?.result as string;
        if (base64Data) {
          await processImagePayload(base64Data, focusedSide);
        }
      };

      reader.readAsDataURL(file);
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [focusedSide, processImagePayload]);

  // Atajos de teclado (Enter, Flechas, R)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isTyping =
        document.activeElement &&
        (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT');

      if (e.key === 'Enter' && !isTyping) {
        e.preventDefault();
        jumpToNextIncompleteSlot();
      } else if (e.key === 'ArrowLeft' && !isTyping) {
        e.preventDefault();
        if (activeSlotRef.current > 1) {
          playSound('click');
          setActiveSlotId((prev) => prev - 1);
        }
      } else if (e.key === 'ArrowRight' && !isTyping) {
        e.preventDefault();
        if (activeSlotRef.current < totalSlots) {
          playSound('click');
          setActiveSlotId((prev) => prev + 1);
        }
      } else if ((e.key === 'r' || e.key === 'R') && !isTyping && !e.ctrlKey) {
        e.preventDefault();
        const targetSide = focusedSide || 'anverso';
        rotateSide(targetSide, 90);
      } else if (e.key === 'Escape') {
        setShowConfigModal(false);
        setShowPreviewModal(false);
        setShowPdfModal(false);
        setShowAmexLinkModal(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalSlots, focusedSide, jumpToNextIncompleteSlot, playSound]);

  // Estadísticas globales
  const allSlotsArray = Array.from({ length: totalSlots }, (_, i) => i + 1);
  const stats = allSlotsArray.reduce(
    (acc, id) => {
      const st = getSlotStatus(slotsData[id]);
      if (st === 'ready') acc.ready++;
      else if (st === 'partial') acc.partial++;
      else acc.empty++;
      return acc;
    },
    { ready: 0, partial: 0, empty: 0 }
  );

  const progressPercent = totalSlots > 0 ? Math.round((stats.ready / totalSlots) * 100) : 0;

  // Filtrado de la matriz
  const filteredSlotIds = allSlotsArray.filter((id) => {
    const st = getSlotStatus(slotsData[id]);
    if (currentFilter === 'ready') return st === 'ready';
    if (currentFilter === 'partial') return st === 'partial';
    if (currentFilter === 'empty') return st === 'empty';
    return true;
  });

  const activeSlot = getSlot(activeSlotId);
  const activeStatus = getSlotStatus(activeSlot);

  // Exportar Word Maestro
  const handleExportMaster = async () => {
    const completed = Object.values(slotsData).filter((s) => s.anverso && s.reverso);
    if (completed.length === 0) {
      showToast('No hay expedientes completos para exportar.', 'error');
      return;
    }
    try {
      setIsExporting(true);
      setExportStatusMessage('Preparando Word Maestro Único...');
      await exportMasterDocx(completed, (msg) => setExportStatusMessage(msg), printSize);
      showToast('¡Documento Word Maestro generado con éxito!', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al exportar';
      showToast(msg, 'error');
    } finally {
      setIsExporting(false);
      setExportStatusMessage('');
    }
  };

  // Exportar ZIP
  const handleExportZip = async () => {
    const completed = Object.values(slotsData).filter((s) => s.anverso && s.reverso);
    if (completed.length === 0) {
      showToast('No hay expedientes completos para exportar.', 'error');
      return;
    }
    try {
      setIsExporting(true);
      setExportStatusMessage('Comprimiendo archivos en ZIP...');
      await exportZipDocx(
        completed,
        (curr, tot) => {
          setExportStatusMessage(`Comprimiendo expediente ${curr} de ${tot}...`);
        },
        printSize
      );
      showToast('¡Carpeta ZIP generada con éxito!', 'success');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al exportar ZIP';
      showToast(msg, 'error');
    } finally {
      setIsExporting(false);
      setExportStatusMessage('');
    }
  };

  // Exportar directamente a carpeta de Windows
  const handleExportFolder = async () => {
    const completed = Object.values(slotsData).filter((s) => s.anverso && s.reverso);
    if (completed.length === 0) {
      showToast('No hay expedientes completos para exportar.', 'error');
      return;
    }
    try {
      setIsExporting(true);
      setExportStatusMessage('Selecciona la carpeta donde guardar los archivos...');
      const res = await exportToDirectoryFolder(
        completed,
        (msg) => setExportStatusMessage(msg),
        printSize
      );
      if (res.cancelled) {
        showToast('Operación cancelada');
      } else {
        showToast(`¡${res.count} archivos Word guardados exitosamente!`, 'success');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar en carpeta';
      showToast(msg, 'error');
    } finally {
      setIsExporting(false);
      setExportStatusMessage('');
    }
  };

  // Exportar directamente a ZIP con archivos PDF A4
  const handleExportPdfZip = async () => {
    const completed = Object.values(slotsData).filter((s) => s.anverso && s.reverso);
    if (completed.length === 0) {
      showToast('No hay expedientes completos para exportar.', 'error');
      return;
    }
    try {
      setIsExporting(true);
      setExportStatusMessage('Generando PDFs A4 milimétricos...');
      await exportPdfZip(
        completed,
        (curr, tot) => {
          setExportStatusMessage(`Generando PDF ${curr} de ${tot}...`);
        },
        printSize
      );
      showToast(`¡${completed.length} archivos PDF generados y descargados en ZIP!`, 'success');
      playSound('complete');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al exportar PDF';
      showToast(msg, 'error');
    } finally {
      setIsExporting(false);
      setExportStatusMessage('');
    }
  };

  // Manejador de Explorar Carpeta para Conversión a PDF
  const handlePickPdfFolder = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (!w.showDirectoryPicker) {
      showToast('Tu navegador no soporta el explorador de carpetas nativo. Usa Chrome o Edge.', 'error');
      return;
    }
    try {
      const handle = await w.showDirectoryPicker({
        id: 'dni_convert_pdf_folder',
        mode: 'readwrite'
      });
      setPdfDirHandle(handle);
      setPdfFolderPath(handle.name);
      setPdfSuccessDone(false);
      setPdfConvertedInfo(null);

      let count = 0;
      for await (const entry of handle.values()) {
        if (
          entry.kind === 'file' &&
          entry.name.toLowerCase().endsWith('.docx') &&
          !entry.name.startsWith('~$')
        ) {
          count++;
        }
      }
      setPdfScanCount(count);
      if (count === 0) {
        showToast(`No se encontraron archivos .docx en la carpeta "${handle.name}"`, 'info');
      } else {
        showToast(`${count} archivos Word (.docx) detectados en "${handle.name}"`, 'success');
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        showToast('Error al seleccionar carpeta: ' + (err?.message || ''), 'error');
      }
    }
  };

  // Iniciar la Conversión Real de DOCX a PDF y escribir directamente los archivos
  const handleStartPdfConversion = async () => {
    if (!pdfDirHandle) {
      showToast('Primero haz clic en "Examinar..." para seleccionar la carpeta donde están los Word', 'error');
      return;
    }
    if (pdfScanCount === 0) {
      showToast('La carpeta seleccionada no tiene archivos .docx válidos', 'error');
      return;
    }

    try {
      setPdfConverting(true);
      setPdfSuccessDone(false);
      setPdfConvertedInfo(null);
      setPdfProgressPercent(5);
      setPdfProgressMsg('Escaneando archivos Word (.docx)...');

      const result = await convertDocxFolderToPdf(
        pdfDirHandle,
        pdfDestOption === 'same',
        (curr, total, filename) => {
          const pct = Math.round((curr / total) * 100);
          setPdfProgressPercent(pct);
          setPdfProgressMsg(`Convirtiendo ${curr} de ${total}: ${filename}`);
        },
        printSize
      );

      setPdfProgressPercent(100);
      setPdfProgressMsg('¡Conversión finalizada con éxito!');
      setPdfConverting(false);
      setPdfSuccessDone(true);
      setPdfConvertedInfo({ total: result.total, dest: result.destFolder });
      playSound('complete');
      showToast(`¡${result.total} archivos PDF creados exitosamente en "${result.destFolder}"!`, 'success');
    } catch (err: any) {
      setPdfConverting(false);
      showToast(err.message || 'Error al convertir a PDF', 'error');
    }
  };

  // Limpiar todo el lote
  const handleClearAllData = async () => {
    if (confirm('¿ATENCIÓN: Estás seguro de borrar todos los expedientes y fotos? Esta acción no se puede deshacer.')) {
      await dniDb.clearAllSlots();
      setSlotsData({});
      setActiveSlotId(1);
      setShowConfigModal(false);
      showToast('Todos los datos han sido borrados', 'success');
    }
  };

  return (
    <div className="dni-matrix-theme">
      {/* 1. APP HEADER GLOBAL (Nombre a la izquierda, Acciones a la derecha) */}
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="3" />
              <line x1="6" y1="9" x2="10" y2="9" />
              <line x1="6" y1="12" x2="12" y2="12" />
              <line x1="6" y1="15" x2="8" y2="15" />
              <circle cx="16.5" cy="11.5" r="2.5" />
            </svg>
          </div>
          <div>
            <h1 className="brand-title">PROCESADOR DE DNI</h1>
            <span className="brand-subtitle">Gestión Masiva de DNI por Cupos (WhatsApp Web &rarr; Word / PDF A4)</span>
          </div>
        </div>

        {/* Controles Globales Rápidos */}
        <div className="header-actions">
          <button
            onClick={() => {
              const next = !soundEnabled;
              setSoundEnabled(next);
              dniDb.saveSetting('soundEnabled', next);
              showToast(next ? 'Sonido activado' : 'Sonido silenciado');
            }}
            className="icon-button"
            title={soundEnabled ? 'Silenciar sonidos' : 'Activar sonidos'}
          >
            {soundEnabled ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <line x1="23" y1="9" x2="17" y2="15"></line>
                <line x1="17" y1="9" x2="23" y2="15"></line>
              </svg>
            )}
          </button>

          <button onClick={() => setShowConfigModal(true)} className="btn btn-secondary" title="Ajustes de lote y cupos">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <span>Ajustes</span>
          </button>

          <button onClick={() => setShowPreviewModal(true)} className="btn btn-secondary" title="Vista de impresión A4">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
            <span>Vista A4</span>
          </button>

          <button onClick={() => setShowPdfModal(true)} className="btn btn-pdf-header" title="Convertir archivos Word a PDF">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="9" y1="15" x2="15" y2="15"></line>
            </svg>
            <span>Convertir a PDF</span>
          </button>
        </div>
      </header>

      {/* 2. CONTENEDOR PRINCIPAL: DOS PANELES */}
      <main className="main-workspace">
        {/* PANEL IZQUIERDO: EXPEDIENTE ACTIVO */}
        <section className="active-panel">
          {/* Cabecera del expediente activo */}
          <div className="active-header">
            <div className="active-badge-group">
              <span className="active-tag">EXPEDIENTE ACTIVO</span>
              <h2 className="active-number">#{padNum(activeSlotId)}</h2>
              <span
                className={`status-badge ${
                  activeStatus === 'ready'
                    ? 'status-ready'
                    : activeStatus === 'partial'
                    ? 'status-partial'
                    : 'status-empty'
                }`}
              >
                {activeStatus === 'ready'
                  ? 'COMPLETO (2/2)'
                  : activeStatus === 'partial'
                  ? '1 CARA (1/2)'
                  : 'VACÍO (0/2)'}
              </span>
            </div>

            <div className="active-metadata">
              <label className="metadata-label">DNI / Nombre (Opcional):</label>
              <input
                type="text"
                className="metadata-input"
                placeholder="Ej: 74839201 - Juan Perez"
                value={activeSlot.label || ''}
                onChange={(e) => updateSlot({ ...activeSlot, label: e.target.value })}
                maxLength={60}
              />
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '6px 10px', fontSize: '0.75rem' }}
                title="Vincular con Cliente / Guía WR de AMEX"
                onClick={() => setShowAmexLinkModal(true)}
              >
                ⚡ AMEX
              </button>
            </div>
          </div>

          {/* Área de Pegado y Simulación A4 */}
          <div className="sheet-simulation-wrapper">
            <div className="sheet-simulation-header">
              <span>
                Hoja A4 (21.0 &times; 29.7 cm) &bull; Tamaño DNI: <strong>{DNI_SIZE_PRESETS[printSize]?.widthCm || 16.5} &times; {DNI_SIZE_PRESETS[printSize]?.heightCm || 10.4} cm</strong> ({DNI_SIZE_PRESETS[printSize]?.id === 'large' ? 'Grande - Ocupa la hoja' : DNI_SIZE_PRESETS[printSize]?.id === 'xlarge' ? 'Extra Grande' : 'Estándar'})
              </span>
              <span className="tip-kbd">
                Portapapeles activo: Presiona <kbd>Ctrl+V</kbd> en cualquier momento
              </span>
            </div>

            <div
              className="sheet-surface"
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = 'copy';
              }}
              onDrop={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragHoverSide(null);
                const b64 = await extractBase64FromDataTransfer(e.dataTransfer);
                if (b64) {
                  await processImagePayload(b64, focusedSide);
                }
              }}
            >
              {/* CASILLA ANVERSO (SUPERIOR) */}
              <div
                className={`dni-dropzone ${activeSlot.anverso ? 'has-image' : ''} ${
                  focusedSide === 'anverso' ? 'active-target' : ''
                } ${dragHoverSide === 'anverso' ? 'drag-active' : ''}`}
                tabIndex={0}
                onClick={() => setFocusedSide('anverso')}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = 'copy';
                  if (dragHoverSide !== 'anverso') setDragHoverSide('anverso');
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragHoverSide('anverso');
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragHoverSide(null);
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragHoverSide(null);
                  const b64 = await extractBase64FromDataTransfer(e.dataTransfer);
                  if (b64) {
                    await processImagePayload(b64, 'anverso');
                  }
                }}
              >
                <div className="dropzone-header">
                  <div className="dropzone-title">
                    <span className="side-badge front">1</span>
                    <strong>ANVERSO (FRENTE)</strong>
                    <span className="dimension-tag">12.0 &times; 7.5 cm</span>
                  </div>
                  <div className="dropzone-actions">
                    <button
                      type="button"
                      className="action-btn"
                      title="Rotar 90° izquierda"
                      onClick={(e) => {
                        e.stopPropagation();
                        rotateSide('anverso', 270);
                      }}
                    >
                      ↺
                    </button>
                    <button
                      type="button"
                      className="action-btn"
                      title="Rotar 90° derecha"
                      onClick={(e) => {
                        e.stopPropagation();
                        rotateSide('anverso', 90);
                      }}
                    >
                      ↻
                    </button>
                    <button
                      type="button"
                      className="action-btn danger"
                      title="Eliminar anverso"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearSide('anverso');
                      }}
                    >
                      &times;
                    </button>
                  </div>
                </div>

                {activeSlot.anverso ? (
                  <div className="dropzone-preview">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activeSlot.anverso}
                      alt="Anverso"
                      style={{
                        transform: `rotate(${activeSlot.anversoRotation || 0}deg)`
                      }}
                    />
                  </div>
                ) : (
                  <div className="dropzone-placeholder">
                    <div className="placeholder-icon">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M16 16v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1" />
                        <rect x="8" y="3" width="12" height="14" rx="2" />
                        <path d="M12 8v4" />
                        <path d="M10 10h4" />
                      </svg>
                    </div>
                    <div className="placeholder-text">
                      <span className="placeholder-main">
                        Haz clic o pega el <strong>Anverso</strong> aquí
                      </span>
                      <span className="placeholder-sub">
                        Copia en WhatsApp Web &rarr; presiona <kbd>Ctrl + V</kbd>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* BOTÓN CENTRAL DE INTERCAMBIO */}
              <div className="swap-bar">
                <div className="swap-line"></div>
                <button
                  type="button"
                  className="btn-swap"
                  onClick={swapSides}
                  title="Intercambiar Anverso y Reverso si se pegaron invertidos"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M7 16V4m0 0L3 8m4-4l4 4m6 4v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                  <span>Intercambiar Caras</span>
                </button>
                <div className="swap-line"></div>
              </div>

              {/* CASILLA REVERSO (INFERIOR) */}
              <div
                className={`dni-dropzone ${activeSlot.reverso ? 'has-image' : ''} ${
                  focusedSide === 'reverso' ? 'active-target' : ''
                } ${dragHoverSide === 'reverso' ? 'drag-active' : ''}`}
                tabIndex={0}
                onClick={() => setFocusedSide('reverso')}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = 'copy';
                  if (dragHoverSide !== 'reverso') setDragHoverSide('reverso');
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragHoverSide('reverso');
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragHoverSide(null);
                }}
                onDrop={async (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragHoverSide(null);
                  const b64 = await extractBase64FromDataTransfer(e.dataTransfer);
                  if (b64) {
                    await processImagePayload(b64, 'reverso');
                  }
                }}
              >
                <div className="dropzone-header">
                  <div className="dropzone-title">
                    <span className="side-badge back">2</span>
                    <strong>REVERSO (POSTERIOR)</strong>
                    <span className="dimension-tag">12.0 &times; 7.5 cm</span>
                  </div>
                  <div className="dropzone-actions">
                    <button
                      type="button"
                      className="action-btn"
                      title="Rotar 90° izquierda"
                      onClick={(e) => {
                        e.stopPropagation();
                        rotateSide('reverso', 270);
                      }}
                    >
                      ↺
                    </button>
                    <button
                      type="button"
                      className="action-btn"
                      title="Rotar 90° derecha"
                      onClick={(e) => {
                        e.stopPropagation();
                        rotateSide('reverso', 90);
                      }}
                    >
                      ↻
                    </button>
                    <button
                      type="button"
                      className="action-btn danger"
                      title="Eliminar reverso"
                      onClick={(e) => {
                        e.stopPropagation();
                        clearSide('reverso');
                      }}
                    >
                      &times;
                    </button>
                  </div>
                </div>

                {activeSlot.reverso ? (
                  <div className="dropzone-preview">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activeSlot.reverso}
                      alt="Reverso"
                      style={{
                        transform: `rotate(${activeSlot.reversoRotation || 0}deg)`
                      }}
                    />
                  </div>
                ) : (
                  <div className="dropzone-placeholder">
                    <div className="placeholder-icon">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M16 16v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1" />
                        <rect x="8" y="3" width="12" height="14" rx="2" />
                        <path d="M12 8v4" />
                        <path d="M10 10h4" />
                      </svg>
                    </div>
                    <div className="placeholder-text">
                      <span className="placeholder-main">
                        Haz clic o pega el <strong>Reverso</strong> aquí
                      </span>
                      <span className="placeholder-sub">
                        Copia en WhatsApp Web &rarr; presiona <kbd>Ctrl + V</kbd>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Barra de Navegación del Expediente Activo */}
          <div className="active-nav-bar">
            <button
              className="btn btn-secondary nav-btn"
              disabled={activeSlotId <= 1}
              onClick={() => {
                if (activeSlotId > 1) {
                  playSound('click');
                  setActiveSlotId((prev) => prev - 1);
                }
              }}
              title="Ir al cupo anterior (Flecha Izquierda)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
              <span>
                Anterior <kbd>&larr;</kbd>
              </span>
            </button>

            <div className="nav-center-info">
              <span>
                Cupo {activeSlotId} de {totalSlots}
              </span>
            </div>

            <button
              className="btn btn-secondary nav-btn"
              disabled={activeSlotId >= totalSlots}
              onClick={() => {
                if (activeSlotId < totalSlots) {
                  playSound('click');
                  setActiveSlotId((prev) => prev + 1);
                }
              }}
              title="Ir al siguiente cupo (Flecha Derecha)"
            >
              <span>
                Siguiente <kbd>&rarr;</kbd>
              </span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>

            <button
              className="btn btn-success nav-btn-cta"
              onClick={jumpToNextIncompleteSlot}
              title="Saltar de inmediato al próximo cupo vacío o incompleto (Enter)"
            >
              <span className="pulse-dot"></span>
              <span>
                Siguiente Incompleto <kbd>Enter ⏎</kbd>
              </span>
            </button>
          </div>
        </section>

        {/* PANEL DERECHO: MATRIZ DE CUPOS */}
        <aside className="matrix-panel">
          <div className="matrix-header">
            <div className="matrix-title-row">
              <div className="matrix-heading">
                <h3>MATRIZ DE CUPOS</h3>
                <span className="matrix-subtitle">Control Visual de Calidad</span>
              </div>

              {/* Filtro de vista */}
              <div className="matrix-filter-group">
                <button
                  className={`filter-chip ${currentFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setCurrentFilter('all')}
                >
                  Todos
                </button>
                <button
                  className={`filter-chip ${currentFilter === 'ready' ? 'active' : ''}`}
                  onClick={() => setCurrentFilter('ready')}
                >
                  Listos ({stats.ready})
                </button>
                <button
                  className={`filter-chip ${currentFilter === 'partial' ? 'active' : ''}`}
                  onClick={() => setCurrentFilter('partial')}
                >
                  1/2 ({stats.partial})
                </button>
                <button
                  className={`filter-chip ${currentFilter === 'empty' ? 'active' : ''}`}
                  onClick={() => setCurrentFilter('empty')}
                >
                  Vacíos ({stats.empty})
                </button>
              </div>
            </div>

            {/* MÉTRICAS COMPACTAS ADAPTADAS DEBAJO DEL NOMBRE */}
            <div className="matrix-stats-widget">
              <div className="matrix-stats-pills">
                <div className="mstat-pill total">
                  <span className="mstat-lbl">TOTAL</span>
                  <span className="mstat-num">{totalSlots}</span>
                </div>
                <div className="mstat-pill ready">
                  <span className="stat-indicator"></span>
                  <span className="mstat-lbl">COMPLETOS</span>
                  <span className="mstat-num">{stats.ready}</span>
                </div>
                <div className="mstat-pill partial">
                  <span className="stat-indicator"></span>
                  <span className="mstat-lbl">INCOMPLETOS</span>
                  <span className="mstat-num">{stats.partial}</span>
                </div>
                <div className="mstat-pill empty">
                  <span className="stat-indicator"></span>
                  <span className="mstat-lbl">VACÍOS</span>
                  <span className="mstat-num">{stats.empty}</span>
                </div>
              </div>

              {/* Barra de Progreso del Lote */}
              <div className="matrix-progress-row" title="Progreso del lote">
                <span className="mprog-pct">{progressPercent}%</span>
                <div className="mprog-track">
                  <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
                </div>
              </div>
            </div>

            {/* Leyenda y Búsqueda directa */}
            <div className="matrix-toolbar">
              <div className="matrix-legend">
                <span className="legend-item">
                  <span className="badge-dot green"></span> Completo
                </span>
                <span className="legend-item">
                  <span className="badge-dot amber"></span> 1 cara
                </span>
                <span className="legend-item">
                  <span className="badge-dot gray"></span> Vacío
                </span>
              </div>

              <div className="quick-jump">
                <input
                  type="number"
                  min="1"
                  max={totalSlots}
                  placeholder="# Cupo"
                  value={quickJumpVal}
                  onChange={(e) => setQuickJumpVal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = parseInt(quickJumpVal, 10);
                      if (!isNaN(val) && val >= 1 && val <= totalSlots) {
                        setActiveSlotId(val);
                        setQuickJumpVal('');
                      }
                    }
                  }}
                  title="Escribe un número y presiona Enter para saltar"
                />
              </div>
            </div>
          </div>

          {/* Cuadrícula de la Matriz */}
          <div className="matrix-grid-scroll">
            <div className="matrix-grid">
              {filteredSlotIds.map((id) => {
                const s = slotsData[id];
                const st = getSlotStatus(s);
                const isActive = id === activeSlotId;

                const stateClass =
                  st === 'ready'
                    ? 'state-ready'
                    : st === 'partial'
                    ? 'state-partial'
                    : 'state-empty';

                return (
                  <div
                    key={id}
                    className={`slot-cell ${stateClass} ${isActive ? 'active-slot' : ''}`}
                    onClick={() => {
                      playSound('click');
                      setActiveSlotId(id);
                      setFocusedSide(null);
                    }}
                  >
                    <span className="slot-num">#{padNum(id)}</span>
                    <span className="slot-status-icon">
                      {st === 'ready' ? '✓' : st === 'partial' ? '1/2' : '··'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECCIÓN DE EXPORTACIÓN INMEDIATA */}
          <div className="matrix-export-card">
            <div className="export-card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="12" y1="18" x2="12" y2="12"></line>
                <line x1="9" y1="15" x2="12" y2="18"></line>
                <line x1="15" y1="15" x2="12" y2="18"></line>
              </svg>
              <strong>GENERAR DOCUMENTOS WORD (A4)</strong>
            </div>

            <p className="export-summary-text">
              Hay <strong>{stats.ready} expedientes completos</strong> listos para exportar ({stats.ready} páginas A4).
            </p>

            <div className="export-buttons-stack">
              {/* Botón Principal: Escoger Carpeta donde Guardar */}
              <button
                className="btn btn-success btn-export btn-export-main"
                disabled={isExporting || stats.ready === 0}
                onClick={handleExportFolder}
                title="Haz clic para elegir una carpeta en tu equipo y guardar todos los archivos Word sueltos sin comprimir"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                  <polyline points="12 11 12 17 15 14"></polyline>
                  <line x1="9" y1="14" x2="12" y2="17"></line>
                </svg>
                <div className="btn-text-block">
                  <span className="btn-title">Escoger Carpeta donde Guardar</span>
                  <span className="btn-desc">Guarda los Word sueltos directamente (Sin comprimir)</span>
                </div>
              </button>

              <div className="export-buttons-grid">
                {/* Opción 2: Archivo Maestro Único */}
                <button
                  className="btn btn-primary btn-export"
                  disabled={isExporting || stats.ready === 0}
                  onClick={handleExportMaster}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                  </svg>
                  <div className="btn-text-block">
                    <span className="btn-title">Word Maestro Único</span>
                    <span className="btn-desc">1 archivo con todas las hojas</span>
                  </div>
                </button>

                {/* Opción 3: Descargar ZIP Word */}
                <button
                  className="btn btn-secondary btn-export"
                  disabled={isExporting || stats.ready === 0}
                  onClick={handleExportZip}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="21 8 21 21 3 21 3 8"></polyline>
                    <rect x="1" y="3" width="22" height="5"></rect>
                    <line x1="10" y1="12" x2="14" y2="12"></line>
                  </svg>
                  <div className="btn-text-block">
                    <span className="btn-title">Descargar en ZIP</span>
                    <span className="btn-desc">Archivos .docx comprimidos</span>
                  </div>
                </button>

                {/* Opción 4: Descargar en PDF (.zip) */}
                <button
                  className="btn btn-export"
                  style={{
                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.18) 0%, rgba(220, 38, 38, 0.25) 100%)',
                    borderColor: 'rgba(239, 68, 68, 0.45)',
                    color: '#fca5a5'
                  }}
                  disabled={isExporting || stats.ready === 0}
                  onClick={handleExportPdfZip}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="9" y1="15" x2="15" y2="15"></line>
                  </svg>
                  <div className="btn-text-block">
                    <span className="btn-title" style={{ color: '#ffffff' }}>Descargar en PDF (.zip)</span>
                    <span className="btn-desc" style={{ color: '#fca5a5' }}>Archivos .pdf directos</span>
                  </div>
                </button>
              </div>
            </div>

            <div
              className="pdf-quick-banner"
              style={{
                marginTop: '10px',
                paddingTop: '10px',
                borderTop: '1px dashed var(--border-subtle)'
              }}
            >
              <button
                className="btn btn-secondary"
                style={{ width: '100%', borderColor: 'rgba(239, 68, 68, 0.35)', color: '#fca5a5' }}
                type="button"
                onClick={() => setShowPdfModal(true)}
                title="Convertir una carpeta existente de archivos Word a PDF"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="9" y1="15" x2="15" y2="15"></line>
                </svg>
                <span>Conversor Masivo DOCX a PDF</span>
              </button>
            </div>

            {/* Indicador de procesamiento */}
            {isExporting && (
              <div className="export-loading">
                <div className="spinner"></div>
                <span>{exportStatusMessage || 'Generando documento...'}</span>
              </div>
            )}
          </div>
        </aside>
      </main>

      {/* MODAL: AJUSTES Y CONFIGURACIÓN */}
      {showConfigModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Configuración de Lote y Cupos</h3>
              <button onClick={() => setShowConfigModal(false)} className="modal-close-btn">
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Cantidad total de cupos en la matriz:</label>
                <select
                  value={totalSlots}
                  onChange={async (e) => {
                    const count = Number(e.target.value);
                    setTotalSlots(count);
                    await dniDb.saveSetting('totalSlots', count);
                  }}
                  className="form-select"
                >
                  <option value="50">50 Cupos (#001 a #050)</option>
                  <option value="100">100 Cupos (#001 a #100) (Estándar)</option>
                  <option value="200">200 Cupos (#001 a #200)</option>
                  <option value="300">300 Cupos (#001 a #300)</option>
                  <option value="500">500 Cupos (#001 a #500)</option>
                  <option value="1000">1000 Cupos (#0001 a #1000)</option>
                </select>
                <small>Si cambias el número, los expedientes ya cargados dentro del rango se conservan.</small>
              </div>

              <hr className="modal-divider" />

              {/* Selector de Tamaño de DNI en Word y PDF */}
              <div className="form-group">
                <label className="font-bold" style={{ color: 'var(--accent-cyan)' }}>
                  📐 Tamaño de los DNI en la Hoja Word y PDF:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      cursor: 'pointer',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: printSize === 'large' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                      border: printSize === 'large' ? '1.5px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)'
                    }}
                  >
                    <input
                      type="radio"
                      name="printSizeOption"
                      checked={printSize === 'large'}
                      onChange={async () => {
                        setPrintSize('large');
                        await dniDb.saveSetting('dniPrintSize', 'large');
                        showToast('Tamaño Grande (16.5 × 10.4 cm) guardado', 'success');
                      }}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#f8fafc' }}>
                        Grande (16.5 &times; 10.4 cm) <span className="badge badge-ready" style={{ marginLeft: '6px' }}>Recomendado</span>
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px' }}>
                        Ocupa la mayor parte de la hoja A4 sin dejar espacios vacíos exagerados. Información y sellos del DNI 100% nítidos y legibles (1 sola página exacta).
                      </div>
                    </div>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      cursor: 'pointer',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: printSize === 'xlarge' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                      border: printSize === 'xlarge' ? '1.5px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)'
                    }}
                  >
                    <input
                      type="radio"
                      name="printSizeOption"
                      checked={printSize === 'xlarge'}
                      onChange={async () => {
                        setPrintSize('xlarge');
                        await dniDb.saveSetting('dniPrintSize', 'xlarge');
                        showToast('Tamaño Extra Grande (17.5 × 11.0 cm) guardado', 'success');
                      }}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#f8fafc' }}>
                        Extra Grande (17.5 &times; 11.0 cm)
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px' }}>
                        Ocupación máxima de margen a margen (1.5 cm) en la hoja A4 para casos donde se requiere ver cada detalle microscópico.
                      </div>
                    </div>
                  </label>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                      cursor: 'pointer',
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: printSize === 'standard' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                      border: printSize === 'standard' ? '1.5px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)'
                    }}
                  >
                    <input
                      type="radio"
                      name="printSizeOption"
                      checked={printSize === 'standard'}
                      onChange={async () => {
                        setPrintSize('standard');
                        await dniDb.saveSetting('dniPrintSize', 'standard');
                        showToast('Tamaño Estándar (12.0 × 7.5 cm) guardado', 'info');
                      }}
                      style={{ marginTop: '3px' }}
                    />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#f8fafc' }}>
                        Estándar (12.0 &times; 7.5 cm)
                      </div>
                      <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px' }}>
                        Medida reglamentaria tradicional más pequeña, centrada en la hoja con amplios márgenes alrededor.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              <hr className="modal-divider" />

              <div className="form-group">
                <label className="text-danger font-bold">Zona de Peligro:</label>
                <p className="text-muted" style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                  Borra todos los DNIs, números y fotos guardadas en este navegador para iniciar un nuevo lote de trabajo.
                </p>
                <button
                  type="button"
                  onClick={handleClearAllData}
                  className="btn btn-secondary"
                  style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#f87171', marginTop: '8px' }}
                >
                  🗑️ Borrar Todos los Datos del Lote
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowConfigModal(false)} className="btn btn-secondary">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VISTA PREVIA HOJA A4 REAL */}
      {showPreviewModal && (
        <div className="modal-overlay">
          <div className="modal-card modal-large">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3>Vista Previa Impresión A4</h3>
                <span className="badge badge-ready">Expediente #{padNum(activeSlotId)}</span>
                <span className="badge badge-partial">
                  {DNI_SIZE_PRESETS[printSize]?.widthCm} &times; {DNI_SIZE_PRESETS[printSize]?.heightCm} cm
                </span>
              </div>
              <button onClick={() => setShowPreviewModal(false)} className="modal-close-btn">
                &times;
              </button>
            </div>
            <div className="modal-body" style={{ textAlign: 'center', background: '#0a0d14', padding: '24px' }}>
              <div
                style={{
                  display: 'inline-block',
                  background: '#ffffff',
                  color: '#000000',
                  width: '320px',
                  height: '452px',
                  padding: printSize === 'large' ? '16px 14px' : printSize === 'xlarge' ? '14px 10px' : '24px 20px',
                  boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
                  borderRadius: '4px',
                  position: 'relative'
                }}
              >
                {/* Cuadre Anverso */}
                <div
                  style={{
                    width: '100%',
                    height: printSize === 'large' ? '165px' : printSize === 'xlarge' ? '175px' : '140px',
                    border: '1.5px dashed #94a3b8',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    background: '#f8fafc'
                  }}
                >
                  {activeSlot.anverso ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={activeSlot.anverso}
                      alt="Anverso"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        transform: `rotate(${activeSlot.anversoRotation || 0}deg)`
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      Anverso ({DNI_SIZE_PRESETS[printSize]?.widthCm} &times; {DNI_SIZE_PRESETS[printSize]?.heightCm} cm)
                    </span>
                  )}
                </div>

                {/* Separador */}
                <div
                  style={{
                    margin: printSize === 'large' ? '14px 0' : printSize === 'xlarge' ? '10px 0' : '24px 0',
                    borderTop: '1px dotted #cbd5e1',
                    position: 'relative'
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: '-9px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#fff',
                      padding: '0 8px',
                      fontSize: '9px',
                      color: '#94a3b8'
                    }}
                  >
                    Separación {printSize === 'large' ? '1.2 cm' : printSize === 'xlarge' ? '0.9 cm' : '2.5 cm'}
                  </span>
                </div>

                {/* Cuadre Reverso */}
                <div
                  style={{
                    width: '100%',
                    height: printSize === 'large' ? '165px' : printSize === 'xlarge' ? '175px' : '140px',
                    border: '1.5px dashed #94a3b8',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    background: '#f8fafc'
                  }}
                >
                  {activeSlot.reverso ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={activeSlot.reverso}
                      alt="Reverso"
                      style={{
                        maxWidth: '100%',
                        maxHeight: '100%',
                        objectFit: 'contain',
                        transform: `rotate(${activeSlot.reversoRotation || 0}deg)`
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                      Reverso ({DNI_SIZE_PRESETS[printSize]?.widthCm} &times; {DNI_SIZE_PRESETS[printSize]?.heightCm} cm)
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                Medidas exactas para impresión física en hoja A4 (21.0 &times; 29.7 cm). Tamaño actual: {DNI_SIZE_PRESETS[printSize]?.widthCm} &times; {DNI_SIZE_PRESETS[printSize]?.heightCm} cm.
              </span>
              <button onClick={() => setShowPreviewModal(false)} className="btn btn-secondary">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CONVERSOR DOCX A PDF */}
      {showPdfModal && (
        <div className="modal-overlay">
          <div className="modal-card modal-large">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3>Conversor Masivo de Word (.docx) a PDF</h3>
                <span
                  style={{
                    background: 'rgba(16, 185, 129, 0.2)',
                    color: '#34d399',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 700
                  }}
                >
                  Motor Directo A4
                </span>
              </div>
              <button onClick={() => setShowPdfModal(false)} className="modal-close-btn">
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label font-bold">1. Carpeta con los archivos Word (.docx):</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <input
                    type="text"
                    className="metadata-input"
                    style={{ flex: 1 }}
                    readOnly
                    placeholder="Haz clic en Examinar para seleccionar tu carpeta..."
                    value={pdfFolderPath}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handlePickPdfFolder}
                  >
                    Examinar...
                  </button>
                </div>
              </div>

              {pdfScanCount !== null && (
                <div className="pdf-scan-badge" style={{ marginBottom: '14px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  <span>
                    <strong>{pdfScanCount}</strong> archivos Word (.docx) detectados en esta carpeta.
                  </span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label font-bold">2. Destino de los PDFs generados:</label>
                <div className="radio-option-group">
                  <label className="radio-label">
                    <input
                      type="radio"
                      name="pdf-dest"
                      checked={pdfDestOption === 'subfolder'}
                      onChange={() => setPdfDestOption('subfolder')}
                    />
                    <span>
                      Crear una subcarpeta <code>PDFs/</code> dentro de esa misma carpeta (Recomendado)
                    </span>
                  </label>
                  <label className="radio-label" style={{ marginTop: '8px' }}>
                    <input
                      type="radio"
                      name="pdf-dest"
                      checked={pdfDestOption === 'same'}
                      onChange={() => setPdfDestOption('same')}
                    />
                    <span>Guardar en la misma carpeta (junto a los archivos Word)</span>
                  </label>
                </div>
              </div>

              {pdfConverting && (
                <div className="pdf-progress-card">
                  <div className="pdf-progress-header">
                    <span>{pdfProgressMsg}</span>
                    <span className="pdf-progress-num">{pdfProgressPercent}%</span>
                  </div>
                  <div className="progress-bar-bg" style={{ width: '100%', marginTop: '8px' }}>
                    <div className="progress-fill" style={{ width: `${pdfProgressPercent}%` }}></div>
                  </div>
                </div>
              )}

              {pdfSuccessDone && (
                <div className="pdf-success-card">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                  </svg>
                  <div>
                    <h4 style={{ margin: 0, color: '#34d399', fontSize: '0.9rem' }}>¡Conversión a PDF Finalizada con Éxito!</h4>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                      Se han creado {pdfConvertedInfo?.total || pdfScanCount} archivos .pdf dentro de: <strong>{pdfConvertedInfo?.dest || 'la carpeta seleccionada'}</strong>.
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <span className="text-muted" style={{ fontSize: '0.74rem' }}>
                💡 Convierte los Word a PDF A4 con medidas exactas (12 &times; 7.5 cm) y guarda los archivos directamente en tu equipo.
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-pdf-header"
                  disabled={pdfConverting || !pdfDirHandle || pdfScanCount === 0}
                  onClick={handleStartPdfConversion}
                >
                  {pdfConverting ? 'Convirtiendo...' : 'Iniciar Conversión a PDF'}
                </button>
                <button onClick={() => setShowPdfModal(false)} className="btn btn-secondary">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: VINCULAR CON CLIENTE O GUÍA AMEX */}
      {showAmexLinkModal && (
        <div className="modal-overlay">
          <div className="modal-card">
            <div className="modal-header">
              <h3>Vincular Cupo #{padNum(activeSlotId)} con AMEX</h3>
              <button onClick={() => setShowAmexLinkModal(false)} className="modal-close-btn">
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Seleccionar Cliente Registrado:</label>
                <select
                  className="form-select"
                  defaultValue=""
                  onChange={(e) => {
                    const cl = clientes.find((c) => c.id === e.target.value);
                    if (cl) {
                      updateSlot({
                        ...activeSlot,
                        clienteId: cl.id,
                        label: `${cl.documentoIdentidad || ''} - ${cl.nombre}`
                      });
                      setShowAmexLinkModal(false);
                      showToast(`Vinculado con ${cl.nombre}`, 'success');
                    }
                  }}
                >
                  <option value="" disabled>
                    Selecciona un cliente de la base de datos...
                  </option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.documentoIdentidad ? `[DNI ${c.documentoIdentidad}] ` : ''}
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>O Seleccionar por Guía WR:</label>
                <select
                  className="form-select"
                  defaultValue=""
                  onChange={(e) => {
                    const p = paquetes.find((pkg) => pkg.id === e.target.value);
                    if (p) {
                      updateSlot({
                        ...activeSlot,
                        paqueteId: p.id,
                        label: `${p.numeroReciboBodega} - ${p.nombreConsignatario || p.dniConsignatario || ''}`
                      });
                      setShowAmexLinkModal(false);
                      showToast(`Vinculado con WR ${p.numeroReciboBodega}`, 'success');
                    }
                  }}
                >
                  <option value="" disabled>
                    Selecciona un paquete en bodega...
                  </option>
                  {paquetes.slice(0, 100).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.numeroReciboBodega} - {p.nombreConsignatario || p.dniConsignatario || 'Sin nombre'}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowAmexLinkModal(false)} className="btn btn-secondary">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST CONTAINER FLOTANTE */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
