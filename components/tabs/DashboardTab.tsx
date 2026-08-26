'use client';

import React, { useMemo } from 'react';
import {
  Boxes,
  Clock,
  Car,
  Receipt,
  ScanLine,
  Search,
  Plus,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Truck,
  TrendingUp,
  Store,
  Layers,
  FileSpreadsheet
} from 'lucide-react';
import { Paquete, Cliente, OrdenEntrega, CobroVoucher } from '@/types';

interface DashboardTabProps {
  paquetes: Paquete[];
  clientes: Cliente[];
  entregas: OrdenEntrega[];
  cobros: CobroVoucher[];
  onNavigateTab: (tabId: string, extra?: any) => void;
  onNewPackage: () => void;
  onPrintLabel: (pkg: Paquete) => void;
  onViewPdf: (url: string) => void;
}

export default function DashboardTab({
  paquetes = [],
  clientes = [],
  entregas = [],
  cobros = [],
  onNavigateTab,
  onNewPackage,
  onPrintLabel,
  onViewPdf
}: DashboardTabProps) {
  // 1. Métricas de Almacén Central Lince
  const paquetesLince = useMemo(
    () => paquetes.filter(p => p.ubicacionActual === 'AmexLince' || p.estadoEntrega === 'EnAlmacen'),
    [paquetes]
  );
  const totalPesoLince = useMemo(
    () => paquetesLince.reduce((acc, p) => acc + (Number(p.pesoKg) || 0), 0),
    [paquetesLince]
  );
  const totalValorLince = useMemo(
    () => paquetesLince.reduce((acc, p) => acc + (Number(p.valorDeclaradoUsd) || 0), 0),
    [paquetesLince]
  );

  // 2. Métricas de Órdenes de Entrega (Mostrador Lince)
  const ordenesActivas = useMemo(
    () => entregas.filter(e => e.estado !== 'ENTREGADO'),
    [entregas]
  );
  const ordenesListas = useMemo(
    () => entregas.filter(e => e.estado === 'LISTO_ENTREGA'),
    [entregas]
  );
  const ordenesEntregadasHoy = useMemo(
    () => entregas.filter(e => e.estado === 'ENTREGADO'),
    [entregas]
  );

  // 3. Métricas de Cobros y Vouchers (WhatsApp)
  const cobrosMetrics = useMemo(() => {
    let totalSoles = 0;
    let totalDolares = 0;
    let validados = 0;
    let pendientes = 0;

    cobros.forEach(c => {
      const m = Number(c.monto || 0);
      if (c.moneda === 'PEN') {
        totalSoles += m;
      } else {
        totalDolares += m;
      }
      if (c.estado === 'VALIDADO') validados++;
      if (c.estado === 'PENDIENTE') pendientes++;
    });

    return { totalSoles, totalDolares, validados, pendientes };
  }, [cobros]);

  // 4. Métricas de Despacho
  const paquetesEnRuta = useMemo(
    () => paquetes.filter(p => p.estadoEntrega === 'EnRutaCarroAmex').length,
    [paquetes]
  );

  return (
    <div style={{ padding: '16px 20px', maxWidth: '1440px', margin: '0 auto' }}>
      {/* CABECERA OPERATIVA */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '20px',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '16px'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                background: '#2563eb',
                color: '#ffffff',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: 900,
                letterSpacing: '0.5px'
              }}
            >
              SEDE CENTRAL LINCE
            </span>
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>
              Operaciones & Almacén Activo
            </span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
            Panel de Control Operativo
          </h1>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>
            Monitoreo en vivo de inventario en anaqueles, entregas de mostrador y cobros por WhatsApp
          </p>
        </div>

        {/* BOTONES DE ACCIÓN RÁPIDA */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <button
            className="btn btn-primary"
            onClick={() => onNavigateTab('shp-entregas')}
            style={{
              background: '#2563eb',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 800
            }}
          >
            <Plus className="w-4 h-4" /> Nueva Orden de Búsqueda
          </button>

          <button
            className="btn"
            onClick={() => onNavigateTab('fico-cobros')}
            style={{
              background: '#16a34a',
              color: '#ffffff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 800
            }}
          >
            <Receipt className="w-4 h-4" /> Pegar Voucher (Ctrl + V)
          </button>

          <button
            className="btn"
            onClick={() => onNavigateTab('mobile-scanner')}
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#334155',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 800
            }}
          >
            <ScanLine className="w-4 h-4 text-blue-600" /> Escáner de Códigos
          </button>
        </div>
      </div>

      {/* METRIC CARDS DEL DÍA */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '14px',
          marginBottom: '24px'
        }}
      >
        {/* KPI 1: Almacén Lince */}
        <div
          onClick={() => onNavigateTab('mm-lince')}
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px',
            borderLeft: '4px solid #2563eb',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            transition: 'transform 0.15s ease'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              Existencias Lince
            </span>
            <Boxes className="w-5 h-5 text-blue-600" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#0f172a', marginTop: '6px' }}>
            {paquetesLince.length} <span style={{ fontSize: '14px', fontWeight: 700, color: '#64748b' }}>paquetes</span>
          </div>
          <div style={{ fontSize: '11.5px', color: '#3b82f6', marginTop: '4px', fontWeight: 700 }}>
            {totalPesoLince.toFixed(1)} Kg en Anaqueles (A1 - A2)
          </div>
        </div>

        {/* KPI 2: Entregas Pendientes */}
        <div
          onClick={() => onNavigateTab('shp-entregas')}
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px',
            borderLeft: '4px solid #f59e0b',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#b45309', textTransform: 'uppercase' }}>
              Órdenes de Búsqueda
            </span>
            <Clock className="w-5 h-5 text-amber-500" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#92400e', marginTop: '6px' }}>
            {ordenesActivas.length} <span style={{ fontSize: '14px', fontWeight: 700, color: '#b45309' }}>activas</span>
          </div>
          <div style={{ fontSize: '11.5px', color: '#d97706', marginTop: '4px', fontWeight: 700 }}>
            {ordenesListas.length} listas para entrega al cliente
          </div>
        </div>

        {/* KPI 3: Cobranza Soles */}
        <div
          onClick={() => onNavigateTab('fico-cobros')}
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px',
            borderLeft: '4px solid #10b981',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>
              Cobros WhatsApp (Soles)
            </span>
            <Receipt className="w-5 h-5 text-emerald-600" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#065f46', marginTop: '6px' }}>
            S/ {cobrosMetrics.totalSoles.toFixed(2)}
          </div>
          <div style={{ fontSize: '11.5px', color: '#059669', marginTop: '4px', fontWeight: 700 }}>
            {cobrosMetrics.validados} validados · {cobrosMetrics.pendientes} pendientes
          </div>
        </div>

        {/* KPI 4: Despacho Carro AMEX */}
        <div
          onClick={() => onNavigateTab('shp-deliveries')}
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '16px',
            borderLeft: '4px solid #8b5cf6',
            cursor: 'pointer',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#6d28d9', textTransform: 'uppercase' }}>
              En Ruta (Carro AMEX)
            </span>
            <Car className="w-5 h-5 text-purple-600" />
          </div>
          <div style={{ fontSize: '26px', fontWeight: 900, color: '#5b21b6', marginTop: '6px' }}>
            {paquetesEnRuta} <span style={{ fontSize: '14px', fontWeight: 700, color: '#6d28d9' }}>paquetes</span>
          </div>
          <div style={{ fontSize: '11.5px', color: '#7c3aed', marginTop: '4px', fontWeight: 700 }}>
            Reparto a domicilio en Lima
          </div>
        </div>
      </div>

      {/* ACCESOS DIRECTOS A LOS 6 SUBMÓDULOS DE OPERACIONES */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', marginBottom: '12px' }}>
          Submódulos de Operaciones y Almacenes
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '12px'
          }}
        >
          <div
            onClick={() => onNavigateTab('mm-lince')}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              transition: 'all 0.15s ease'
            }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Store className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Almacén Central</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Inventario, Kardex y Anaqueles</div>
            </div>
          </div>

          <div
            onClick={() => onNavigateTab('shp-entregas')}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#fef3c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Boxes className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Entregas & Búsqueda WR</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Mostrador y Fotos en R2</div>
            </div>
          </div>

          <div
            onClick={() => onNavigateTab('fico-cobros')}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#ecfdf5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Receipt className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Cobros & Vouchers</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Yape, Plin y BCP (WhatsApp)</div>
            </div>
          </div>

          <div
            onClick={() => onNavigateTab('shp-deliveries')}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Car className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Carro AMEX</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Reparto y Hojas de Ruta</div>
            </div>
          </div>

          <div
            onClick={() => onNavigateTab('wms-picking')}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Truck className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Shalom & Olva</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Picking y Envíos a Provincias</div>
            </div>
          </div>

          <div
            onClick={() => onNavigateTab('mobile-scanner')}
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: '#f0f9ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ScanLine className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>Escáner de Códigos</div>
              <div style={{ fontSize: '11px', color: '#64748b' }}>Lector Móvil y Ubicaciones</div>
            </div>
          </div>
        </div>
      </div>

      {/* SECCIÓN INFERIOR: ÓRDENES ACTIVAS DE BÚSQUEDA / RECOJO EN MOSTRADOR */}
      <div
        style={{
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          padding: '20px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 900, color: '#0f172a', margin: 0 }}>
              📦 Órdenes de Entrega Activas (Mostrador Lince)
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
              Listas de búsqueda creadas para entregar a clientes que vienen a recoger sus WRs
            </p>
          </div>

          <button
            className="btn"
            onClick={() => onNavigateTab('shp-entregas')}
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#2563eb',
              fontSize: '12px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            Ver Todas las Órdenes <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {ordenesActivas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px 10px', color: '#64748b' }}>
            <CheckCircle2 className="w-10 h-10 text-emerald-500" style={{ margin: '0 auto 8px' }} />
            <div style={{ fontWeight: 800, color: '#0f172a' }}>No hay órdenes pendientes en este momento</div>
            <div style={{ fontSize: '12px' }}>Todas las entregas han sido completadas o no se han generado nuevas órdenes.</div>
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Código de Entrega</th>
                  <th>Cliente Consignatario</th>
                  <th>Casillero</th>
                  <th>Paquetes</th>
                  <th>Guías WR Asignadas</th>
                  <th>Operador Asignado</th>
                  <th>Estado</th>
                  <th className="cell-center">Acción</th>
                </tr>
              </thead>
              <tbody>
                {ordenesActivas.slice(0, 8).map(orden => (
                  <tr key={orden.id}>
                    <td className="cell-fw600" style={{ color: '#2563eb' }}>
                      {orden.codigo_entrega}
                    </td>
                    <td style={{ fontWeight: 800, color: '#0f172a' }}>{orden.cliente_nombre}</td>
                    <td><span className="badge badge-code">{orden.cliente_casillero || 'SIN CASILLERO'}</span></td>
                    <td style={{ fontWeight: 800 }}>{orden.total_paquetes || 0}</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {Array.isArray(orden.paquetes_data) &&
                          orden.paquetes_data.map((p, i) => (
                            <span
                              key={i}
                              style={{
                                background: '#eff6ff',
                                color: '#1e40af',
                                border: '1px solid #bfdbfe',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                fontSize: '10.5px',
                                fontWeight: 800
                              }}
                            >
                              {p.numeroReciboBodega}
                            </span>
                          ))}
                      </div>
                    </td>
                    <td style={{ fontSize: '12px', color: '#475569' }}>{orden.operador_asignado}</td>
                    <td>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '9999px',
                          background:
                            orden.estado === 'LISTO_ENTREGA'
                              ? '#dcfce7'
                              : orden.estado === 'EN_BUSQUEDA'
                              ? '#eff6ff'
                              : '#fef3c7',
                          color:
                            orden.estado === 'LISTO_ENTREGA'
                              ? '#15803d'
                              : orden.estado === 'EN_BUSQUEDA'
                              ? '#1d4ed8'
                              : '#b45309'
                        }}
                      >
                        {orden.estado === 'LISTO_ENTREGA'
                          ? '✓ LISTO PARA RECOJO'
                          : orden.estado === 'EN_BUSQUEDA'
                          ? '🔍 EN BÚSQUEDA'
                          : '⏳ PENDIENTE'}
                      </span>
                    </td>
                    <td className="cell-center">
                      <button
                        className="btn btn-primary"
                        onClick={() => onNavigateTab('shp-entregas', { openOrden: orden })}
                        style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 800 }}
                      >
                        Atender Entrega
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
