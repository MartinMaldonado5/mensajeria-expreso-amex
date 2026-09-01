'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  HojaCotejo,
  ItemCotejo,
  Paquete,
  Cliente,
  TipoProcesoCotejo,
  TipoEstadoItemCotejo
} from '@/types';
import { supabase } from '@/lib/supabase/client';
import { soundEffects } from '@/lib/audio/soundEffects';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Barcode,
  Plus,
  ClipboardPaste,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Volume2,
  VolumeX,
  Mic,
  RotateCcw,
  Search,
  Filter,
  Users,
  Eye,
  Trash2,
  Layers,
  ArrowUpDown,
  Zap,
  Sparkles,
  ExternalLink,
  Edit2,
  Check,
  X,
  RefreshCw,
  Camera
} from 'lucide-react';
import PasteWrListModal from '@/components/modals/PasteWrListModal';
import NewSheetModal from '@/components/modals/NewSheetModal';
import MobileScannerModal from '@/components/scanner/MobileScannerModal';

interface LiveSheetsTabProps {
  paquetes: Paquete[];
  clientes: Cliente[];
  onViewPdf?: (url: string) => void;
  currentUser?: { nombre: string; rol: string } | null;
}

interface ScanAlert {
  id: string;
  type: 'success' | 'duplicate' | 'not_found' | 'peer';
  code: string;
  message: string;
  consignee?: string;
  operator?: string;
  timestamp: Date;
}

