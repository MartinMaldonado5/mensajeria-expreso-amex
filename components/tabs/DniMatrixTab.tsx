'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  IdCard,
  FileText,
  Archive,
  Printer,
  Trash2,
  Search,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  Volume2,
  VolumeX,
  Plus,
  Eye,
  Settings,
  ArrowRight,
  ArrowLeft,
  ChevronRight,
  Download,
  Link as LinkIcon,
  Sparkles
} from 'lucide-react';
import { dniDb, DniSlotData } from '@/lib/dni-matrix/db';
import { exportMasterDocx, exportZipDocx } from '@/lib/dni-matrix/docx-exporter';
import { Paquete, Cliente } from '@/types';

interface DniMatrixTabProps {
  paquetes?: Paquete[];
  clientes?: Cliente[];
}

export default function DniMatrixTab({ paquetes = [], clientes = [] }: DniMatrixTabProps) {
  // Estado general
  const [totalSlots, setTotalSlots] = useState<number>(100);
  const [activeSlotId, setActiveSlotId] = useState<number>(1);
  const [focusedSide, setFocusedSide] = useState<'anverso' | 'reverso' | null>(null);
  const [slotsData, setSlotsData] = useState<Record<number, DniSlotData>>({});
  const [filter, setFilter] = useState<'all' | 'ready' | 'partial' | 'empty'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<string>('');
  const [previewSlot, setPreviewSlot] = useState<DniSlotData | null>(null);
  const [showConfigModal, setShowConfigModal] = useState<boolean>(false);
  const [associateModalSlot, setAssociateModalSlot] = useState<DniSlotData | null>(null);

  const activeSlotRef = useRef<number>(activeSlotId);
  activeSlotRef.current = activeSlotId;

  // ==========================================================================
  // FEEDBACK AUDITIVO (Web Audio API - Sin archivos externos)
  // ==========================================================================
  const playSound = useCallback((type: 'success' | 'paste' | 'error') => {
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

      if (type === 'success') {
        // Doble tono agudo armónico para éxito
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
        osc.frequency.setValueAtTime(880.0, ctx.currentTime + 0.1); // A5
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'paste') {
        // Tono suave corto al pegar
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
      }
    } catch {
      // Audio context silencioso
    }
  }, [soundEnabled]);

  // ==========================================================================
  // CARGA INICIAL DE DATOS DESDE INDEXEDDB
  // ==========================================================================
  useEffect(() => {
    async function initData() {
      const savedSlots = await dniDb.loadAllSlots();
      const map: Record<number, DniSlotData> = {};
      savedSlots.forEach((s) => {
        map[s.id] = s;
      });
      setSlotsData(map);

      const savedCount = await dniDb.getSetting<number>('totalSlots', 100);
      setTotalSlots(savedCount);

      const savedSound = await dniDb.getSetting<boolean>('soundEnabled', true);
      setSoundEnabled(savedSound);
    }
    initData();
  }, []);

  // Guardar slot en IndexedDB y estado local
  const updateSlot = useCallback(async (slot: DniSlotData) => {
    setSlotsData((prev) => ({ ...prev, [slot.id]: slot }));
    await dniDb.saveSlot(slot);
  }, []);

  // Encontrar el siguiente cupo incompleto o vacío
  const findNextIncompleteSlot = useCallback(
    (currentId: number): number => {
      // Buscar desde currentId + 1 hasta totalSlots
      for (let i = currentId + 1; i <= totalSlots; i++) {
        const slot = slotsData[i];
        if (!slot || !slot.anverso || !slot.reverso) {
          return i;
        }
      }
      // Buscar desde 1 hasta currentId
      for (let i = 1; i <= currentId; i++) {
        const slot = slotsData[i];
        if (!slot || !slot.anverso || !slot.reverso) {
          return i;
        }
      }
      return currentId;
    },
    [slotsData, totalSlots]
  );

  // ==========================================================================
  // CAPTURA AUTOMÁTICA DE PORTAPAPELES (Ctrl + V / WhatsApp Web)
  // ==========================================================================
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Si el foco está en un input de texto, dejar que escriba normal
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
        const currentSlot: DniSlotData = slotsData[currentId] || { id: currentId };

        let updatedSlot: DniSlotData;
        let isNowComplete = false;

        // Si tenemos un lado específico enfocado, guardarlo allí
        if (focusedSide === 'anverso') {
          updatedSlot = { ...currentSlot, anverso: base64Data, anversoRotation: 0 };
          isNowComplete = Boolean(updatedSlot.anverso && updatedSlot.reverso);
        } else if (focusedSide === 'reverso') {
          updatedSlot = { ...currentSlot, reverso: base64Data, reversoRotation: 0 };
          isNowComplete = Boolean(updatedSlot.anverso && updatedSlot.reverso);
        } else {
          // Detección automática inteligente:
          // 1. Si no tiene anverso -> va al anverso
          // 2. Si ya tiene anverso pero no reverso -> va al reverso y se completa
          // 3. Si ya tiene ambos -> salta al siguiente incompleto y va al anverso
          if (!currentSlot.anverso) {
            updatedSlot = { ...currentSlot, anverso: base64Data, anversoRotation: 0 };
            isNowComplete = Boolean(updatedSlot.reverso);
          } else if (!currentSlot.reverso) {
            updatedSlot = { ...currentSlot, reverso: base64Data, reversoRotation: 0 };
            isNowComplete = true;
          } else {
            const nextSlotId = findNextIncompleteSlot(currentId);
            const targetSlot: DniSlotData = slotsData[nextSlotId] || { id: nextSlotId };
            updatedSlot = { ...targetSlot, anverso: base64Data, anversoRotation: 0 };
            isNowComplete = Boolean(updatedSlot.reverso);
            setActiveSlotId(nextSlotId);
          }
        }

        await updateSlot(updatedSlot);

        if (isNowComplete) {
          playSound('success');
          // Auto-avanzar al siguiente cupo incompleto
          setTimeout(() => {
            const nextId = findNextIncompleteSlot(updatedSlot.id);
            setActiveSlotId(nextId);
            setFocusedSide(null);
          }, 200);
        } else {
          playSound('paste');
        }
      };

      reader.readAsDataURL(file);
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [slotsData, focusedSide, findNextIncompleteSlot, playSound, updateSlot]);

  // ==========================================================================
  // ATAJOS DE TECLADO (Enter, Flechas, R para rotar)
  // ==========================================================================
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si se está editando un campo de texto
      if (
        document.activeElement &&
        (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')
      ) {
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        const nextId = findNextIncompleteSlot(activeSlotRef.current);
        setActiveSlotId(nextId);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setActiveSlotId((prev) => Math.min(totalSlots, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setActiveSlotId((prev) => Math.max(1, prev - 1));
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        // Rotar el lado enfocado o el reverso si existe, sino el anverso
        const slot = slotsData[activeSlotRef.current];
        if (!slot) return;

        if (focusedSide === 'anverso' && slot.anverso) {
          const currentRot = slot.anversoRotation || 0;
          updateSlot({ ...slot, anversoRotation: (currentRot + 90) % 360 });
        } else if (focusedSide === 'reverso' && slot.reverso) {
          const currentRot = slot.reversoRotation || 0;
          updateSlot({ ...slot, reversoRotation: (currentRot + 90) % 360 });
        } else if (slot.reverso) {
          const currentRot = slot.reversoRotation || 0;
          updateSlot({ ...slot, reversoRotation: (currentRot + 90) % 360 });
        } else if (slot.anverso) {
          const currentRot = slot.anversoRotation || 0;
          updateSlot({ ...slot, anversoRotation: (currentRot + 90) % 360 });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [totalSlots, slotsData, focusedSide, findNextIncompleteSlot, updateSlot]);

  // ==========================================================================
  // ROTACIÓN MANUAL DE IMÁGENES
  // ==========================================================================
  const handleRotate = (slotId: number, side: 'anverso' | 'reverso') => {
    const slot = slotsData[slotId];
    if (!slot) return;
    if (side === 'anverso' && slot.anverso) {
      const rot = ((slot.anversoRotation || 0) + 90) % 360;
      updateSlot({ ...slot, anversoRotation: rot });
    } else if (side === 'reverso' && slot.reverso) {
      const rot = ((slot.reversoRotation || 0) + 90) % 360;
      updateSlot({ ...slot, reversoRotation: rot });
    }
  };

  // ==========================================================================
  // LIMPIEZA DE LADOS O CUPOS
  // ==========================================================================
  const handleClearSide = (slotId: number, side: 'anverso' | 'reverso', e: React.MouseEvent) => {
    e.stopPropagation();
    const slot = slotsData[slotId];
    if (!slot) return;
    if (side === 'anverso') {
      updateSlot({ ...slot, anverso: null, anversoRotation: 0 });
    } else {
      updateSlot({ ...slot, reverso: null, reversoRotation: 0 });
    }
  };

  const handleClearSlot = (slotId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`¿Vaciar completamente el cupo #${String(slotId).padStart(4, '0')}?`)) {
      updateSlot({ id: slotId, anverso: null, reverso: null, label: '' });
    }
  };

  const handleClearAll = async () => {
    if (confirm('¿ATENCIÓN: Estás seguro de vaciar TODOS los cupos cargados? Esta acción no se puede deshacer.')) {
      await dniDb.clearAllSlots();
      setSlotsData({});
      setActiveSlotId(1);
    }
  };

  // ==========================================================================
  // EXPORTACIÓN A WORD Y ZIP
  // ==========================================================================
  const handleExportMasterWord = async () => {
    const list = Object.values(slotsData);
    const complete = list.filter((s) => s.anverso && s.reverso);
    if (complete.length === 0) {
      alert('No tienes ningún cupo completo (con anverso y reverso) para exportar.');
      return;
    }

    try {
      setIsExporting(true);
      await exportMasterDocx(list, (status) => setExportProgress(status));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido al exportar Word';
      alert(`Error al generar Word: ${msg}`);
    } finally {
      setIsExporting(false);
      setExportProgress('');
    }
  };

  const handleExportZip = async () => {
    const list = Object.values(slotsData);
    const complete = list.filter((s) => s.anverso && s.reverso);
    if (complete.length === 0) {
      alert('No tienes ningún cupo completo (con anverso y reverso) para exportar en ZIP.');
      return;
    }

    try {
      setIsExporting(true);
      await exportZipDocx(list, (curr, tot) => {
        setExportProgress(`Comprimiendo expediente ${curr} de ${tot}...`);
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido al exportar ZIP';
      alert(`Error al generar ZIP: ${msg}`);
    } finally {
      setIsExporting(false);
      setExportProgress('');
    }
  };

  // ==========================================================================
  // CÁLCULO DE ESTADÍSTICAS
  // ==========================================================================
  const allSlotsArray = Array.from({ length: totalSlots }, (_, i) => i + 1);

  const stats = allSlotsArray.reduce(
    (acc, id) => {
      const s = slotsData[id];
      if (s?.anverso && s?.reverso) {
        acc.ready++;
      } else if (s?.anverso || s?.reverso) {
        acc.partial++;
      } else {
        acc.empty++;
      }
      return acc;
    },
    { ready: 0, partial: 0, empty: 0 }
  );

  // Filtrado de cupos
  const filteredSlotIds = allSlotsArray.filter((id) => {
    const s = slotsData[id];
    const isReady = Boolean(s?.anverso && s?.reverso);
    const isPartial = Boolean((s?.anverso && !s?.reverso) || (!s?.anverso && s?.reverso));
    const isEmpty = !s?.anverso && !s?.reverso;

    if (filter === 'ready' && !isReady) return false;
    if (filter === 'partial' && !isPartial) return false;
    if (filter === 'empty' && !isEmpty) return false;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const numStr = String(id).padStart(4, '0');
      const label = (s?.label || '').toLowerCase();
      return numStr.includes(term) || label.includes(term);
    }

    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* CABECERA PRINCIPAL Y CONTROL DE EXPORTACIÓN */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '14px',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '14px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.04)'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                padding: '8px',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(37,99,235,0.3)'
              }}
            >
              <IdCard className="w-6 h-6" />
            </span>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>
                DNI Matrix Express (WhatsApp Web ➔ Word/PDF A4)
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: '#64748b' }}>
                Copia fotos de DNI desde WhatsApp Web, pega con <b>Ctrl+V</b> y genera documentos Word A4 listos para imprimir
              </p>
            </div>
          </div>
        </div>

        {/* Botones de Exportación Rápida */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={handleExportMasterWord}
            disabled={isExporting || stats.ready === 0}
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 800,
              fontSize: '12.5px',
              padding: '9px 16px',
              borderRadius: '8px',
              boxShadow: '0 2px 6px rgba(37,99,235,0.25)'
            }}
          >
            <FileText className="w-4 h-4" />
            {isExporting ? 'Generando...' : `Word Maestro (.docx) (${stats.ready})`}
          </button>

          <button
            onClick={handleExportZip}
            disabled={isExporting || stats.ready === 0}
            className="btn"
            style={{
              background: '#059669',
              color: '#ffffff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 800,
              fontSize: '12.5px',
              padding: '9px 14px',
              borderRadius: '8px',
              cursor: stats.ready > 0 ? 'pointer' : 'not-allowed',
              opacity: stats.ready > 0 ? 1 : 0.6
            }}
          >
            <Archive className="w-4 h-4" /> Lote (.zip)
          </button>

          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? 'Silenciar sonidos' : 'Activar sonidos'}
            style={{
              background: soundEnabled ? '#eff6ff' : '#f1f5f9',
              border: '1px solid #cbd5e1',
              color: soundEnabled ? '#2563eb' : '#64748b',
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            onClick={() => setShowConfigModal(true)}
            title="Ajustes de cupos"
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#475569',
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <Settings className="w-4 h-4" />
          </button>

          <button
            onClick={handleClearAll}
            title="Vaciar todos los cupos"
            style={{
              background: '#fee2e2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              width: '38px',
              height: '38px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer'
            }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ESTADO DE PROGRESO DE EXPORTACIÓN */}
      {isExporting && exportProgress && (
        <div
          style={{
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '10px',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '13px',
            color: '#1e40af',
            fontWeight: 800
          }}
        >
          <div className="spinner" style={{ width: '16px', height: '16px' }} />
          <span>{exportProgress}</span>
        </div>
      )}

      {/* TARJETAS DE MÉTRICAS / RESUMEN */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <div
          onClick={() => setFilter('all')}
          style={{
            background: filter === 'all' ? '#eff6ff' : '#ffffff',
            border: filter === 'all' ? '2px solid #2563eb' : '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '12px 16px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            Total Cupos
          </div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', marginTop: '2px' }}>
            {totalSlots}
          </div>
        </div>

        <div
          onClick={() => setFilter('ready')}
          style={{
            background: filter === 'ready' ? '#f0fdf4' : '#ffffff',
            border: filter === 'ready' ? '2px solid #16a34a' : '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '12px 16px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#15803d', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Listos / Completos
          </div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#16a34a', marginTop: '2px' }}>
            {stats.ready} <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>({Math.round((stats.ready / totalSlots) * 100)}%)</span>
          </div>
        </div>

        <div
          onClick={() => setFilter('partial')}
          style={{
            background: filter === 'partial' ? '#fffbeb' : '#ffffff',
            border: filter === 'partial' ? '2px solid #d97706' : '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '12px 16px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#b45309', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" /> Incompletos / Parciales
          </div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#d97706', marginTop: '2px' }}>
            {stats.partial}
          </div>
        </div>

        <div
          onClick={() => setFilter('empty')}
          style={{
            background: filter === 'empty' ? '#f8fafc' : '#ffffff',
            border: filter === 'empty' ? '2px solid #64748b' : '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '12px 16px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
            Cupos Vacíos
          </div>
          <div style={{ fontSize: '22px', fontWeight: 900, color: '#64748b', marginTop: '2px' }}>
            {stats.empty}
          </div>
        </div>
      </div>

      {/* GUÍA DE FLUJO RÁPIDO WHATSAPP WEB */}
      <div
        style={{
          background: '#f8fafc',
          border: '1px dashed #cbd5e1',
          borderRadius: '10px',
          padding: '10px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px',
          fontSize: '12px',
          color: '#475569'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontWeight: 800, color: '#2563eb' }}>⚡ Flujo WhatsApp:</span>
          <span>1. Clic derecho en WhatsApp &rarr; <b>Copiar imagen</b></span>
          <span>&rarr;</span>
          <span>2. Pulsa <b>Ctrl + V</b> aquí</span>
          <span>&rarr;</span>
          <span style={{ color: '#16a34a', fontWeight: 700 }}>¡Se clasifica y salta solo al completarse!</span>
        </div>

        <div style={{ display: 'flex', gap: '10px', fontSize: '11.5px', fontWeight: 700, color: '#64748b' }}>
          <span><kbd style={{ background: '#e2e8f0', padding: '2px 5px', borderRadius: '4px' }}>Enter</kbd> Siguiente vacío</span>
          <span><kbd style={{ background: '#e2e8f0', padding: '2px 5px', borderRadius: '4px' }}>R</kbd> Rotar 90°</span>
          <span><kbd style={{ background: '#e2e8f0', padding: '2px 5px', borderRadius: '4px' }}>&larr; &rarr;</kbd> Navegar</span>
        </div>
      </div>

      {/* BARRA DE BÚSQUEDA Y FILTRADO */}
      <div
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 240px' }}>
          <Search style={{ position: 'absolute', left: '10px', top: '8px', width: '15px', height: '15px', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Buscar por # cupo (ej: 0005) o DNI/Nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px 6px 32px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '12.5px',
              outline: 'none'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#475569' }}>Cupo Activo:</span>
          <select
            value={activeSlotId}
            onChange={(e) => setActiveSlotId(Number(e.target.value))}
            style={{
              padding: '5px 8px',
              borderRadius: '6px',
              border: '1px solid #cbd5e1',
              fontSize: '12px',
              fontWeight: 800,
              fontFamily: 'monospace'
            }}
          >
            {allSlotsArray.map((id) => (
              <option key={id} value={id}>
                #{String(id).padStart(4, '0')} {slotsData[id]?.anverso && slotsData[id]?.reverso ? '✓' : ''}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => setActiveSlotId(findNextIncompleteSlot(activeSlotId))}
          className="btn"
          style={{
            background: '#f1f5f9',
            border: '1px solid #cbd5e1',
            color: '#1e40af',
            padding: '5px 10px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          Próximo Incompleto <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* GRILLA DE CUPOS (MATRIZ INTERACTIVA) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '14px'
        }}
      >
        {filteredSlotIds.map((id) => {
          const slot = slotsData[id] || { id };
          const isComplete = Boolean(slot.anverso && slot.reverso);
          const isPartial = Boolean((slot.anverso && !slot.reverso) || (!slot.anverso && slot.reverso));
          const isActive = id === activeSlotId;

          const borderColor = isActive
            ? '#2563eb'
            : isComplete
            ? '#16a34a'
            : isPartial
            ? '#f59e0b'
            : '#e2e8f0';

          const badgeBg = isComplete ? '#dcfce7' : isPartial ? '#fef3c7' : '#f1f5f9';
          const badgeColor = isComplete ? '#15803d' : isPartial ? '#b45309' : '#64748b';

          return (
            <div
              key={id}
              onClick={() => setActiveSlotId(id)}
              style={{
                background: isActive ? '#fbfcfe' : '#ffffff',
                border: `2px solid ${borderColor}`,
                borderRadius: '12px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                cursor: 'pointer',
                boxShadow: isActive
                  ? '0 4px 14px rgba(37,99,235,0.18)'
                  : '0 1px 3px rgba(0,0,0,0.04)',
                position: 'relative',
                transition: 'all 0.15s ease'
              }}
            >
              {/* Cabecera del Cupo */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      fontFamily: 'monospace',
                      fontWeight: 900,
                      fontSize: '13px',
                      color: isActive ? '#2563eb' : '#0f172a',
                      background: isActive ? '#eff6ff' : '#f8fafc',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      border: '1px solid #cbd5e1'
                    }}
                  >
                    #{String(id).padStart(4, '0')}
                  </span>
                  {isActive && (
                    <span style={{ fontSize: '10px', fontWeight: 900, color: '#2563eb', background: '#dbeafe', padding: '1px 5px', borderRadius: '4px' }}>
                      ACTIVO
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 800,
                      background: badgeBg,
                      color: badgeColor,
                      padding: '2px 6px',
                      borderRadius: '4px'
                    }}
                  >
                    {isComplete ? 'COMPLETO ✓' : isPartial ? 'PARCIAL' : 'VACÍO'}
                  </span>

                  {isComplete && (
                    <button
                      title="Vista previa A4"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewSlot(slot);
                      }}
                      style={{
                        background: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        color: '#2563eb',
                        width: '24px',
                        height: '24px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                  )}

                  {(slot.anverso || slot.reverso || slot.label) && (
                    <button
                      title="Vaciar este cupo"
                      onClick={(e) => handleClearSlot(id, e)}
                      style={{
                        background: '#fee2e2',
                        border: '1px solid #fecaca',
                        color: '#dc2626',
                        width: '24px',
                        height: '24px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer'
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Casillas de Anverso y Reverso */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {/* 1. ANVERSO */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSlotId(id);
                    setFocusedSide('anverso');
                  }}
                  style={{
                    background: '#f8fafc',
                    border:
                      isActive && focusedSide === 'anverso'
                        ? '2px solid #2563eb'
                        : slot.anverso
                        ? '1px solid #cbd5e1'
                        : '1px dashed #cbd5e1',
                    borderRadius: '8px',
                    height: '110px',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: '4px',
                      left: '4px',
                      fontSize: '9px',
                      fontWeight: 800,
                      background: 'rgba(15,23,42,0.7)',
                      color: '#ffffff',
                      padding: '1px 4px',
                      borderRadius: '3px',
                      zIndex: 2
                    }}
                  >
                    ANVERSO
                  </span>

                  {slot.anverso ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={slot.anverso}
                        alt="Anverso"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          transform: `rotate(${slot.anversoRotation || 0}deg)`,
                          transition: 'transform 0.2s ease'
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '4px',
                          right: '4px',
                          display: 'flex',
                          gap: '2px',
                          zIndex: 2
                        }}
                      >
                        <button
                          title="Rotar 90°"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRotate(id, 'anverso');
                          }}
                          style={{
                            background: 'rgba(255,255,255,0.9)',
                            border: '1px solid #cbd5e1',
                            width: '20px',
                            height: '20px',
                            borderRadius: '3px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <RotateCw className="w-2.5 h-2.5 text-slate-700" />
                        </button>
                        <button
                          title="Eliminar foto"
                          onClick={(e) => handleClearSide(id, 'anverso', e)}
                          style={{
                            background: 'rgba(254,226,226,0.9)',
                            border: '1px solid #fca5a5',
                            width: '20px',
                            height: '20px',
                            borderRadius: '3px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 className="w-2.5 h-2.5 text-red-600" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '6px' }}>
                      <IdCard className="w-5 h-5 mx-auto mb-1 opacity-50" />
                      <div style={{ fontSize: '10px', fontWeight: 600 }}>Clic o Ctrl+V</div>
                    </div>
                  )}
                </div>

                {/* 2. REVERSO */}
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSlotId(id);
                    setFocusedSide('reverso');
                  }}
                  style={{
                    background: '#f8fafc',
                    border:
                      isActive && focusedSide === 'reverso'
                        ? '2px solid #2563eb'
                        : slot.reverso
                        ? '1px solid #cbd5e1'
                        : '1px dashed #cbd5e1',
                    borderRadius: '8px',
                    height: '110px',
                    position: 'relative',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: '4px',
                      left: '4px',
                      fontSize: '9px',
                      fontWeight: 800,
                      background: 'rgba(15,23,42,0.7)',
                      color: '#ffffff',
                      padding: '1px 4px',
                      borderRadius: '3px',
                      zIndex: 2
                    }}
                  >
                    REVERSO
                  </span>

                  {slot.reverso ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={slot.reverso}
                        alt="Reverso"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain',
                          transform: `rotate(${slot.reversoRotation || 0}deg)`,
                          transition: 'transform 0.2s ease'
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '4px',
                          right: '4px',
                          display: 'flex',
                          gap: '2px',
                          zIndex: 2
                        }}
                      >
                        <button
                          title="Rotar 90°"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRotate(id, 'reverso');
                          }}
                          style={{
                            background: 'rgba(255,255,255,0.9)',
                            border: '1px solid #cbd5e1',
                            width: '20px',
                            height: '20px',
                            borderRadius: '3px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <RotateCw className="w-2.5 h-2.5 text-slate-700" />
                        </button>
                        <button
                          title="Eliminar foto"
                          onClick={(e) => handleClearSide(id, 'reverso', e)}
                          style={{
                            background: 'rgba(254,226,226,0.9)',
                            border: '1px solid #fca5a5',
                            width: '20px',
                            height: '20px',
                            borderRadius: '3px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 className="w-2.5 h-2.5 text-red-600" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '6px' }}>
                      <IdCard className="w-5 h-5 mx-auto mb-1 opacity-50" />
                      <div style={{ fontSize: '10px', fontWeight: 600 }}>Clic o Ctrl+V</div>
                    </div>
                  )}
                </div>
              </div>

              {/* DNI o Nombre Opcional del Expediente */}
              <div style={{ display: 'flex', gap: '4px' }}>
                <input
                  type="text"
                  placeholder="DNI / Nombre del Cliente..."
                  value={slot.label || ''}
                  onChange={(e) => updateSlot({ ...slot, label: e.target.value })}
                  style={{
                    flex: 1,
                    padding: '4px 8px',
                    fontSize: '11px',
                    borderRadius: '5px',
                    border: '1px solid #cbd5e1',
                    outline: 'none',
                    background: '#f8fafc'
                  }}
                />
                <button
                  type="button"
                  title="Vincular con Cliente / Guía AMEX"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAssociateModalSlot(slot);
                  }}
                  style={{
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#2563eb',
                    padding: '0 6px',
                    borderRadius: '5px',
                    cursor: 'pointer'
                  }}
                >
                  <LinkIcon className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: VISTA PREVIA HOJA A4 (CUADRE MILIMÉTRICO) */}
      {previewSlot && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Printer className="w-5 h-5 text-blue-600" /> Vista Previa Expediente #{String(previewSlot.id).padStart(4, '0')} (Hoja A4)
              </span>
              <button
                onClick={() => setPreviewSlot(null)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center' }}>
                Cuadre A4 milimétrico: 12.0 × 7.5 cm por DNI, centrado, 1 página exacta en Microsoft Word.
              </div>

              {/* Simulación visual de la hoja A4 blanca */}
              <div
                id="a4-print-sheet"
                style={{
                  width: '420px',
                  height: '594px', // Ratio A4 1:1.414
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                  padding: '40px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                {previewSlot.anverso ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewSlot.anverso}
                    alt="Anverso A4"
                    style={{
                      width: '240px',
                      height: '150px',
                      objectFit: 'contain',
                      transform: `rotate(${previewSlot.anversoRotation || 0}deg)`,
                      border: '1px solid #e2e8f0'
                    }}
                  />
                ) : (
                  <div style={{ width: '240px', height: '150px', border: '1px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                    Sin Anverso
                  </div>
                )}

                {previewSlot.reverso ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewSlot.reverso}
                    alt="Reverso A4"
                    style={{
                      width: '240px',
                      height: '150px',
                      objectFit: 'contain',
                      transform: `rotate(${previewSlot.reversoRotation || 0}deg)`,
                      border: '1px solid #e2e8f0'
                    }}
                  />
                ) : (
                  <div style={{ width: '240px', height: '150px', border: '1px dashed #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                    Sin Reverso
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '8px', width: '100%', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800 }}
                >
                  <Printer className="w-4 h-4" /> Imprimir Hoja
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: AJUSTES DE MATRIZ DNI */}
      {showConfigModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Settings className="w-5 h-5 text-blue-600" /> Configuración de DNI Matrix
              </span>
              <button
                onClick={() => setShowConfigModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>
                  Cantidad Total de Cupos / Expedientes
                </label>
                <select
                  value={totalSlots}
                  onChange={async (e) => {
                    const count = Number(e.target.value);
                    setTotalSlots(count);
                    await dniDb.saveSetting('totalSlots', count);
                  }}
                  className="form-control"
                  style={{ fontWeight: 800 }}
                >
                  <option value={50}>50 Cupos (#0001 - #0050)</option>
                  <option value={100}>100 Cupos (#0001 - #0100) (Estándar)</option>
                  <option value={200}>200 Cupos (#0001 - #0200)</option>
                  <option value={300}>300 Cupos (#0001 - #0300)</option>
                  <option value={500}>500 Cupos (#0001 - #0500)</option>
                  <option value={1000}>1000 Cupos (#0001 - #1000) (Lote Grande)</option>
                </select>
              </div>

              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#1e40af' }}>
                💡 <b>Persistencia Local:</b> Todas las imágenes y rotaciones se guardan de forma instantánea en tu navegador con <b>IndexedDB</b>.
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="btn btn-primary"
                >
                  Guardar y Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ASOCIAR CUPO A CLIENTE / GUÍA AMEX */}
      {associateModalSlot && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <LinkIcon className="w-5 h-5 text-blue-600" /> Vincular Cupo #{String(associateModalSlot.id).padStart(4, '0')} con AMEX
              </span>
              <button
                onClick={() => setAssociateModalSlot(null)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Selecciona un cliente o paquete para autocompletar el DNI y nombre en este cupo:
              </div>

              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Buscar en Clientes AMEX</label>
                <select
                  onChange={(e) => {
                    const client = clientes.find((c) => c.id === e.target.value);
                    if (client) {
                      updateSlot({
                        ...associateModalSlot,
                        clienteId: client.id,
                        label: `${client.documentoIdentidad || ''} - ${client.nombre}`
                      });
                      setAssociateModalSlot(null);
                    }
                  }}
                  className="form-control"
                  defaultValue=""
                >
                  <option value="" disabled>Selecciona un cliente registrado...</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.documentoIdentidad ? `[DNI ${c.documentoIdentidad}] ` : ''}{c.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>O vincular por Guía WR</label>
                <select
                  onChange={(e) => {
                    const pkg = paquetes.find((p) => p.id === e.target.value);
                    if (pkg) {
                      updateSlot({
                        ...associateModalSlot,
                        paqueteId: pkg.id,
                        label: `${pkg.numeroReciboBodega} - ${pkg.nombreConsignatario || pkg.dniConsignatario || ''}`
                      });
                      setAssociateModalSlot(null);
                    }
                  }}
                  className="form-control"
                  defaultValue=""
                >
                  <option value="" disabled>Selecciona un paquete en almacén...</option>
                  {paquetes.slice(0, 100).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.numeroReciboBodega} - {p.nombreConsignatario || p.dniConsignatario || 'Sin nombre'}
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setAssociateModalSlot(null)}
                  className="btn btn-secondary"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
