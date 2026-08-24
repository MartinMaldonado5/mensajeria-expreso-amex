'use client';

import React, { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import {
  Barcode,
  CheckCircle2,
  Copy,
  Download,
  Search,
  Layers,
  Box,
  RefreshCw,
  Trash2,
  MapPin,
  User,
  MessageCircle,
  Sparkles,
  ExternalLink,
  Check,
  Plus,
  Edit3,
  AlertTriangle,
  UploadCloud,
  CheckSquare,
  Square,
  Clock,
  ArrowRight,
  ShieldCheck,
  X
} from 'lucide-react';
import { Paquete, Cliente, ScannedLog } from '@/types';
import { supabase } from '@/lib/supabase/client';

const MobileScannerModal = dynamic(
  () => import('@/components/scanner/MobileScannerModal'),
  { ssr: false }
);

interface ScannerTabProps {
  scannedLogs: ScannedLog[];
  paquetes?: Paquete[];
  clientes?: Cliente[];
  onConfirm: (code: string, format: string, extra?: { mode: string; location?: string; anaquel?: string; piso?: string; pkg?: Paquete; cli?: Cliente }) => void;
  onSlotPackage?: (code: string, location: string) => void;
  onUpdateLogs?: React.Dispatch<React.SetStateAction<ScannedLog[]>>;
}

export default function ScannerTab({
  scannedLogs = [],
  paquetes = [],
  clientes = [],
  onConfirm,
  onSlotPackage,
  onUpdateLogs
}: ScannerTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'SYNCED'>('ALL');
  const [liveSearchQuery, setLiveSearchQuery] = useState('');
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [syncNotification, setSyncNotification] = useState<string | null>(null);

  // Selección múltiple para decisión de subida
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modales de Confirmación y Edición
  const [isConfirmSyncModalOpen, setIsConfirmSyncModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [editingLog, setEditingLog] = useState<ScannedLog | null>(null);

  // Conteo de paquetes por Anaquel y Pisos
  const a1_P1 = paquetes.filter(p => (p.posicionEstante === 'A1-P1' || (p.anaquel === 'A1' && p.piso === 'P1'))).length;
  const a1_P2 = paquetes.filter(p => (p.posicionEstante === 'A1-P2' || (p.anaquel === 'A1' && p.piso === 'P2'))).length;
  const a1_P3 = paquetes.filter(p => (p.posicionEstante === 'A1-P3' || (p.anaquel === 'A1' && p.piso === 'P3'))).length;
  const totalA1 = a1_P1 + a1_P2 + a1_P3;

  const a2_P1 = paquetes.filter(p => (p.posicionEstante === 'A2-P1' || (p.anaquel === 'A2' && p.piso === 'P1'))).length;
  const a2_P2 = paquetes.filter(p => (p.posicionEstante === 'A2-P2' || (p.anaquel === 'A2' && p.piso === 'P2'))).length;
  const a2_P3 = paquetes.filter(p => (p.posicionEstante === 'A2-P3' || (p.anaquel === 'A2' && p.piso === 'P3'))).length;
  const totalA2 = a2_P1 + a2_P2 + a2_P3;

  // Filtrado de lecturas
  const pendingLogs = useMemo(() => scannedLogs.filter(l => !l.synced), [scannedLogs]);
  const syncedLogs = useMemo(() => scannedLogs.filter(l => l.synced), [scannedLogs]);

  const filteredLogs = useMemo(() => {
    return scannedLogs.filter(log => {
      const matchesSearch =
        log.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.format.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (log.location && log.location.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.nombreConsignatario && log.nombreConsignatario.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (log.codigoCasillero && log.codigoCasillero.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'PENDING'
          ? !log.synced
          : log.synced;

      return matchesSearch && matchesStatus;
    });
  }, [scannedLogs, searchTerm, statusFilter]);

  // Selección individual y masiva
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSelectAllFiltered = () => {
    if (selectedIds.length === filteredLogs.length && filteredLogs.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredLogs.map(l => l.id));
    }
  };

  const handleSelectOnlyPending = () => {
    setSelectedIds(pendingLogs.map(l => l.id));
  };

  // Helper para persistir cambios en localStorage
  const saveLogsToStorage = (updated: ScannedLog[]) => {
    if (onUpdateLogs) {
      onUpdateLogs(updated);
    }
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('amex_scanner_staging_queue_v2', JSON.stringify(updated));
      } catch (err) {
        console.warn('Error saving to localStorage:', err);
      }
    }
  };

  // Eliminar lectura de la cola local
  const handleDeleteLog = (id: string) => {
    const updated = scannedLogs.filter(l => l.id !== id);
    saveLogsToStorage(updated);
    setSelectedIds(prev => prev.filter(x => x !== id));
  };

  // Eliminar seleccionados
  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) return;
    if (confirm(`¿Estás seguro de descartar ${selectedIds.length} lectura(s) de la cola local?`)) {
      const updated = scannedLogs.filter(l => !selectedIds.includes(l.id));
      saveLogsToStorage(updated);
      setSelectedIds([]);
    }
  };

  // Guardar edición de una lectura local
  const handleSaveEditLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog) return;

    const loc = `${editingLog.anaquel || 'A1'}-${editingLog.piso || 'P1'}`;
    const updatedLog: ScannedLog = {
      ...editingLog,
      location: loc
    };

    const updated = scannedLogs.map(l => l.id === updatedLog.id ? updatedLog : l);
    saveLogsToStorage(updated);

    if (onSlotPackage) {
      onSlotPackage(updatedLog.code, loc);
    }

    setEditingLog(null);
  };

  // Copiar y Exportar CSV
  const handleCopyAll = () => {
    if (scannedLogs.length === 0) return;
    const text = scannedLogs.map(l => `${l.code}\t${l.location || 'N/A'}\t${l.synced ? 'SINCRONIZADO' : 'PENDIENTE'}\t${l.time}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  const handleExportCsv = () => {
    if (scannedLogs.length === 0) return;
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' +
      'Index,Codigo_WR,Formato,Ubicacion_Estante,Consignatario,Casillero,Hora,Estado_Sincronizacion\n' +
      scannedLogs.map((l, i) => `${i + 1},"${l.code}","${l.format}","${l.location || 'N/A'}","${l.nombreConsignatario || ''}","${l.codigoCasillero || ''}","${l.time}","${l.synced ? 'Sincronizado Master' : 'Borrador Local'}"`).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `lecturas_cola_amex_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 🚀 SUBIDA CONFIRMADA A SUPABASE MASTER
  const handleExecuteMasterSync = async () => {
    // Determinar qué logs se van a subir: si hay seleccionados, solo los seleccionados; si no, todos los pendientes
    const targetLogs = selectedIds.length > 0
      ? scannedLogs.filter(l => selectedIds.includes(l.id))
      : pendingLogs;

    if (targetLogs.length === 0) {
      alert('No hay lecturas seleccionadas o pendientes para sincronizar.');
      return;
    }

    setIsSyncing(true);
    setSyncProgress({ current: 0, total: targetLogs.length });

    try {
      let count = 0;
      for (const log of targetLogs) {
        const upper = log.code.trim().toUpperCase();
        const loc = log.location || (log.anaquel && log.piso ? `${log.anaquel}-${log.piso}` : 'REC');
        const [ana, pis] = loc.includes('-') ? loc.split('-') : [loc, 'P1'];

        // 1. Buscar si el paquete ya existe en el estado local o base de datos
        const existingPkg = paquetes.find(
          p =>
            p.numeroReciboBodega.toUpperCase() === upper ||
            p.trackingUsa.toUpperCase() === upper ||
            p.codigoCasillero.toUpperCase() === upper
        );

        if (existingPkg) {
          // Actualizar paquete existente
          await supabase
            .from('paquetes')
            .update({
              anaquel: ana,
              piso: pis,
              posicion_estante: loc,
              ubicacion_actual: 'AmexLince'
            })
            .eq('id', existingPkg.id);

          await supabase.from('historial_trazabilidad').insert({
            paquete_id: existingPkg.id,
            ubicacion: loc,
            descripcion_evento: `Escaneado confirmado y clasificado a estante: ${loc}`,
            usuario_operador: 'Operador Logístico AMEX'
          });
        } else {
          // Insertar nuevo paquete si no existía
          const newWr = upper.startsWith('WR-') ? upper : `WR-${upper.slice(-6)}`;
          await supabase.from('paquetes').insert({
            codigo_casillero: log.codigoCasillero || 'AMEX-PER-1001',
            numero_recibo_bodega: newWr,
            tracking_usa: upper,
            tipo_empaque: 'CAJA',
            dni_consignatario: '',
            nombre_consignatario: log.nombreConsignatario || 'Cliente AMEX',
            descripcion: 'Mercadería ingresada por Escáner',
            peso_kg: 1.0,
            valor_declarado_usd: 50.0,
            ubicacion_actual: 'AmexLince',
            anaquel: ana,
            piso: pis,
            posicion_estante: loc,
            metodo_entrega: 'CarroAmexDomicilio',
            estado_entrega: 'EnAlmacen'
          });
        }

        // 2. Registrar evento inmutable en Kardex
        await supabase.from('movimientos_kardex').insert({
          paquete_id: existingPkg ? existingPkg.id : null,
          codigo_paquete: existingPkg ? existingPkg.numeroReciboBodega : upper,
          consignatario: log.nombreConsignatario || (existingPkg ? existingPkg.nombreConsignatario : 'Cliente AMEX'),
          origen_descripcion: existingPkg ? `${existingPkg.ubicacionActual} (${existingPkg.posicionEstante || 'REC'})` : 'Recepción Escáner',
          destino_descripcion: `AmexLince (${loc})`,
          tipo_movimiento: 'SLOTTING',
          motivo: `Clasificación y Slotting Escáner a estante ${loc}`,
          usuario_operador: 'Operador Logístico AMEX'
        });

        // 3. Registrar auditoría en escaneos_log
        await supabase.from('escaneos_log').insert({
          codigo: log.code,
          formato: log.format,
          modo_workflow: log.workflow || 'slotting',
          ubicacion: loc,
          operador: 'Operador Logístico AMEX'
        });

        count++;
        setSyncProgress({ current: count, total: targetLogs.length });
      }

      // Marcar los logs como sincronizados
      const targetIds = targetLogs.map(l => l.id);
      const updatedLogs = scannedLogs.map(l =>
        targetIds.includes(l.id) ? { ...l, synced: true, syncedAt: new Date().toISOString() } : l
      );

      saveLogsToStorage(updatedLogs);
      setSelectedIds([]);
      setIsConfirmSyncModalOpen(false);

      setSyncNotification(`✓ ¡Éxito! ${targetLogs.length} paquete(s) y movimientos Kardex guardados en Supabase Master.`);
      setTimeout(() => setSyncNotification(null), 4000);
    } catch (err) {
      console.error('Error syncing staging logs to Supabase Master:', err);
      alert('Ocurrió un problema al sincronizar con la base de datos master.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Sincronizar un único item individualmente
  const handleSyncSingleLog = async (log: ScannedLog) => {
    setSelectedIds([log.id]);
    setIsConfirmSyncModalOpen(true);
  };

  // Búsqueda 360° en vivo
  const lookupMatch = useMemo(() => {
    const q = liveSearchQuery.trim().toUpperCase();
    if (!q) return null;

    const foundPkg = paquetes.find(p =>
      p.numeroReciboBodega.toUpperCase() === q ||
      p.trackingUsa.toUpperCase() === q ||
      p.codigoCasillero.toUpperCase() === q ||
      p.dniConsignatario?.toUpperCase() === q ||
      p.nombreConsignatario?.toUpperCase().includes(q)
    );

    const foundCli = clientes.find(c =>
      c.codigoCasillero.toUpperCase() === q ||
      c.documentoIdentidad === q ||
      (foundPkg && c.codigoCasillero.toUpperCase() === foundPkg.codigoCasillero.toUpperCase())
    );

    return {
      pkg: foundPkg,
      cli: foundCli,
      query: liveSearchQuery
    };
  }, [liveSearchQuery, paquetes, clientes]);

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="sap-breadcrumb">
        <span>Operaciones y Almacenes</span> / <span>Escáner de Códigos, Búsqueda 360° & Slotting WMS</span>
      </div>

      {/* Notificación flotante de sincronización */}
      {syncNotification && (
        <div style={{ background: '#dcfce7', border: '1px solid #86efac', color: '#166534', padding: '12px 16px', borderRadius: '10px', fontWeight: 800, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(22,163,74,0.15)' }}>
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <span>{syncNotification}</span>
        </div>
      )}

      {/* Grid Principal: Lado Izquierdo (Visor Escáner) / Lado Derecho (Búsqueda 360° + Anaqueles + Bandeja de Subida) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 340px), 1fr))', gap: '16px', alignItems: 'start' }}>
        
        {/* LADO IZQUIERDO: VISOR DE CÁMARA Y DETECCIÓN */}
        <div>
          <MobileScannerModal
            isOpen={true}
            isInline={true}
            paquetes={paquetes}
            clientes={clientes}
            onClose={() => {}}
            onConfirm={onConfirm}
            onSlotPackage={onSlotPackage}
          />
        </div>

        {/* LADO DERECHO: BÚSQUEDA 360°, OCUPACIÓN Y BANDEJA DE CONFIRMACIÓN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* BARRA DE BÚSQUEDA 360° EN VIVO */}
          <div style={{ background: '#ffffff', border: '1.5px solid #3b82f6', borderRadius: '12px', padding: '14px', boxShadow: '0 2px 8px rgba(37,99,235,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Search className="w-4 h-4 text-blue-600" /> Búsqueda 360° y Localizador en Base de Datos
              </span>
              <span style={{ fontSize: '11px', background: '#dbeafe', color: '#1d4ed8', padding: '2px 8px', borderRadius: '999px', fontWeight: 800 }}>
                En Vivo
              </span>
            </div>

            <div style={{ position: 'relative' }}>
              <Search style={{ position: 'absolute', left: '10px', top: '10px', width: '16px', height: '16px', color: '#94a3b8' }} />
              <input
                type="text"
                placeholder="Ingresa o pega Guía WR#, Tracking USA, Casillero o DNI..."
                value={liveSearchQuery}
                onChange={e => setLiveSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px 8px 34px',
                  borderRadius: '8px',
                  border: '1.5px solid #93c5fd',
                  fontSize: '13px',
                  background: '#f8fafc',
                  outline: 'none'
                }}
              />
            </div>

            {/* Resultado de Búsqueda 360° */}
            {lookupMatch && (
              <div style={{ marginTop: '12px', background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '10px', padding: '12px' }}>
                {lookupMatch.pkg ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <span style={{ fontFamily: 'JetBrains Mono', fontSize: '14px', fontWeight: 900, color: '#15803d' }}>
                          {lookupMatch.pkg.numeroReciboBodega}
                        </span>
                        <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                          Tracking: {lookupMatch.pkg.trackingUsa}
                        </div>
                      </div>

                      <span
                        style={{
                          fontSize: '12px',
                          fontWeight: 900,
                          padding: '3px 10px',
                          borderRadius: '6px',
                          fontFamily: 'monospace',
                          background: '#15803d',
                          color: '#ffffff'
                        }}
                      >
                        {lookupMatch.pkg.posicionEstante || `${lookupMatch.pkg.anaquel || 'A1'}-${lookupMatch.pkg.piso || 'P1'}`}
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11.5px', marginBottom: '8px' }}>
                      <div>
                        <span style={{ color: '#64748b' }}>Consignatario:</span>{' '}
                        <strong>{lookupMatch.pkg.nombreConsignatario || 'Cliente'}</strong>
                      </div>
                      <div>
                        <span style={{ color: '#64748b' }}>Casillero:</span>{' '}
                        <strong style={{ color: '#2563eb' }}>{lookupMatch.pkg.codigoCasillero}</strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    No se encontró ningún paquete con el código <strong>&quot;{lookupMatch.query}&quot;</strong>.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* KPI RIBBON DE COLA LOCAL Y LECTURAS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
            <div
              onClick={() => setStatusFilter('PENDING')}
              style={{
                background: statusFilter === 'PENDING' ? '#fef3c7' : '#ffffff',
                border: statusFilter === 'PENDING' ? '2px solid #f59e0b' : '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '10px',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
              }}
            >
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#b45309', textTransform: 'uppercase' }}>
                🟡 Cola Local (Pendientes)
              </div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#92400e', marginTop: '2px' }}>
                {pendingLogs.length} <span style={{ fontSize: '11px', fontWeight: 700 }}>lecturas</span>
              </div>
            </div>

            <div
              onClick={() => setStatusFilter('SYNCED')}
              style={{
                background: statusFilter === 'SYNCED' ? '#dcfce7' : '#ffffff',
                border: statusFilter === 'SYNCED' ? '2px solid #16a34a' : '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '10px',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
              }}
            >
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#15803d', textTransform: 'uppercase' }}>
                🟢 Sincronizados Master
              </div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#166534', marginTop: '2px' }}>
                {syncedLogs.length} <span style={{ fontSize: '11px', fontWeight: 700 }}>guardados</span>
              </div>
            </div>

            <div
              onClick={() => setStatusFilter('ALL')}
              style={{
                background: statusFilter === 'ALL' ? '#eff6ff' : '#ffffff',
                border: statusFilter === 'ALL' ? '2px solid #2563eb' : '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '10px',
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
              }}
            >
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>
                📦 Total en Sesión
              </div>
              <div style={{ fontSize: '18px', fontWeight: 900, color: '#1e3a8a', marginTop: '2px' }}>
                {scannedLogs.length} <span style={{ fontSize: '11px', fontWeight: 700 }}>totales</span>
              </div>
            </div>
          </div>

          {/* BANDEJA DE CONTROL & AUDITORÍA DE LECTURAS LOCALES */}
          <div className="card-panel">
            <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Barcode className="w-4 h-4 text-blue-600" /> Cola de Lecturas & Confirmación Master
                </h3>
                <span className="panel-count">{filteredLogs.length}</span>
              </div>

              {/* Botón de Sincronización Master */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  onClick={() => setIsConfirmSyncModalOpen(true)}
                  disabled={isSyncing || (selectedIds.length === 0 && pendingLogs.length === 0)}
                  className="btn btn-primary"
                  style={{
                    height: '34px',
                    padding: '0 12px',
                    fontSize: '12px',
                    borderRadius: '8px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: (selectedIds.length > 0 || pendingLogs.length > 0) ? '#16a34a' : '#94a3b8',
                    border: 'none',
                    boxShadow: (selectedIds.length > 0 || pendingLogs.length > 0) ? '0 2px 8px rgba(22,163,74,0.35)' : 'none'
                  }}
                  title="Confirmar y subir a base de datos master"
                >
                  <UploadCloud className="w-4 h-4" />
                  Subir a BD Master ({selectedIds.length > 0 ? selectedIds.length : pendingLogs.length})
                </button>

                {selectedIds.length > 0 && (
                  <button
                    onClick={handleDeleteSelected}
                    className="btn"
                    style={{ height: '34px', padding: '0 8px', fontSize: '11.5px', borderRadius: '8px', background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca', fontWeight: 700 }}
                    title="Descartar lecturas seleccionadas"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  onClick={handleCopyAll}
                  className="btn btn-secondary"
                  style={{ height: '34px', padding: '0 8px', fontSize: '11.5px', borderRadius: '8px', fontWeight: 700 }}
                  title="Copiar lista de códigos"
                >
                  <Copy className="w-3.5 h-3.5" /> {copiedNotification ? '¡Copiado!' : 'Copiar'}
                </button>

                <button
                  onClick={handleExportCsv}
                  className="btn btn-secondary"
                  style={{ height: '34px', padding: '0 8px', fontSize: '11.5px', borderRadius: '8px', fontWeight: 700 }}
                  title="Exportar CSV para Excel"
                >
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
              </div>
            </div>

            {/* Barra de Filtros y Selección Rápida */}
            <div style={{ padding: '0 16px 10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={handleSelectAllFiltered}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    color: '#334155'
                  }}
                >
                  {selectedIds.length > 0 && selectedIds.length === filteredLogs.length ? (
                    <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  {selectedIds.length === filteredLogs.length && filteredLogs.length > 0 ? 'Deseleccionar Todos' : 'Seleccionar Todos'}
                </button>

                {pendingLogs.length > 0 && (
                  <button
                    onClick={handleSelectOnlyPending}
                    style={{
                      background: '#fef3c7',
                      border: '1px solid #fde68a',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '11.5px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      color: '#92400e'
                    }}
                  >
                    Seleccionar Solo Pendientes ({pendingLogs.length})
                  </button>
                )}
              </div>

              {/* Buscador interno */}
              <div style={{ position: 'relative', flex: '1 1 180px', maxWidth: '280px' }}>
                <Search className="w-3.5 h-3.5 text-slate-400" style={{ position: 'absolute', left: '8px', top: '9px' }} />
                <input
                  type="text"
                  placeholder="Buscar en lecturas..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    height: '30px',
                    paddingLeft: '28px',
                    paddingRight: '8px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '11.5px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* TABLA DE LECTURAS LOCALES */}
            {filteredLogs.length > 0 ? (
              <div className="table-responsive" style={{ maxHeight: '380px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 800 }}>
                      <th style={{ width: '36px', padding: '8px 10px', textAlign: 'center' }}>✓</th>
                      <th style={{ padding: '8px 10px' }}>Código / WR</th>
                      <th style={{ padding: '8px 10px' }}>Ubicación Asignada</th>
                      <th style={{ padding: '8px 10px' }}>Estado BD</th>
                      <th style={{ padding: '8px 10px' }}>Hora</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map(log => {
                      const isSelected = selectedIds.includes(log.id);
                      const isA1 = log.location?.startsWith('A1');
                      const isA2 = log.location?.startsWith('A2');

                      return (
                        <tr
                          key={log.id}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            background: isSelected ? '#eff6ff' : '#ffffff',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          <td style={{ textAlign: 'center', padding: '8px 10px' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(log.id)}
                            />
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <div style={{ fontFamily: 'JetBrains Mono', fontWeight: 800, color: '#0f172a' }}>
                              {log.code}
                            </div>
                            {log.nombreConsignatario && (
                              <div style={{ fontSize: '10.5px', color: '#64748b' }}>
                                {log.nombreConsignatario} {log.codigoCasillero ? `(${log.codigoCasillero})` : ''}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            {log.location ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 7px',
                                  borderRadius: '5px',
                                  fontSize: '11px',
                                  fontWeight: 800,
                                  fontFamily: 'JetBrains Mono, monospace',
                                  background: isA1 ? '#dbeafe' : isA2 ? '#dcfce7' : '#fef3c7',
                                  color: isA1 ? '#1e40af' : isA2 ? '#166534' : '#92400e',
                                  border: `1px solid ${isA1 ? '#93c5fd' : isA2 ? '#86efac' : '#fde68a'}`
                                }}
                              >
                                <Layers className="w-3 h-3" />
                                {log.location}
                              </span>
                            ) : (
                              <span style={{ color: '#94a3b8', fontSize: '11px' }}>Recepción General</span>
                            )}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            {log.synced ? (
                              <span
                                style={{
                                  fontSize: '10.5px',
                                  fontWeight: 800,
                                  color: '#16a34a',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  background: '#dcfce7',
                                  padding: '2px 6px',
                                  borderRadius: '4px'
                                }}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Sincronizado Master
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: '10.5px',
                                  fontWeight: 800,
                                  color: '#b45309',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  background: '#fef3c7',
                                  padding: '2px 6px',
                                  borderRadius: '4px'
                                }}
                              >
                                <Clock className="w-3.5 h-3.5 text-amber-600" /> Borrador Local
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '8px 10px', fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                            {log.time}
                          </td>
                          <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', gap: '4px' }}>
                              <button
                                onClick={() => setEditingLog(log)}
                                title="Editar ubicación o código antes de sincronizar"
                                style={{
                                  background: '#f8fafc',
                                  border: '1px solid #cbd5e1',
                                  color: '#334155',
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {!log.synced && (
                                <button
                                  onClick={() => handleSyncSingleLog(log)}
                                  title="Subir solo este paquete a la base de datos master"
                                  style={{
                                    background: '#f0fdf4',
                                    border: '1px solid #86efac',
                                    color: '#16a34a',
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  <UploadCloud className="w-3.5 h-3.5" />
                                </button>
                              )}

                              <button
                                onClick={() => handleDeleteLog(log.id)}
                                title="Descartar de la cola local"
                                style={{
                                  background: '#fef2f2',
                                  border: '1px solid #fecaca',
                                  color: '#dc2626',
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ padding: '36px 20px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                <Barcode style={{ width: '36px', height: '36px', margin: '0 auto 10px auto', color: '#cbd5e1' }} />
                {scannedLogs.length === 0 ? (
                  <>
                    <p style={{ fontWeight: 700, color: '#475569', margin: 0 }}>Sin lecturas en cola</p>
                    <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                      Escanea o escribe guías WR con la cámara. Se guardarán en tu navegador para que las revises antes de subirlas.
                    </p>
                  </>
                ) : (
                  <p style={{ fontWeight: 600, color: '#64748b', margin: 0 }}>
                    No se encontraron registros con los filtros seleccionados.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 🚀 MODAL DE CONFIRMACIÓN FINAL PARA SUBIR A SUPABASE MASTER */}
      {isConfirmSyncModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#16a34a' }}>
                <ShieldCheck className="w-5 h-5" /> Confirmación Final de Sincronización Master
              </span>
              <button
                onClick={() => !isSyncing && setIsConfirmSyncModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: '#166534', marginBottom: '4px' }}>
                  Resumen del Lote a Guardar:
                </div>
                <div style={{ fontSize: '12px', color: '#334155' }}>
                  Vas a procesar y guardar permanentemente{' '}
                  <strong>
                    {selectedIds.length > 0 ? selectedIds.length : pendingLogs.length} paquete(s)
                  </strong>{' '}
                  en la base de datos de <strong>Supabase</strong> con sus ubicaciones de estantes y registros inmutables en el <strong>Kardex de Movimientos</strong>.
                </div>
              </div>

              {/* Lista previa compacta */}
              <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', background: '#f8fafc' }}>
                {(selectedIds.length > 0 ? scannedLogs.filter(l => selectedIds.includes(l.id)) : pendingLogs).map(l => (
                  <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 6px', borderBottom: '1px solid #f1f5f9', fontSize: '11.5px' }}>
                    <span style={{ fontWeight: 800, fontFamily: 'monospace', color: '#0f172a' }}>{l.code}</span>
                    <span style={{ fontWeight: 700, color: '#2563eb' }}>➔ {l.location || 'REC'}</span>
                  </div>
                ))}
              </div>

              {isSyncing && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 800, color: '#16a34a', marginBottom: '4px' }}>
                    <span>Guardando en Supabase Master...</span>
                    <span>{syncProgress.current} / {syncProgress.total}</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        background: '#16a34a',
                        width: `${syncProgress.total > 0 ? (syncProgress.current / syncProgress.total) * 100 : 0}%`,
                        transition: 'width 0.2s ease'
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                disabled={isSyncing}
                onClick={() => setIsConfirmSyncModalOpen(false)}
                className="btn btn-secondary"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSyncing}
                onClick={handleExecuteMasterSync}
                className="btn btn-primary"
                style={{ background: '#16a34a', borderColor: '#15803d', fontWeight: 800 }}
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Guardando...
                  </>
                ) : (
                  <>✓ Confirmar y Subir a Base de Datos Master</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✏️ MODAL DE EDICIÓN RÁPIDA DE LECTURA LOCAL */}
      {editingLog && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 className="w-4 h-4 text-blue-600" /> Modificar Lectura en Cola Local
              </span>
              <button
                onClick={() => setEditingLog(null)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditLog} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Código / Guía WR</label>
                <input
                  type="text"
                  value={editingLog.code}
                  onChange={e => setEditingLog({ ...editingLog, code: e.target.value.toUpperCase() })}
                  className="form-control"
                  style={{ fontFamily: 'monospace', fontWeight: 800 }}
                  required
                />
              </div>

              <div className="wms-modal-grid-2">
                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Anaquel Físico</label>
                  <select
                    value={editingLog.anaquel || 'A1'}
                    onChange={e => setEditingLog({ ...editingLog, anaquel: e.target.value })}
                    className="form-control"
                  >
                    <option value="A1">Anaquel 1 (A1)</option>
                    <option value="A2">Anaquel 2 (A2)</option>
                    <option value="REC">Recepción (REC)</option>
                    <option value="DSP">Despacho (DSP)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Piso / Nivel</label>
                  <select
                    value={editingLog.piso || 'P1'}
                    onChange={e => setEditingLog({ ...editingLog, piso: e.target.value })}
                    className="form-control"
                  >
                    <option value="P1">P1 (Inferior)</option>
                    <option value="P2">P2 (Medio)</option>
                    <option value="P3">P3 (Superior)</option>
                    <option value="P4">P4 (Especial)</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer" style={{ marginTop: '8px' }}>
                <button type="button" onClick={() => setEditingLog(null)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 800 }}>
                  ✓ Guardar Modificación Local
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
