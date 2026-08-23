'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Barcode,
  CheckCircle2,
  Copy,
  Download,
  Search,
  PackageCheck,
  Layers,
  Box
} from 'lucide-react';
import { Paquete, Cliente } from '@/types';

const MobileScannerModal = dynamic(
  () => import('@/components/scanner/MobileScannerModal'),
  { ssr: false }
);

interface ScannedLog {
  code: string;
  format: string;
  time: string;
  location?: string;
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
  const [copiedNotification, setCopiedNotification] = useState(false);

  // Conteo de paquetes por Anaquel y Pisos
  const a1_P1 = paquetes.filter(p => (p.posicionEstante === 'A1-P1' || (p.anaquel === 'A1' && p.piso === 'P1'))).length;
  const a1_P2 = paquetes.filter(p => (p.posicionEstante === 'A1-P2' || (p.anaquel === 'A1' && p.piso === 'P2'))).length;
  const a1_P3 = paquetes.filter(p => (p.posicionEstante === 'A1-P3' || (p.anaquel === 'A1' && p.piso === 'P3'))).length;
  const totalA1 = a1_P1 + a1_P2 + a1_P3;

  const a2_P1 = paquetes.filter(p => (p.posicionEstante === 'A2-P1' || (p.anaquel === 'A2' && p.piso === 'P1'))).length;
  const a2_P2 = paquetes.filter(p => (p.posicionEstante === 'A2-P2' || (p.anaquel === 'A2' && p.piso === 'P2'))).length;
  const a2_P3 = paquetes.filter(p => (p.posicionEstante === 'A2-P3' || (p.anaquel === 'A2' && p.piso === 'P3'))).length;
  const totalA2 = a2_P1 + a2_P2 + a2_P3;

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
    const csvContent = 'data:text/csv;charset=utf-8,' +
      'Index,Codigo,Formato,Ubicacion_Estante,Hora\n' +
      scannedLogs.map((l, i) => `${i + 1},"${l.code}","${l.format}","${l.location || 'N/A'}","${l.time}"`).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `escaneos_anaqueles_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="sap-breadcrumb">
        <span>Operaciones y Almacenes</span> / <span>Escáner de Códigos & Slotting WMS</span>
      </div>

      {/* Grid: Escáner a la izquierda / Panel y Registros a la derecha */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '16px', alignItems: 'start' }}>
        {/* Lado izquierdo: Visor de Cámara y Controles */}
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

        {/* Lado derecho: Ocupación de Anaqueles y Tabla de Lecturas */}
        <div>
          {/* Tarjetas de Ocupación Física (2 Anaqueles × 3 Pisos) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
              marginBottom: '16px'
            }}
          >
            {/* Anaquel 1 */}
            <div
              style={{
                background: '#ffffff',
                border: '1.5px solid #bfdbfe',
                borderRadius: '12px',
                padding: '12px 14px',
                boxShadow: '0 2px 6px rgba(37,99,235,0.06)'
              }}
            >
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
            <div
              style={{
                background: '#ffffff',
                border: '1.5px solid #bbf7d0',
                borderRadius: '12px',
                padding: '12px 14px',
                boxShadow: '0 2px 6px rgba(22,163,74,0.06)'
              }}
            >
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

          {/* Tabla de Códigos Confirmados */}
          <div className="card-panel">
            <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Barcode className="w-4 h-4 text-blue-600" /> Registro de Lecturas y Slotting
                </h3>
                <span className="panel-count">{scannedLogs.length}</span>
              </div>

              {scannedLogs.length > 0 && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={handleCopyAll}
                    className="btn btn-secondary"
                    style={{ height: '32px', padding: '0 10px', fontSize: '12px', borderRadius: '8px', fontWeight: 700, gap: '4px' }}
                    title="Copiar lista de códigos"
                  >
                    <Copy className="w-3.5 h-3.5" /> {copiedNotification ? '¡Copiado!' : 'Copiar'}
                  </button>

                  <button
                    onClick={handleExportCsv}
                    className="btn btn-secondary"
                    style={{ height: '32px', padding: '0 10px', fontSize: '12px', borderRadius: '8px', fontWeight: 700, gap: '4px' }}
                    title="Exportar CSV para Excel"
                  >
                    <Download className="w-3.5 h-3.5" /> CSV
                  </button>
                </div>
              )}
            </div>

            {/* Buscador de Códigos en Lote */}
            {scannedLogs.length > 2 && (
              <div style={{ padding: '0 16px 12px 16px' }}>
                <div style={{ position: 'relative' }}>
                  <Search className="w-4 h-4 text-slate-400" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                  <input
                    type="text"
                    placeholder="Filtrar por código, formato o ubicación (ej: A1-P2)..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    style={{
                      width: '100%',
                      height: '36px',
                      paddingLeft: '34px',
                      paddingRight: '12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12.5px',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>
            )}

            {filteredLogs.length > 0 ? (
              <div className="table-responsive" style={{ maxHeight: '380px', overflowY: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '35px' }}>#</th>
                      <th>Código Extraído</th>
                      <th>Ubicación Asignada</th>
                      <th>Formato</th>
                      <th>Hora</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log, i) => {
                      const isA1 = log.location?.startsWith('A1');
                      const isA2 = log.location?.startsWith('A2');

                      return (
                        <tr key={`${log.code}-${i}`}>
                          <td style={{ color: '#94a3b8', fontWeight: 700 }}>{filteredLogs.length - i}</td>
                          <td style={{ fontFamily: 'JetBrains Mono', fontWeight: 800, color: '#0f172a', wordBreak: 'break-all' }}>
                            {log.code}
                          </td>
                          <td>
                            {log.location ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
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
                            <span
                              className="badge badge-type"
                              style={{
                                fontSize: '10px',
                                background: log.format.includes('128') ? '#dbeafe' : '#f1f5f9',
                                color: log.format.includes('128') ? '#1d4ed8' : '#475569'
                              }}
                            >
                              {log.format}
                            </span>
                          </td>
                          <td className="cell-mono" style={{ fontSize: '11.5px', color: '#64748b' }}>
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