export default function LiveSheetsTab({
  paquetes = [],
  clientes = [],
  onViewPdf,
  currentUser
}: LiveSheetsTabProps) {
  const operatorName = currentUser?.nombre || 'Operador Lince';

  // State: Hojas & Items
  const [hojas, setHojas] = useState<HojaCotejo[]>([]);
  const [activeHojaId, setActiveHojaId] = useState<string | null>(null);
  const [items, setItems] = useState<ItemCotejo[]>([]);
  const [isLoadingSheets, setIsLoadingSheets] = useState(true);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // Barcode Gun Scanning Input State
  const [barcodeInput, setBarcodeInput] = useState('');
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Filter & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDIENTE' | 'ESCANEADO' | 'NO_LISTADO' | 'OBSERVADO'>('ALL');
  const [sortField, setSortField] = useState<'orden' | 'codigoWr' | 'escaneadoEn' | 'consignatario'>('orden');
  const [sortAsc, setSortAsc] = useState(true);

  // Inline Cell Editing State
  const [editingCell, setEditingCell] = useState<{ id: string; field: keyof ItemCotejo } | null>(null);
  const [editValue, setEditValue] = useState('');

  // Modals
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [isNewSheetModalOpen, setIsNewSheetModalOpen] = useState(false);
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);

  // Notification Alerts & Live Animations
  const [recentAlert, setRecentAlert] = useState<ScanAlert | null>(null);
  const [justScannedIds, setJustScannedIds] = useState<Set<string>>(new Set());
  const [peerScannedIds, setPeerScannedIds] = useState<Set<string>>(new Set());
  const [onlineOperators, setOnlineOperators] = useState<string[]>([operatorName]);

  // Audio settings
  const [isMuted, setIsMuted] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);

  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const focusBarcodeInput = () => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  };

  // 1. Fetch Hojas de Cotejo
  const fetchHojas = useCallback(async () => {
    try {
      setIsLoadingSheets(true);
      const { data, error } = await supabase
        .from('hojas_cotejo')
        .select('*')
        .order('actualizado_en', { ascending: false });

      if (error) {
        console.error('Error fetching hojas_cotejo:', error);
      } else if (data && data.length > 0) {
        const mapped: HojaCotejo[] = data.map(h => ({
          id: h.id,
          titulo: h.titulo,
          descripcion: h.descripcion || '',
          tipoProceso: (h.tipo_proceso as TipoProcesoCotejo) || 'RECEPCION_LINCE',
          estado: h.estado || 'ACTIVA',
          sedeId: h.sede_id,
          creadoPor: h.creado_por || 'AMEX',
          creadoEn: h.creado_en,
          actualizadoEn: h.actualizado_en
        }));
        setHojas(mapped);
        if (!activeHojaId || !mapped.some(h => h.id === activeHojaId)) {
          setActiveHojaId(mapped[0].id);
        }
      } else {
        // Create initial default sheet if empty
        const todayStr = new Date().toLocaleDateString('es-PE');
        const { data: newSheet } = await supabase
          .from('hojas_cotejo')
          .insert({
            titulo: `Cotejo Almacén Lince - ${todayStr}`,
            descripcion: 'Cotejo y pistoleo en tiempo real de bultos recibidos',
            tipo_proceso: 'RECEPCION_LINCE',
            creado_por: operatorName
          })
          .select()
          .single();

        if (newSheet) {
          const initSheet: HojaCotejo = {
            id: newSheet.id,
            titulo: newSheet.titulo,
            descripcion: newSheet.descripcion || '',
            tipoProceso: 'RECEPCION_LINCE',
            estado: 'ACTIVA',
            creadoPor: newSheet.creado_por || 'AMEX',
            creadoEn: newSheet.creado_en,
            actualizadoEn: newSheet.actualizado_en
          };
          setHojas([initSheet]);
          setActiveHojaId(initSheet.id);
        }
      }
    } catch (err) {
      console.error('Error in fetchHojas:', err);
    } finally {
      setIsLoadingSheets(false);
    }
  }, [activeHojaId, operatorName]);

  // 2. Fetch Items of active Hoja
  const fetchItems = useCallback(async (hojaId: string) => {
    if (!hojaId) return;
    try {
      setIsLoadingItems(true);
      const { data, error } = await supabase
        .from('hojas_cotejo_items')
        .select('*')
        .eq('hoja_id', hojaId)
        .order('orden', { ascending: true });

      if (error) {
        console.error('Error fetching items:', error);
      } else if (data) {
        const mappedItems: ItemCotejo[] = data.map(i => ({
          id: i.id,
          hojaId: i.hoja_id,
          codigoWr: i.codigo_wr,
          trackingUsa: i.tracking_usa,
          casillero: i.casillero,
          consignatario: i.consignatario,
          pesoKg: Number(i.peso_kg || 0),
          posicionEstante: i.posicion_estante,
          notas: i.notas,
          estado: (i.estado as TipoEstadoItemCotejo) || 'PENDIENTE',
          escaneadoEn: i.escaneado_en,
          escaneadoPor: i.escaneado_por,
          vecesEscaneado: i.veces_escaneado || 0,
          orden: i.orden,
          creadoEn: i.creado_en,
          actualizadoEn: i.actualizado_en
        }));
        setItems(mappedItems);
      }
    } catch (err) {
      console.error('Error in fetchItems:', err);
    } finally {
      setIsLoadingItems(false);
    }
  }, []);

  useEffect(() => {
    fetchHojas();
  }, [fetchHojas]);

  useEffect(() => {
    if (activeHojaId) {
      fetchItems(activeHojaId);
    }
  }, [activeHojaId, fetchItems]);

  // 3. Process Scanned Barcode Gun Input
  const processBarcodeScan = useCallback(
    async (scannedText: string) => {
      if (!activeHojaId || !scannedText.trim()) return;

      const cleanCode = scannedText.trim().toUpperCase().replace(/\s+/g, '');
      setBarcodeInput('');

      const matchedIndex = items.findIndex(
        i =>
          i.codigoWr.toUpperCase() === cleanCode ||
          `WR${i.codigoWr}`.toUpperCase() === cleanCode ||
          (i.trackingUsa && i.trackingUsa.toUpperCase() === cleanCode)
      );

      const nowIso = new Date().toISOString();

      if (matchedIndex !== -1) {
        const matchedItem = items[matchedIndex];
        const isAlreadyScanned = matchedItem.estado === 'ESCANEADO';

        if (isAlreadyScanned) {
          soundEffects.playDuplicate();
          soundEffects.speak(`Atención, ${matchedItem.codigoWr} ya fue escaneado`);

          setRecentAlert({
            id: String(Date.now()),
            type: 'duplicate',
            code: matchedItem.codigoWr,
            message: `⚠️ Ya fue cotejado previamente por ${matchedItem.escaneadoPor || 'Operario'} (${matchedItem.vecesEscaneado + 1}° vez)`,
            consignee: matchedItem.consignatario,
            operator: operatorName,
            timestamp: new Date()
          });

          // Increment scan count
          setItems(prev =>
            prev.map(it =>
              it.id === matchedItem.id
                ? { ...it, vecesEscaneado: (it.vecesEscaneado || 1) + 1 }
                : it
            )
          );

          await supabase
            .from('hojas_cotejo_items')
            .update({
              veces_escaneado: (matchedItem.vecesEscaneado || 1) + 1,
              actualizado_en: nowIso
            })
            .eq('id', matchedItem.id);
        } else {
          soundEffects.playSuccess();
          soundEffects.speak(`${matchedItem.codigoWr} verificado`);

          setRecentAlert({
            id: String(Date.now()),
            type: 'success',
            code: matchedItem.codigoWr,
            message: `✅ Verificado y cotejado correctamente`,
            consignee: matchedItem.consignatario,
            operator: operatorName,
            timestamp: new Date()
          });

          setJustScannedIds(prev => new Set(prev).add(matchedItem.id));
          setTimeout(() => {
            setJustScannedIds(prev => {
              const next = new Set(prev);
              next.delete(matchedItem.id);
              return next;
            });
          }, 2500);

          setItems(prev =>
            prev.map(it =>
              it.id === matchedItem.id
                ? {
                    ...it,
                    estado: 'ESCANEADO',
                    escaneadoEn: nowIso,
                    escaneadoPor: operatorName,
                    vecesEscaneado: 1
                  }
                : it
            )
          );

          setTimeout(() => {
            const rowEl = rowRefs.current[matchedItem.id];
            if (rowEl) {
              rowEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
          }, 50);

          await supabase
            .from('hojas_cotejo_items')
            .update({
              estado: 'ESCANEADO',
              escaneado_en: nowIso,
              escaneado_por: operatorName,
              veces_escaneado: 1,
              actualizado_en: nowIso
            })
            .eq('id', matchedItem.id);
        }
      } else {
        soundEffects.playNotFound();
        soundEffects.speak(`Código ${cleanCode} no está en la lista`);

        const dbPackage = paquetes.find(
          p =>
            p.numeroReciboBodega.toUpperCase() === cleanCode ||
            `WR${p.numeroReciboBodega}`.toUpperCase() === cleanCode ||
            p.trackingUsa.toUpperCase() === cleanCode
        );

        setRecentAlert({
          id: String(Date.now()),
          type: 'not_found',
          code: cleanCode,
          message: `❌ Código no encontrado en esta hoja (Registrado como No Listado)`,
          consignee: dbPackage?.nombreConsignatario || 'Desconocido',
          operator: operatorName,
          timestamp: new Date()
        });

        const { data: newRow, error: insertErr } = await supabase
          .from('hojas_cotejo_items')
          .insert({
            hoja_id: activeHojaId,
            codigo_wr: cleanCode,
            tracking_usa: dbPackage?.trackingUsa || '',
            casillero: dbPackage?.codigoCasillero || '',
            consignatario: dbPackage?.nombreConsignatario || '',
            peso_kg: dbPackage?.pesoKg || 0,
            posicion_estante: dbPackage?.posicionEstante || 'REC',
            notas: '⚠️ CÓDIGO NO ESPERADO / PISTOLEADO FUERA DE LISTA',
            estado: 'NO_LISTADO',
            escaneado_en: nowIso,
            escaneado_por: operatorName,
            veces_escaneado: 1,
            orden: -1
          })
          .select()
          .single();

        if (!insertErr && newRow) {
          const mappedUnlisted: ItemCotejo = {
            id: newRow.id,
            hojaId: newRow.hoja_id,
            codigoWr: newRow.codigo_wr,
            trackingUsa: newRow.tracking_usa,
            casillero: newRow.casillero,
            consignatario: newRow.consignatario,
            pesoKg: Number(newRow.peso_kg || 0),
            posicionEstante: newRow.posicion_estante,
            notas: newRow.notas,
            estado: 'NO_LISTADO',
            escaneadoEn: newRow.escaneado_en,
            escaneadoPor: newRow.escaneado_por,
            vecesEscaneado: 1,
            orden: -1,
            creadoEn: newRow.creado_en,
            actualizadoEn: newRow.actualizado_en
          };
          setItems(prev => [mappedUnlisted, ...prev]);
        }
      }

      focusBarcodeInput();
    },
    [activeHojaId, items, operatorName, paquetes]
  );

  const handleManualScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (barcodeInput.trim()) {
      processBarcodeScan(barcodeInput.trim());
    }
  };

  // 4. Toggle Item Status
  const handleToggleItemStatus = async (item: ItemCotejo) => {
    const nextStatus: TipoEstadoItemCotejo =
      item.estado === 'PENDIENTE'
        ? 'ESCANEADO'
        : item.estado === 'ESCANEADO'
        ? 'OBSERVADO'
        : 'PENDIENTE';

    const nowIso = new Date().toISOString();

    setItems(prev =>
      prev.map(i =>
        i.id === item.id
          ? {
              ...i,
              estado: nextStatus,
              escaneadoEn: nextStatus === 'ESCANEADO' ? nowIso : i.escaneadoEn,
              escaneadoPor: nextStatus === 'ESCANEADO' ? operatorName : i.escaneadoPor
            }
          : i
      )
    );

    if (nextStatus === 'ESCANEADO') {
      soundEffects.playSuccess();
    }

    await supabase
      .from('hojas_cotejo_items')
      .update({
        estado: nextStatus,
        escaneado_en: nextStatus === 'ESCANEADO' ? nowIso : null,
        escaneado_por: nextStatus === 'ESCANEADO' ? operatorName : null,
        actualizado_en: nowIso
      })
      .eq('id', item.id);
  };

  // 5. Bulk Load from Database
  const handleLoadFromDatabase = async () => {
    if (!activeHojaId || paquetes.length === 0) return;

    const existingCodes = new Set(items.map(i => i.codigoWr.toUpperCase()));
    const unaddedPackages = paquetes.filter(p => !existingCodes.has(p.numeroReciboBodega.toUpperCase()));

    if (unaddedPackages.length === 0) {
      alert('Todos los paquetes existentes ya se encuentran en la hoja');
      return;
    }

    const rowsToInsert = unaddedPackages.map((p, idx) => ({
      hoja_id: activeHojaId,
      codigo_wr: p.numeroReciboBodega.toUpperCase(),
      tracking_usa: p.trackingUsa || '',
      casillero: p.codigoCasillero || '',
      consignatario: p.nombreConsignatario || '',
      peso_kg: p.pesoKg || 0,
      posicion_estante: p.posicionEstante || 'REC',
      notas: p.descripcion || '',
      estado: 'PENDIENTE',
      veces_escaneado: 0,
      orden: items.length + idx + 1
    }));

    const { data, error } = await supabase.from('hojas_cotejo_items').insert(rowsToInsert).select();
    if (!error && data) {
      soundEffects.playBulkLoaded();
      fetchItems(activeHojaId);
    }
  };

  // 6. Export to Excel
  const handleExportExcel = () => {
    if (items.length === 0) return;

    const activeSheet = hojas.find(h => h.id === activeHojaId);
    const fileName = `${(activeSheet?.titulo || 'Cotejo_AMEX').replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    const exportData = items.map((it, idx) => ({
      '#': idx + 1,
      'ESTADO': it.estado === 'ESCANEADO' ? 'VERIFICADO / COTEJADO' : it.estado === 'NO_LISTADO' ? 'NO LISTADO / SOBRECARGA' : it.estado,
      'CÓDIGO WR': it.codigoWr,
      'CONSIGNATARIO': it.consignatario || '-',
      'CASILLERO': it.casillero || '-',
      'TRACKING USA': it.trackingUsa || '-',
      'PESO (KG)': it.pesoKg || 0,
      'UBICACIÓN / ESTANTE': it.posicionEstante || 'REC',
      'FECHA / HORA ESCANEO': it.escaneadoEn ? new Date(it.escaneadoEn).toLocaleString('es-PE') : '-',
      'OPERADOR': it.escaneadoPor || '-',
      'VECES PISTOLEADO': it.vecesEscaneado || 0,
      'NOTAS / OBSERVACIONES': it.notas || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Cotejo en Vivo');
    XLSX.writeFile(workbook, fileName);
  };

  // 7. Sync to Main DB
  const handleSyncToMainPackages = async () => {
    const scannedItems = items.filter(i => i.estado === 'ESCANEADO');
    if (scannedItems.length === 0) {
      alert('No hay paquetes marcados como escaneados para sincronizar.');
      return;
    }

    if (
      !confirm(
        `¿Deseas actualizar el estado de los ${scannedItems.length} paquetes cotejados en el inventario principal a 'En Almacén Central Lince'?`
      )
    ) {
      return;
    }

    try {
      let updatedCount = 0;
      for (const item of scannedItems) {
        const { error } = await supabase
          .from('paquetes')
          .update({
            ubicacion_actual: 'AmexLince',
            estado_entrega: 'EnAlmacen',
            posicion_estante: item.posicionEstante || 'REC'
          })
          .eq('numero_recibo_bodega', item.codigoWr);

        if (!error) updatedCount++;
      }

      alert(`✅ Sincronización exitosa: Se actualizaron ${updatedCount} paquetes en la base de datos principal.`);
    } catch (err) {
      console.error('Error syncing to main packages:', err);
      alert('Error al sincronizar con el inventario principal.');
    }
  };

  // 8. Reset Scans
  const handleResetScans = async () => {
    if (!confirm('¿Seguro que deseas reiniciar el cotejo? Todos los items volverán a estado PENDIENTE.')) {
      return;
    }

    setItems(prev =>
      prev.map(i => ({
        ...i,
        estado: 'PENDIENTE',
        escaneadoEn: undefined,
        escaneadoPor: undefined,
        vecesEscaneado: 0
      }))
    );

    await supabase
      .from('hojas_cotejo_items')
      .update({
        estado: 'PENDIENTE',
        escaneado_en: null,
        escaneado_por: null,
        veces_escaneado: 0,
        actualizado_en: new Date().toISOString()
      })
      .eq('hoja_id', activeHojaId);
  };

  // Stats
  const stats = useMemo(() => {
    const total = items.length;
    const scanned = items.filter(i => i.estado === 'ESCANEADO').length;
    const pending = items.filter(i => i.estado === 'PENDIENTE').length;
    const unlisted = items.filter(i => i.estado === 'NO_LISTADO').length;
    const observed = items.filter(i => i.estado === 'OBSERVADO').length;
    const progress = total > 0 ? Math.round((scanned / total) * 100) : 0;
    return { total, scanned, pending, unlisted, observed, progress };
  }, [items]);

  const filteredItems = useMemo(() => {
    return items
      .filter(item => {
        if (statusFilter !== 'ALL' && item.estado !== statusFilter) return false;

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const matchWr = item.codigoWr.toLowerCase().includes(q);
          const matchConsignee = (item.consignatario || '').toLowerCase().includes(q);
          const matchCasillero = (item.casillero || '').toLowerCase().includes(q);
          const matchTracking = (item.trackingUsa || '').toLowerCase().includes(q);
          const matchShelf = (item.posicionEstante || '').toLowerCase().includes(q);
          const matchNotes = (item.notas || '').toLowerCase().includes(q);
          return matchWr || matchConsignee || matchCasillero || matchTracking || matchShelf || matchNotes;
        }
        return true;
      })
      .sort((a, b) => {
        let valA: string | number = a[sortField] || '';
        let valB: string | number = b[sortField] || '';

        if (sortField === 'escaneadoEn') {
          valA = a.escaneadoEn ? new Date(a.escaneadoEn).getTime() : 0;
          valB = b.escaneadoEn ? new Date(b.escaneadoEn).getTime() : 0;
        }

        if (valA < valB) return sortAsc ? -1 : 1;
        if (valA > valB) return sortAsc ? 1 : -1;
        return 0;
      });
  }, [items, statusFilter, searchQuery, sortField, sortAsc]);

  const activeSheet = hojas.find(h => h.id === activeHojaId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden', background: '#f8fafc' }}>
      {/* ---------------- TOP BAR: SHEET SELECTOR & LIVE COLLABORATION ---------------- */}
      <div
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '10px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#ecfdf5', border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669', flexShrink: 0 }}>
            <FileSpreadsheet style={{ width: '20px', height: '20px' }} />
          </div>

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select
                value={activeHojaId || ''}
                onChange={e => setActiveHojaId(e.target.value)}
                style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', background: 'transparent', border: 'none', borderBottom: '2px dashed #cbd5e1', padding: '2px 6px', cursor: 'pointer', outline: 'none' }}
              >
                {hojas.map(h => (
                  <option key={h.id} value={h.id}>
                    📄 {h.titulo}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setIsNewSheetModalOpen(true)}
                style={{ padding: '4px 10px', fontSize: '11.5px', fontWeight: 800, color: '#047857', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                title="Crear nueva hoja de cotejo"
              >
                <Plus style={{ width: '13px', height: '13px' }} />
                <span>Nueva Hoja</span>
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              <span style={{ fontWeight: 700, color: '#334155' }}>{activeSheet?.tipoProceso.replace('_', ' ')}</span>
              <span>•</span>
              <span>Creado por: {activeSheet?.creadoPor || 'AMEX'}</span>
            </div>
          </div>
        </div>

        {/* Right side controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8', borderRadius: '9999px', fontSize: '11.5px', fontWeight: 800 }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2563eb' }} />
            <Users style={{ width: '13px', height: '13px' }} />
            <span>{onlineOperators.length} en vivo</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              style={{ padding: '5px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: isMuted ? '#fee2e2' : '#ffffff', color: isMuted ? '#b91c1c' : '#059669', display: 'flex', alignItems: 'center' }}
              title={isMuted ? 'Activar Bip' : 'Silenciar Bip'}
            >
              {isMuted ? <VolumeX style={{ width: '15px', height: '15px' }} /> : <Volume2 style={{ width: '15px', height: '15px' }} />}
            </button>

            <button
              type="button"
              onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
              style={{ padding: '5px 8px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: isVoiceEnabled ? '#dcfce7' : 'transparent', color: isVoiceEnabled ? '#15803d' : '#64748b', display: 'flex', alignItems: 'center' }}
              title={isVoiceEnabled ? 'Voz activada' : 'Activar voz asistente'}
            >
              <Mic style={{ width: '15px', height: '15px' }} />
            </button>
          </div>

          <button
            type="button"
            onClick={() => fetchItems(activeHojaId || '')}
            disabled={isLoadingItems}
            style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '7px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Refrescar datos"
          >
            <RefreshCw className={isLoadingItems ? 'animate-spin' : ''} style={{ width: '15px', height: '15px', color: '#2563eb' }} />
          </button>
        </div>
      </div>

      {/* ---------------- HERO SCANNING BAR (PISTOLA INALÁMBRICA) ---------------- */}
      <div style={{ background: '#0f172a', padding: '10px 16px', color: '#ffffff', borderBottom: '1px solid #334155', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          {/* Main Barcode Scanner Input Box */}
          <form
            onSubmit={handleManualScanSubmit}
            style={{
              flex: '1 1 360px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#1e293b',
              border: '2px solid #10b981',
              borderRadius: '12px',
              padding: '6px 10px',
              boxShadow: '0 0 14px rgba(16, 185, 129, 0.3)'
            }}
          >
            <div style={{ padding: '4px 8px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', flexShrink: 0 }}>
              <Barcode style={{ width: '16px', height: '16px', color: '#34d399' }} />
              <span>Pistola Activa</span>
            </div>

            <input
              ref={barcodeInputRef}
              type="text"
              autoFocus
              value={barcodeInput}
              onChange={e => setBarcodeInput(e.target.value)}
              placeholder="Apunta y dispara la pistola inalámbrica aquí..."
              style={{ width: '100%', background: 'transparent', border: 'none', color: '#ffffff', fontSize: '13px', fontFamily: 'monospace', fontWeight: 700, outline: 'none' }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <button
                type="submit"
                style={{ padding: '6px 12px', background: '#10b981', color: '#022c22', fontWeight: 900, fontSize: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              >
                <Zap style={{ width: '13px', height: '13px', fill: 'currentColor' }} />
                <span>Cotejar</span>
              </button>

              <button
                type="button"
                onClick={() => setIsCameraScannerOpen(true)}
                style={{ padding: '6px', background: '#334155', color: '#cbd5e1', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                title="Escanear con Cámara"
              >
                <Camera style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
          </form>

          {/* Quick Action Toolbar Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setIsPasteModalOpen(true)}
              style={{ padding: '8px 14px', background: '#2563eb', color: '#ffffff', fontSize: '12px', fontWeight: 800, borderRadius: '10px', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 6px rgba(37,99,235,0.25)' }}
            >
              <ClipboardPaste style={{ width: '15px', height: '15px' }} />
              <span>Pegar de Excel</span>
            </button>

            <button
              type="button"
              onClick={handleLoadFromDatabase}
              style={{ padding: '8px 14px', background: '#334155', color: '#f8fafc', fontSize: '12px', fontWeight: 800, borderRadius: '10px', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              title="Cargar paquetes de Supabase"
            >
              <Sparkles style={{ width: '15px', height: '15px', color: '#38bdf8' }} />
              <span>Cargar de BD</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              style={{ padding: '8px 14px', background: '#059669', color: '#ffffff', fontSize: '12px', fontWeight: 800, borderRadius: '10px', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 6px rgba(5,150,105,0.25)' }}
              title="Descargar Excel"
            >
              <Download style={{ width: '15px', height: '15px' }} />
              <span>Exportar</span>
            </button>
          </div>
        </div>

        {/* Live Scan Notification Toast Banner */}
        {recentAlert && (
          <div
            style={{
              marginTop: '8px',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '11.5px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              background: recentAlert.type === 'success' ? 'rgba(16,185,129,0.2)' : recentAlert.type === 'duplicate' ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)',
              border: recentAlert.type === 'success' ? '1px solid #10b981' : recentAlert.type === 'duplicate' ? '1px solid #f59e0b' : '1px solid #ef4444',
              color: recentAlert.type === 'success' ? '#a7f3d0' : recentAlert.type === 'duplicate' ? '#fde68a' : '#fca5a5'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 900, background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: '4px', color: '#ffffff' }}>
                {recentAlert.code}
              </span>
              <span>{recentAlert.message}</span>
            </div>

            <button
              type="button"
              onClick={() => setRecentAlert(null)}
              style={{ color: '#ffffff', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              <X style={{ width: '14px', height: '14px' }} />
            </button>
          </div>
        )}
      </div>

      {/* ---------------- METRICS & PROGRESS BAR ---------------- */}
      <div
        style={{
          background: '#ffffff',
          borderBottom: '1px solid #e2e8f0',
          padding: '8px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#64748b' }}>Total:</span>
            <span style={{ fontSize: '13px', fontWeight: 900, color: '#0f172a', fontFamily: 'monospace' }}>{stats.total}</span>
          </div>

          <div style={{ width: '1px', height: '14px', background: '#e2e8f0' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#047857', fontWeight: 800, fontSize: '11.5px' }}>
            <CheckCircle2 style={{ width: '14px', height: '14px', color: '#10b981' }} />
            <span>Escaneados:</span>
            <span style={{ fontSize: '13px', fontWeight: 900, fontFamily: 'monospace' }}>{stats.scanned}</span>
          </div>

          <div style={{ width: '1px', height: '14px', background: '#e2e8f0' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#b45309', fontWeight: 800, fontSize: '11.5px' }}>
            <AlertTriangle style={{ width: '14px', height: '14px', color: '#f59e0b' }} />
            <span>Faltantes:</span>
            <span style={{ fontSize: '13px', fontWeight: 900, fontFamily: 'monospace' }}>{stats.pending}</span>
          </div>

          {stats.unlisted > 0 && (
            <>
              <div style={{ width: '1px', height: '14px', background: '#e2e8f0' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#b91c1c', fontWeight: 800, fontSize: '11.5px' }}>
                <XCircle style={{ width: '14px', height: '14px', color: '#ef4444' }} />
                <span>No Listados:</span>
                <span style={{ fontSize: '13px', fontWeight: 900, fontFamily: 'monospace' }}>{stats.unlisted}</span>
              </div>
            </>
          )}
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1 1 200px', maxWidth: '300px' }}>
          <div style={{ flex: 1, background: '#f1f5f9', borderRadius: '9999px', height: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
            <div
              style={{
                background: 'linear-gradient(90deg, #10b981 0%, #06b6d4 100%)',
                height: '100%',
                borderRadius: '9999px',
                width: `${stats.progress}%`,
                transition: 'width 0.3s ease'
              }}
            />
          </div>
          <span style={{ fontSize: '11.5px', fontWeight: 900, color: '#334155', fontFamily: 'monospace', width: '36px', textAlign: 'right' }}>
            {stats.progress}%
          </span>
        </div>

        {/* Advanced Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            type="button"
            onClick={handleSyncToMainPackages}
            style={{ padding: '4px 10px', fontSize: '11.5px', fontWeight: 800, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            title="Actualizar estado en inventario principal de Lince"
          >
            <RefreshCw style={{ width: '12px', height: '12px' }} />
            <span>Sincronizar a Inventario</span>
          </button>

          <button
            type="button"
            onClick={handleResetScans}
            style={{ padding: '5px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', borderRadius: '6px' }}
            title="Reiniciar escaneos a PENDIENTE"
          >
            <RotateCcw style={{ width: '15px', height: '15px' }} />
          </button>
        </div>
      </div>

      {/* ---------------- FILTER & SEARCH BAR ---------------- */}
      <div
        style={{
          background: '#f8fafc',
          borderBottom: '1px solid #e2e8f0',
          padding: '6px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          flexShrink: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#ffffff', padding: '3px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '11.5px',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              background: statusFilter === 'ALL' ? '#0f172a' : 'transparent',
              color: statusFilter === 'ALL' ? '#ffffff' : '#475569'
            }}
          >
            Todos ({stats.total})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('PENDIENTE')}
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '11.5px',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              background: statusFilter === 'PENDIENTE' ? '#d97706' : 'transparent',
              color: statusFilter === 'PENDIENTE' ? '#ffffff' : '#b45309'
            }}
          >
            Pendientes ({stats.pending})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('ESCANEADO')}
            style={{
              padding: '3px 8px',
              borderRadius: '6px',
              fontSize: '11.5px',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              background: statusFilter === 'ESCANEADO' ? '#059669' : 'transparent',
              color: statusFilter === 'ESCANEADO' ? '#ffffff' : '#047857'
            }}
          >
            Escaneados ({stats.scanned})
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', width: '260px' }}>
          <Search style={{ width: '13px', height: '13px', color: '#94a3b8', position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por WR, consignatario..."
            style={{ width: '100%', paddingLeft: '26px', paddingRight: '8px', paddingTop: '4px', paddingBottom: '4px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11.5px', outline: 'none' }}
          />
        </div>
      </div>

      {/* ---------------- MAIN SPREADSHEET TABLE ---------------- */}
      <div style={{ flex: 1, overflow: 'auto', background: '#ffffff', minHeight: 0 }}>
        <table className="live-sheet-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '12.5px' }}>
          <thead>
            <tr>
              <th style={{ width: '36px', textAlign: 'center', position: 'sticky', top: 0, background: '#f1f5f9', padding: '8px 10px', fontSize: '11px', fontWeight: 800, color: '#475569', borderBottom: '2px solid #cbd5e1', zIndex: 10 }}>#</th>
              <th style={{ width: '100px', textAlign: 'center', position: 'sticky', top: 0, background: '#f1f5f9', padding: '8px 10px', fontSize: '11px', fontWeight: 800, color: '#475569', borderBottom: '2px solid #cbd5e1', zIndex: 10 }}>ESTADO</th>
              <th style={{ width: '120px', position: 'sticky', top: 0, background: '#f1f5f9', padding: '8px 10px', fontSize: '11px', fontWeight: 800, color: '#475569', borderBottom: '2px solid #cbd5e1', zIndex: 10 }}>CÓDIGO WR</th>
              <th style={{ width: '180px', position: 'sticky', top: 0, background: '#f1f5f9', padding: '8px 10px', fontSize: '11px', fontWeight: 800, color: '#475569', borderBottom: '2px solid #cbd5e1', zIndex: 10 }}>CONSIGNATARIO</th>
              <th style={{ width: '110px', position: 'sticky', top: 0, background: '#f1f5f9', padding: '8px 10px', fontSize: '11px', fontWeight: 800, color: '#475569', borderBottom: '2px solid #cbd5e1', zIndex: 10 }}>CASILLERO</th>
              <th style={{ width: '130px', position: 'sticky', top: 0, background: '#f1f5f9', padding: '8px 10px', fontSize: '11px', fontWeight: 800, color: '#475569', borderBottom: '2px solid #cbd5e1', zIndex: 10 }}>TRACKING USA</th>
              <th style={{ width: '80px', textAlign: 'right', position: 'sticky', top: 0, background: '#f1f5f9', padding: '8px 10px', fontSize: '11px', fontWeight: 800, color: '#475569', borderBottom: '2px solid #cbd5e1', zIndex: 10 }}>PESO (KG)</th>
              <th style={{ width: '100px', position: 'sticky', top: 0, background: '#f1f5f9', padding: '8px 10px', fontSize: '11px', fontWeight: 800, color: '#475569', borderBottom: '2px solid #cbd5e1', zIndex: 10 }}>ESTANTE</th>
              <th style={{ width: '130px', position: 'sticky', top: 0, background: '#f1f5f9', padding: '8px 10px', fontSize: '11px', fontWeight: 800, color: '#475569', borderBottom: '2px solid #cbd5e1', zIndex: 10 }}>HORA PISTOLEO</th>
              <th style={{ width: '120px', position: 'sticky', top: 0, background: '#f1f5f9', padding: '8px 10px', fontSize: '11px', fontWeight: 800, color: '#475569', borderBottom: '2px solid #cbd5e1', zIndex: 10 }}>OPERADOR</th>
              <th style={{ position: 'sticky', top: 0, background: '#f1f5f9', padding: '8px 10px', fontSize: '11px', fontWeight: 800, color: '#475569', borderBottom: '2px solid #cbd5e1', zIndex: 10 }}>NOTAS</th>
            </tr>
          </thead>

          <tbody>
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '48px', color: '#94a3b8' }}>
                  <FileSpreadsheet style={{ width: '40px', height: '40px', color: '#cbd5e1', margin: '0 auto 8px' }} />
                  <p style={{ fontSize: '13px', fontWeight: 800, color: '#475569', margin: 0 }}>
                    {items.length === 0 ? 'La hoja de cotejo está vacía' : 'No se encontraron registros con este filtro'}
                  </p>
                  {items.length === 0 && (
                    <p style={{ fontSize: '11.5px', color: '#94a3b8', margin: '4px 0 0 0' }}>
                      Pega una lista de WRs con el botón <b>&quot;Pegar de Excel&quot;</b> o dispara la pistola para comenzar.
                    </p>
                  )}
                </td>
              </tr>
            ) : (
              filteredItems.map((item, idx) => {
                const isScanned = item.estado === 'ESCANEADO';
                const isUnlisted = item.estado === 'NO_LISTADO';

                return (
                  <tr
                    key={item.id}
                    ref={el => {
                      rowRefs.current[item.id] = el;
                    }}
                    style={{
                      background: isScanned ? '#f0fdf4' : isUnlisted ? '#fff7ed' : '#ffffff',
                      borderBottom: '1px solid #f1f5f9'
                    }}
                  >
                    <td style={{ textAlign: 'center', color: '#94a3b8', fontSize: '11px', padding: '6px 8px', borderBottom: '1px solid #f1f5f9' }}>
                      {idx + 1}
                    </td>

                    <td style={{ textAlign: 'center', padding: '6px 8px', borderBottom: '1px solid #f1f5f9' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleItemStatus(item)}
                        style={{
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          fontSize: '10.5px',
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          border: 'none',
                          cursor: 'pointer',
                          background: isScanned ? '#059669' : isUnlisted ? '#e11d48' : '#e2e8f0',
                          color: isScanned || isUnlisted ? '#ffffff' : '#334155'
                        }}
                      >
                        {isScanned ? '✓ COTEJADO' : isUnlisted ? 'NO ESPERADO' : 'PENDIENTE'}
                      </button>
                    </td>

                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '12px', color: '#0f172a' }}>
                        {item.codigoWr}
                      </span>
                    </td>

                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9', fontWeight: 600, color: '#334155' }}>
                      {item.consignatario || '-'}
                    </td>

                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9', fontFamily: 'monospace', fontSize: '11.5px', color: '#64748b' }}>
                      {item.casillero || '-'}
                    </td>

                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9', fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>
                      {item.trackingUsa || '-'}
                    </td>

                    <td style={{ textAlign: 'right', padding: '6px 8px', borderBottom: '1px solid #f1f5f9', fontFamily: 'monospace', fontWeight: 700 }}>
                      {item.pesoKg ? `${item.pesoKg.toFixed(2)} kg` : '-'}
                    </td>

                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9' }}>
                      <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '11px', padding: '1px 5px', borderRadius: '4px', background: '#faf5ff', color: '#7e22ce', border: '1px solid #f3e8ff' }}>
                        {item.posicionEstante || 'REC'}
                      </span>
                    </td>

                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9', fontSize: '11px', fontFamily: 'monospace', color: '#64748b' }}>
                      {item.escaneadoEn ? new Date(item.escaneadoEn).toLocaleTimeString('es-PE') : '-'}
                    </td>

                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9', fontSize: '11.5px', color: '#475569' }}>
                      {item.escaneadoPor || '-'}
                    </td>

                    <td style={{ padding: '6px 8px', borderBottom: '1px solid #f1f5f9', fontSize: '11px', color: '#64748b' }}>
                      {item.notas || '-'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modals */}
      <PasteWrListModal
        isOpen={isPasteModalOpen}
        onClose={() => setIsPasteModalOpen(false)}
        onImport={async items => {
          if (!activeHojaId) return;
          const rowsToInsert = items.map((p, idx) => ({
            hoja_id: activeHojaId,
            codigo_wr: p.codigoWr,
            tracking_usa: p.trackingUsa || '',
            casillero: p.casillero || '',
            consignatario: p.consignatario || '',
            peso_kg: p.pesoKg || 0,
            posicion_estante: p.posicionEstante || 'REC',
            notas: p.notas || '',
            estado: 'PENDIENTE',
            veces_escaneado: 0,
            orden: idx + 1
          }));

          const { error } = await supabase.from('hojas_cotejo_items').insert(rowsToInsert);
          if (!error) {
            soundEffects.playBulkLoaded();
            fetchItems(activeHojaId);
          }
        }}
        paquetes={paquetes}
      />

      <NewSheetModal
        isOpen={isNewSheetModalOpen}
        onClose={() => setIsNewSheetModalOpen(false)}
        onCreated={sheet => {
          setHojas(prev => [sheet, ...prev]);
          setActiveHojaId(sheet.id);
        }}
        operatorName={operatorName}
      />

      <MobileScannerModal
        isOpen={isCameraScannerOpen}
        onClose={() => setIsCameraScannerOpen(false)}
        onConfirm={code => {
          setIsCameraScannerOpen(false);
          processBarcodeScan(code);
        }}
      />
    </div>
  );
}
