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
  Plus
} from 'lucide-react';
import { Paquete, Cliente } from '@/types';
import { supabase } from '@/lib/supabase/client';

const MobileScannerModal = dynamic(
  () => import('@/components/scanner/MobileScannerModal'),
  { ssr: false }
);

interface ScannedLog {
  code: string;
  format: string;
  time: string;
  location?: string;
  synced?: boolean;
}

interface ScannerTabProps {
  scannedLogs: ScannedLog[];
  paquetes?: Paquete[];
  clientes?: Cliente[];
  onConfirm: (code: string, format: string, extra?: { mode: string; location?: string }) => void;
  onSlotPackage?: (code: string, location: string) => void;
}

export default function ScannerTab({
  scannedLogs,
  paquetes = [],
  clientes = [],
  onConfirm,
  onSlotPackage
}: ScannerTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [liveSearchQuery, setLiveSearchQuery] = useState('');
  const [copiedNotification, setCopiedNotification] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncNotification, setSyncNotification] = useState<string | null>(null);

  // Conteo de paquetes por Anaquel y Pisos
  const a1_P1 = paquetes.filter(p => (p.posicionEstante === 'A1-P1' || (p.anaquel === 'A1' && p.piso === 'P1'))).length;
  const a1_P2 = paquetes.filter(p => (p.posicionEstante === 'A1-P2' || (p.anaquel === 'A1' && p.piso === 'P2'))).length;
  const a1_P3 = paquetes.filter(p => (p.posicionEstante === 'A1-P3' || (p.anaquel === 'A1' && p.piso === 'P3'))).length;
  const totalA1 = a1_P1 + a1_P2 + a1_P3;

  const a2_P1 = paquetes.filter(p => (p.posicionEstante === 'A2-P1' || (p.anaquel === 'A2' && p.piso === 'P1'))).length;
  const a2_P2 = paquetes.filter(p => (p.posicionEstante === 'A2-P2' || (p.anaquel === 'A2' && p.piso === 'P2'))).length;
  const a2_P3 = paquetes.filter(p => (p.posicionEstante === 'A2-P3' || (p.anaquel === 'A2' && p.piso === 'P3'))).length;
  const totalA2 = a2_P1 + a2_P2 + a2_P3;

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

  const filteredLogs = scannedLogs.filter(log =>
    log.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.format.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.location && log.location.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCopyAll = () => {
    if (scannedLogs.length === 0) return;
    const text = scannedLogs.map(l => `${l.code}\t${l.location || 'N/A'}\t${l.time}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  const handleExportCsv = () => {
    if (scannedLogs.length === 0) return;
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' +
      'Index,Codigo,Formato,Ubicacion_Estante,Hora,Estado_DB\n' +
      scannedLogs.map((l, i) => `${i + 1},"${l.code}","${l.format}","${l.location || 'N/A'}","${l.time}","Guardado en Supabase"`).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `escaneos_anaqueles_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Sincronización Forzada a Supabase de todos los escaneos
  const handleSyncAllToSupabase = async () => {
    if (scannedLogs.length === 0) return;
    setIsSyncingAll(true);

    try {
      for (const log of scannedLogs) {
        await supabase.from('escaneos_log').insert({
          codigo: log.code,
          formato: log.format,
          modo_workflow: 'slotting',
          ubicacion: log.location || null,
          operador: 'Operador Logístico AMEX'
        });

        if (log.location) {
          const upper = log.code.trim().toUpperCase();
          const [ana, pis] = log.location.includes('-') ? log.location.split('-') : [log.location, 'P1'];
          await supabase
            .from('paquetes')
            .update({
              anaquel: ana,
              piso: pis,
              posicion_estante: log.location
            })
            .or(`numero_recibo_bodega.eq.${upper},tracking_usa.eq.${upper},codigo_casillero.eq.${upper}`);
        }
      }

      setSyncNotification(`✓ ${scannedLogs.length} escaneos sincronizados con éxito a Supabase.`);
      setTimeout(() => setSyncNotification(null), 3000);
    } catch (err) {
      console.warn('Error syncing logs to Supabase:', err);
      setSyncNotification('Error al sincronizar con Supabase.');
      setTimeout(() => setSyncNotification(null), 3000);
    } finally {
      setIsSyncingAll(false);
    }
  };

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="sap-breadcrumb">
        <span>Operaciones y Almacenes</span> / <span>Escáner de Códigos, Búsqueda 360° & Slotting WMS</span>
      </div>

      {/* Notificación de sincronización */}
      {syncNotification && (
        <div style={{ background: '#dcfce7', border: '1px solid #86efac', color: '#166534', padding: '10px 16px', borderRadius: '8px', fontWeight: 800, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <span>{syncNotification}</span>
        </div>
      )}

      {/* Grid Principal: Lado Izquierdo (Visor Escáner) / Lado Derecho (Búsqueda 360° + Anaqueles + Historial) */}
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

        {/* LADO DERECHO: BÚSQUEDA 360°, OCUPACIÓN Y REGISTROS */}
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
                          background: '#dcfce7',
                          color: '#166534',
                          border: '1px solid #86efac'
                        }}
                      >
                        📍 {lookupMatch.pkg.posicionEstante || lookupMatch.pkg.ubicacionActual || 'REC'}
                      </span>
                    </div>

                    <div style={{ fontSize: '12px', color: '#0f172a', marginBottom: '6px' }}>
                      <strong>Consignatario:</strong> {lookupMatch.pkg.nombreConsignatario || lookupMatch.cli?.nombre || 'No registrado'} ({lookupMatch.pkg.codigoCasillero})
                    </div>

                    {lookupMatch.pkg.descripcion && (
                      <div style={{ fontSize: '11.5px', color: '#475569', marginBottom: '8px' }}>
                        📦 {lookupMatch.pkg.descripcion} · <strong>{lookupMatch.pkg.pesoKg} Kg</strong>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                      {lookupMatch.cli?.telefono && (
                        <a
                          href={`https://wa.me/${lookupMatch.cli.telefono.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                            `Hola ${lookupMatch.cli.nombre}, te saludamos de AMEX Courier. Tu paquete ${lookupMatch.pkg.numeroReciboBodega} se encuentra en nuestro almacén (${lookupMatch.pkg.posicionEstante || 'Sede Lince'}).`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn"
                          style={{
                            background: '#22c55e',
                            color: '#ffffff',
                            padding: '4px 10px',
                            fontSize: '11.5px',
                            fontWeight: 800,
                            borderRadius: '6px',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> Avisar por WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#b45309', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles className="w-4 h-4 text-amber-600" />
                    <span>No se encontró ningún paquete con &quot;{lookupMatch.query}&quot; en la base de datos.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* TARJETAS DE OCUPACIÓN FÍSICA (2 ANAQUELES × 3 PISOS) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {/* Anaquel 1 */}
            <div style={{ background: '#ffffff', border: '1.5px solid #bfdbfe', borderRadius: '12px', padding: '12px 14px', boxShadow: '0 2px 6px rgba(37,99,235,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#dbeafe', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Layers className="w-4 h-4" />
                  </div>
                  <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#1e3a8a' }}>Anaquel 1 (A1)</span>
                </div>
                <span style={{ fontSize: '15px', fontWeight: 900, color: '#2563eb' }}>{totalA1} <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>pkgs</span></span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', textAlign: 'center', fontSize: '10.5px' }}>
                <div style={{ background: '#eff6ff', padding: '4px', borderRadius: '4px', color: '#1e40af' }}>
                  <strong>P1:</strong> {a1_P1}
                </div>
                <div style={{ background: '#eff6ff', padding: '4px', borderRadius: '4px', color: '#1e40af' }}>
                  <strong>P2:</strong> {a1_P2}
                </div>
                <div style={{ background: '#eff6ff', padding: '4px', borderRadius: '4px', color: '#1e40af' }}>
                  <strong>P3:</strong> {a1_P3}
                </div>
              </div>
            </div>

            {/* Anaquel 2 */}
            <div style={{ background: '#ffffff', border: '1.5px solid #bbf7d0', borderRadius: '12px', padding: '12px 14px', boxShadow: '0 2px 6px rgba(22,163,74,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Layers className="w-4 h-4" />
                  </div>
                  <span style={{ fontSize: '12.5px', fontWeight: 800, color: '#14532d' }}>Anaquel 2 (A2)</span>
                </div>
                <span style={{ fontSize: '15px', fontWeight: 900, color: '#16a34a' }}>{totalA2} <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748b' }}>pkgs</span></span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', textAlign: 'center', fontSize: '10.5px' }}>
                <div style={{ background: '#f0fdf4', padding: '4px', borderRadius: '4px', color: '#166534' }}>
                  <strong>P1:</strong> {a2_P1}
                </div>
                <div style={{ background: '#f0fdf4', padding: '4px', borderRadius: '4px', color: '#166534' }}>
                  <strong>P2:</strong> {a2_P2}
                </div>
                <div style={{ background: '#f0fdf4', padding: '4px', borderRadius: '4px', color: '#166534' }}>
                  <strong>P3:</strong> {a2_P3}
                </div>
              </div>
            </div>
          </div>

          {/* TABLA DE LECTURAS Y REGISTROS CON PERSISTENCIA EN BD */}
          <div className="card-panel">
            <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Barcode className="w-4 h-4 text-blue-600" /> Registro de Lecturas en Base de Datos
                </h3>
                <span className="panel-count">{scannedLogs.length}</span>
              </div>

              {scannedLogs.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleSyncAllToSupabase}
                    disabled={isSyncingAll}
                    className="btn btn-primary"
                    style={{ height: '30px', padding: '0 10px', fontSize: '11.5px', borderRadius: '6px', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="Sincronizar todas las lecturas con Supabase"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? 'animate-spin' : ''}`} />
                    {isSyncingAll ? 'Sincronizando...' : '⚡ Sincronizar a BD'}
                  </button>

                  <button
                    onClick={handleCopyAll}
                    className="btn btn-secondary"
                    style={{ height: '30px', padding: '0 8px', fontSize: '11.5px', borderRadius: '6px', fontWeight: 700 }}
                    title="Copiar lista de códigos"
                  >
                    <Copy className="w-3.5 h-3.5" /> {copiedNotification ? '¡Copiado!' : 'Copiar'}
                  </button>

                  <button
                    onClick={handleExportCsv}
                    className="btn btn-secondary"
                    style={{ height: '30px', padding: '0 8px', fontSize: '11.5px', borderRadius: '6px', fontWeight: 700 }}
                    title="Exportar CSV para Excel"
                  >
                    <Download className="w-3.5 h-3.5" /> CSV
                  </button>
                </div>
              )}
            </div>

            {/* Buscador interno del historial */}
            {scannedLogs.length > 2 && (
              <div style={{ padding: '0 16px 12px 16px' }}>
                <div style={{ position: 'relative' }}>
                  <Search className="w-4 h-4 text-slate-400" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                  <input
                    type="text"
                    placeholder="Filtrar historial por código o ubicación..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      height: '34px',
                      paddingLeft: '34px',
                      paddingRight: '12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>
            )}

            {filteredLogs.length > 0 ? (
              <div className="table-responsive" style={{ maxHeight: '360px', overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '30px' }}>#</th>
                      <th>Código Extraído</th>
                      <th>Ubicación Asignada</th>
                      <th>Estado BD</th>
                      <th>Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log, i) => {
                      const isA1 = log.location?.startsWith('A1');
                      const isA2 = log.location?.startsWith('A2');

                      return (
                        <tr key={`${log.code}-${i}`}>
                          <td style={{ color: '#94a3b8', fontWeight: 700, fontSize: '11px' }}>{filteredLogs.length - i}</td>
                          <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 800, color: '#0f172a', wordBreak: 'break-all', fontSize: '12.5px' }}>
                            {log.code}
                          </td>
                          <td>
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
                              <span className="cell-grey" style={{ fontSize: '11px' }}>General</span>
                            )}
                          </td>
                          <td>
                            <span style={{ fontSize: '10.5px', fontWeight: 800, color: '#16a34a', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Sincronizado
                            </span>
                          </td>
                          <td className="cell-mono" style={{ fontSize: '11px', color: '#64748b' }}>
                            {log.time}
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
                    <p style={{ fontWeight: 700, color: '#475569', margin: 0 }}>Sin lecturas en esta sesión</p>
                    <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                      Selecciona un anaquel y piso en el escáner y apunta a los paquetes para asignar ubicaciones al instante.
                    </p>
                  </>
                ) : (
                  <p style={{ fontWeight: 600, color: '#64748b', margin: 0 }}>
                    No se encontraron códigos que coincidan con &quot;{searchTerm}&quot;.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
