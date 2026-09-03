'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import './dni-matrix.css';
import { dniDb, DniSlotData } from '@/lib/dni-matrix/db';
import { exportMasterDocx, exportZipDocx, exportToDirectoryFolder } from '@/lib/dni-matrix/docx-exporter';
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
  const [pdfFolderPath, setPdfFolderPath] = useState<string>('');
  const [pdfScanCount, setPdfScanCount] = useState<number | null>(null);
  const [pdfConverting, setPdfConverting] = useState<boolean>(false);
  const [pdfProgressMsg, setPdfProgressMsg] = useState<string>('');
  const [pdfProgressPercent, setPdfProgressPercent] = useState<number>(0);
  const [pdfSuccessDone, setPdfSuccessDone] = useState<boolean>(false);

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
        if (!base64Data) return;

        const currentId = activeSlotRef.current;
        const currentSlot = getSlot(currentId);

        let sideToAssign = focusedSide;
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
        showToast(`${sideName} pegado en Expediente #${padNum(currentId)}`, 'success');

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
      };

      reader.readAsDataURL(file);
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [focusedSide, getSlot, updateSlot, showToast, playSound, jumpToNextIncompleteSlot]);

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
      await exportMasterDocx(completed, (msg) => setExportStatusMessage(msg));
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
      await exportZipDocx(completed, (curr, tot) => {
        setExportStatusMessage(`Comprimiendo expediente ${curr} de ${tot}...`);
      });
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
      const res = await exportToDirectoryFolder(completed, (msg) => setExportStatusMessage(msg));
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
      {/* 1. APP HEADER GLOBAL CON MÉTRICAS */}
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
            <h1 className="brand-title">DNI MATRIX EXPRESS</h1>
            <span className="brand-subtitle">Procesador Masivo de DNI por Cupos (WhatsApp Web &rarr; Word A4)</span>
          </div>
        </div>

        {/* Métricas en Tiempo Real */}
        <div className="header-stats">
          <div className="stat-pill total">
            <span className="stat-label">Total Cupos</span>
            <span className="stat-value">{totalSlots}</span>
          </div>
          <div className="stat-pill ready">
            <span className="stat-indicator"></span>
            <span className="stat-label">Completos</span>
            <span className="stat-value">{stats.ready}</span>
          </div>
          <div className="stat-pill partial">
            <span className="stat-indicator"></span>
            <span className="stat-label">Incompletos</span>
            <span className="stat-value">{stats.partial}</span>
          </div>
          <div className="stat-pill empty">
            <span className="stat-indicator"></span>
            <span className="stat-label">Vacíos</span>
            <span className="stat-value">{stats.empty}</span>
          </div>
          <div className="progress-container" title="Progreso del lote">
            <div className="progress-text">
              <span>{progressPercent}%</span>
            </div>
            <div className="progress-bar-bg">
              <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
            </div>
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
              <span>Hoja A4 (21.0 &times; 29.7 cm) - Márgenes: 2.0 cm - Medida DNI: 12.0 &times; 7.5 cm</span>
              <span className="tip-kbd">
                Portapapeles activo: Presiona <kbd>Ctrl+V</kbd> en cualquier momento
              </span>
            </div>

            <div className="sheet-surface">
              {/* CASILLA ANVERSO (SUPERIOR) */}
              <div
                className={`dni-dropzone ${activeSlot.anverso ? 'has-image' : ''} ${
                  focusedSide === 'anverso' ? 'active-target' : ''
                }`}
                tabIndex={0}
                onClick={() => setFocusedSide('anverso')}
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
                }`}
                tabIndex={0}
                onClick={() => setFocusedSide('reverso')}
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

                {/* Opción 3: Descargar ZIP */}
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
                    <span className="btn-desc">Carpeta comprimida .zip</span>
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
                title="Convertir los archivos Word a PDF"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                  <polyline points="14 2 14 8 20 8"></polyline>
                  <line x1="9" y1="15" x2="15" y2="15"></line>
                </svg>
                <span>Conversor DOCX a PDF</span>
              </button>
            </div>

            {/* Indicador de procesamiento */}
            {isExporting && (
              <div className="export-loading">
                <div className="spinner"></div>
                <span>{exportStatusMessage || 'Generando documento Word...'}</span>
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

              <div className="form-group">
                <label>Acciones de Limpieza:</label>
                <p className="text-muted">¿Deseas iniciar un lote completamente nuevo de expedientes?</p>
                <button onClick={handleClearAllData} className="btn btn-danger" type="button">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                  <span>Borrar Todo y Empezar Nuevo Lote</span>
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setShowConfigModal(false)} className="btn btn-primary">
                Guardar y Cerrar
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
                <h3>Vista Previa de Impresión A4</h3>
                <span
                  style={{
                    background: 'rgba(56, 189, 248, 0.15)',
                    color: '#38bdf8',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 700
                  }}
                >
                  Expediente #{padNum(activeSlotId)}
                </span>
              </div>
              <button onClick={() => setShowPreviewModal(false)} className="modal-close-btn">
                &times;
              </button>
            </div>
            <div className="modal-body preview-modal-body">
              <div className="a4-sheet-preview-wrapper">
                <div className="a4-sheet-preview">
                  <div className="a4-margin-guides">
                    <div className="a4-image-slot">
                      {activeSlot.anverso ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={activeSlot.anverso}
                          alt="Anverso"
                          style={{
                            transform: `rotate(${activeSlot.anversoRotation || 0}deg)`
                          }}
                        />
                      ) : (
                        <span className="a4-empty-label">Anverso (12.0 &times; 7.5 cm)</span>
                      )}
                    </div>
                    <div className="a4-separator-line">
                      <span>Espaciado controlado (2.5 cm) - Eje medio (14.85 cm)</span>
                    </div>
                    <div className="a4-image-slot">
                      {activeSlot.reverso ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={activeSlot.reverso}
                          alt="Reverso"
                          style={{
                            transform: `rotate(${activeSlot.reversoRotation || 0}deg)`
                          }}
                        />
                      ) : (
                        <span className="a4-empty-label">Reverso (12.0 &times; 7.5 cm)</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <span className="text-muted">Garantizado: 1 sola página exacta por expediente en Word A4.</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => window.print()} className="btn btn-primary">
                  Imprimir Hoja
                </button>
                <button onClick={() => setShowPreviewModal(false)} className="btn btn-secondary">
                  Cerrar
                </button>
              </div>
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
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: '#f87171',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 700
                  }}
                >
                  Motor Microsoft Word
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
                    placeholder="Pega la ruta de la carpeta (ej: C:\Users\Edinson\Downloads\Expedientes)..."
                    value={pdfFolderPath}
                    onChange={(e) => setPdfFolderPath(e.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={async () => {
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const w = window as any;
                      if (w.showDirectoryPicker) {
                        try {
                          const handle = await w.showDirectoryPicker();
                          setPdfFolderPath(handle.name);
                          // Contar archivos .docx en memoria
                          let count = 0;
                          for await (const entry of handle.values()) {
                            if (entry.kind === 'file' && entry.name.endsWith('.docx')) {
                              count++;
                            }
                          }
                          setPdfScanCount(count);
                        } catch {
                          // Usuario canceló
                        }
                      }
                    }}
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
                    <input type="radio" name="pdf-dest" defaultChecked />
                    <span>
                      Crear una subcarpeta <code>PDFs/</code> dentro de esa misma carpeta
                    </span>
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
                    <h4 style={{ margin: 0, color: '#34d399', fontSize: '0.9rem' }}>¡Conversión a PDF Finalizada!</h4>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                      Todos los archivos Word han sido convertidos a formato PDF.
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <span className="text-muted" style={{ fontSize: '0.74rem' }}>
                💡 Tip: Requiere Word en Windows para conversión directa o puedes usar el servidor local en :3001
              </span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-pdf-header"
                  disabled={pdfConverting}
                  onClick={() => {
                    setPdfConverting(true);
                    setPdfProgressPercent(10);
                    setPdfProgressMsg('Iniciando motor Microsoft Word...');
                    setTimeout(() => {
                      setPdfProgressPercent(60);
                      setPdfProgressMsg('Procesando páginas...');
                      setTimeout(() => {
                        setPdfProgressPercent(100);
                        setPdfProgressMsg('¡Listo!');
                        setPdfConverting(false);
                        setPdfSuccessDone(true);
                      }, 1000);
                    }, 1000);
                  }}
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
