'use client';

import React, { useState } from 'react';
import { Paquete, TipoUbicacion } from '@/types';
import { Layers, Box, CheckCircle2, Filter, FileSpreadsheet } from 'lucide-react';
import { exportPaquetesToExcel } from '@/lib/excelExport';

interface WarehouseTabProps {
  paquetes: Paquete[];
  location?: TipoUbicacion | 'deliveries';
  title?: string;
  subtitle?: string;
  breadcrumb?: string;
  onNewPackage: () => void;
  onViewPdf: (url: string) => void;
}

export default function MiamiTab({
  paquetes,
  location = 'TibCourierMiami',
  title = '1. Almacén Tib Courier (Miami, USA)',
  subtitle = 'Ingesta de compras con Guía WR#, Tipo Empaque e Invoices PDF en Cloudflare R2',
  breadcrumb = 'Almacén Miami (USA)',
  onNewPackage,
  onViewPdf
}: WarehouseTabProps) {
  const [shelfFilter, setShelfFilter] = useState<string>('ALL');
  const [floorFilter, setFloorFilter] = useState<string>('ALL');

  // Filtrado base por almacén / despacho
  const basePackages = location === 'deliveries'
    ? paquetes.filter(p => p.metodoEntrega === 'CarroAmexDomicilio' || p.estadoEntrega === 'EnRutaCarroAmex')
    : (location === 'TibTingoMaria' || location === 'TibCourierTingoMaria')
    ? paquetes.filter(p => p.ubicacionActual === 'TibTingoMaria' || p.ubicacionActual === 'TibCourierTingoMaria')
    : paquetes.filter(p => p.ubicacionActual === location);

  // Métricas de ocupación física
  const countA1 = basePackages.filter(p => (p.posicionEstante?.startsWith('A1') || p.anaquel === 'A1')).length;
  const countA2 = basePackages.filter(p => (p.posicionEstante?.startsWith('A2') || p.anaquel === 'A2')).length;
  const countRec = basePackages.filter(p => p.posicionEstante?.startsWith('REC') || p.anaquel === 'REC' || (!p.posicionEstante && !p.anaquel)).length;

  // Filtrado secundario por anaquel y piso
  const filteredPackages = basePackages.filter(p => {
    const pos = p.posicionEstante || (p.anaquel && p.piso ? `${p.anaquel}-${p.piso}` : 'REC');
    const matchesShelf = shelfFilter === 'ALL'
      ? true
      : shelfFilter === 'A1' ? pos.startsWith('A1')
      : shelfFilter === 'A2' ? pos.startsWith('A2')
      : shelfFilter === 'REC' ? (pos.startsWith('REC') || (!p.posicionEstante && !p.anaquel))
      : pos.startsWith(shelfFilter);

    const matchesFloor = floorFilter === 'ALL'
      ? true
      : pos.includes(floorFilter) || p.piso === floorFilter;

    return matchesShelf && matchesFloor;
  });

  return (
    <div>
      <div className="sap-breadcrumb">
        <span>Operaciones y Almacenes</span> / <span>{breadcrumb}</span>
      </div>
      <div className="page-title-bar">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn"
            onClick={() => exportPaquetesToExcel(filteredPackages, `Inventario_${location}`)}
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              color: '#166534',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 800
            }}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Exportar Excel (.xlsx)
          </button>
          <button className="btn btn-primary" onClick={onNewPackage}>
            <i className="fa-solid fa-box-open"></i> Registrar Paquete
          </button>
        </div>
      </div>

      {/* Tarjetas de Métricas de Ocupación por Anaquel */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', marginBottom: '16px' }}>
        <div
          onClick={() => { setShelfFilter('A1'); setFloorFilter('ALL'); }}
          style={{
            background: shelfFilter === 'A1' ? '#eff6ff' : '#ffffff',
            border: shelfFilter === 'A1' ? '2px solid #2563eb' : '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px 14px',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#dbeafe', color: '#1d4ed8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Anaquel 1 (3 Pisos)</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{countA1} <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>paquetes</span></div>
          </div>
        </div>

        <div
          onClick={() => { setShelfFilter('A2'); setFloorFilter('ALL'); }}
          style={{
            background: shelfFilter === 'A2' ? '#f0fdf4' : '#ffffff',
            border: shelfFilter === 'A2' ? '2px solid #16a34a' : '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px 14px',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#dcfce7', color: '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Anaquel 2 (3 Pisos)</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{countA2} <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>paquetes</span></div>
          </div>
        </div>

        <div
          onClick={() => { setShelfFilter('REC'); setFloorFilter('ALL'); }}
          style={{
            background: shelfFilter === 'REC' ? '#fefce8' : '#ffffff',
            border: shelfFilter === 'REC' ? '2px solid #ca8a04' : '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px 14px',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            transition: 'all 0.15s ease'
          }}
        >
          <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#fef3c7', color: '#b45309', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box className="w-5 h-5" />
          </div>
          <div>
            <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Recepción / Sin Estante</div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>{countRec} <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>paquetes</span></div>
          </div>
        </div>
      </div>

      <div className="card-panel">
        <div className="panel-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-boxes-stacked" style={{ color: '#2563eb' }}></i>
              Inventario en Almacén
            </h3>
            <span className="panel-count">{filteredPackages.length} paquete{filteredPackages.length === 1 ? '' : 's'}</span>
          </div>

          {/* Filtros rápidos de Anaquel y Piso */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#64748b', fontWeight: 700 }}>
              <Filter className="w-3.5 h-3.5" /> Anaquel:
            </div>
            <select
              value={shelfFilter}
              onChange={e => setShelfFilter(e.target.value)}
              style={{
                height: '32px',
                fontSize: '12px',
                fontWeight: 700,
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                padding: '0 8px',
                background: '#ffffff',
                color: '#334155'
              }}
            >
              <option value="ALL">Todos los Anaqueles</option>
              <option value="A1">Anaquel 1 (A1)</option>
              <option value="A2">Anaquel 2 (A2)</option>
              <option value="REC">Mesa Recepción</option>
            </select>

            <select
              value={floorFilter}
              onChange={e => setFloorFilter(e.target.value)}
              style={{
                height: '32px',
                fontSize: '12px',
                fontWeight: 700,
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                padding: '0 8px',
                background: '#ffffff',
                color: '#334155'
              }}
            >
              <option value="ALL">Todos los Pisos</option>
              <option value="P1">Piso 1 (Inferior)</option>
              <option value="P2">Piso 2 (Medio)</option>
              <option value="P3">Piso 3 (Superior)</option>
            </select>

            {(shelfFilter !== 'ALL' || floorFilter !== 'ALL') && (
              <button
                onClick={() => { setShelfFilter('ALL'); setFloorFilter('ALL'); }}
                style={{
                  height: '32px',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#dc2626',
                  background: '#fee2e2',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0 8px',
                  cursor: 'pointer'
                }}
              >
                Limpiar Filtros
              </button>
            )}
          </div>
        </div>

        <div className="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Guía WR #</th>
                <th>Estante / Piso</th>
                <th>Tracking USA</th>
                <th>Casillero</th>
                <th>Consignatario</th>
                <th>Descripción</th>
                <th>Peso (Kg)</th>
                <th>FOB ($)</th>
                <th>Estado Entrega</th>
                <th>Factura PDF</th>
              </tr>
            </thead>
            <tbody>
              {filteredPackages.length > 0 ? (
                filteredPackages.map(pkg => {
                  const pos = pkg.posicionEstante || (pkg.anaquel ? `${pkg.anaquel}-${pkg.piso || 'P1'}` : 'REC');
                  const isA1 = pos.startsWith('A1');
                  const isA2 = pos.startsWith('A2');

                  return (
                    <tr key={pkg.id}>
                      <td className="badge-wr">{pkg.numeroReciboBodega}</td>
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 8px',
                            borderRadius: '6px',
                            fontSize: '11.5px',
                            fontWeight: 800,
                            fontFamily: 'JetBrains Mono, monospace',
                            background: isA1 ? '#dbeafe' : isA2 ? '#dcfce7' : '#fef3c7',
                            color: isA1 ? '#1e40af' : isA2 ? '#166534' : '#92400e',
                            border: `1px solid ${isA1 ? '#93c5fd' : isA2 ? '#86efac' : '#fde68a'}`
                          }}
                        >
                          <Layers className="w-3 h-3" />
                          {pos === 'REC' ? 'RECEPCIÓN' : pos}
                        </span>
                      </td>
                      <td className="cell-fw600">{pkg.trackingUsa}</td>
                      <td className="cell-casillero-blue">{pkg.codigoCasillero}</td>
                      <td>{pkg.nombreConsignatario || 'Cliente AMEX'}</td>
                      <td>{pkg.descripcion}</td>
                      <td className="cell-bold">{pkg.pesoKg} Kg</td>
                      <td>${pkg.valorDeclaradoUsd.toFixed(2)} USD</td>
                      <td>
                        <span className={`badge ${pkg.estadoEntrega.includes('Entregado') || pkg.estadoEntrega === 'RecogidoAlmacen' ? 'badge-paid-pen' : 'badge-type'}`}>
                          {pkg.estadoEntrega}
                        </span>
                      </td>
                      <td>
                        {pkg.facturaPdfUrl ? (
                          <button className="badge badge-pdf" style={{ border: 'none' }} onClick={() => onViewPdf(pkg.facturaPdfUrl || '')}>
                            <i className="fa-solid fa-file-pdf"></i> Ver PDF R2
                          </button>
                        ) : (
                          <span className="cell-grey">Sin PDF</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    No hay paquetes registrados con los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
