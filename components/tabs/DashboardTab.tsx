'use client';

import React, { useState, useMemo } from 'react';
import {
  Boxes,
  Clock,
  Car,
  Receipt,
  ScanLine,
  Search,
  Plus,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Truck,
  TrendingUp,
  Store,
  Layers,
  FileSpreadsheet,
  RefreshCw,
  Zap,
  Package,
  Printer,
  FileText,
  MapPin,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Activity,
  Check
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
  onRefreshData?: () => Promise<void> | void;
}

export default function DashboardTab({
  paquetes = [],
  clientes = [],
  entregas = [],
  cobros = [],
  onNavigateTab,
  onNewPackage,
  onPrintLabel,
  onViewPdf,
  onRefreshData
}: DashboardTabProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');
  const [activePackageFilter, setActivePackageFilter] = useState<'ALL' | 'LINCE' | 'MIAMI' | 'EN_RUTA' | 'ENTREGADO'>('ALL');

  const handleRefresh = async () => {
    if (!onRefreshData) return;
    try {
      setIsRefreshing(true);
      await onRefreshData();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // 1. Métricas de Almacén Central Lince
  const paquetesLince = useMemo(
    () => paquetes.filter(p => p.ubicacionActual === 'AmexLince' || p.estadoEntrega === 'EnAlmacen'),
    [paquetes]
  );
  const paquetesMiami = useMemo(
    () => paquetes.filter(p => p.ubicacionActual === 'TibCourierMiami'),
    [paquetes]
  );
  const paquetesEnRuta = useMemo(
    () => paquetes.filter(p => p.estadoEntrega === 'EnRutaCarroAmex'),
    [paquetes]
  );
  const paquetesEntregados = useMemo(
    () => paquetes.filter(p => p.estadoEntrega === 'Entregado' || p.estadoEntrega === 'EntregadoDomicilio' || p.estadoEntrega === 'RecogidoAlmacen'),
    [paquetes]
  );

  const totalPesoLince = useMemo(
    () => paquetesLince.reduce((acc, p) => acc + (Number(p.pesoKg) || 0), 0),
    [paquetesLince]
  );

  // 2. Órdenes de Entrega
  const ordenesActivas = useMemo(
    () => entregas.filter(e => e.estado !== 'ENTREGADO'),
    [entregas]
  );
  const ordenesListas = useMemo(
    () => entregas.filter(e => e.estado === 'LISTO_ENTREGA'),
    [entregas]
  );

  // 3. Cobros WhatsApp
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

  // Estantes occupancy
  const estantesStats = useMemo(() => {
    const a1Count = paquetesLince.filter(p => (p.posicionEstante || p.anaquel || '').includes('A1')).length;
    const a2Count = paquetesLince.filter(p => (p.posicionEstante || p.anaquel || '').includes('A2')).length;
    const recCount = paquetesLince.filter(p => (p.posicionEstante || p.anaquel || '').includes('REC')).length;
    return { a1Count, a2Count, recCount };
  }, [paquetesLince]);

  // Filtered packages
  const filteredPaquetes = useMemo(() => {
    return paquetes.filter(p => {
      if (activePackageFilter === 'LINCE' && p.ubicacionActual !== 'AmexLince' && p.estadoEntrega !== 'EnAlmacen') return false;
      if (activePackageFilter === 'MIAMI' && p.ubicacionActual !== 'TibCourierMiami') return false;
      if (activePackageFilter === 'EN_RUTA' && p.estadoEntrega !== 'EnRutaCarroAmex') return false;
      if (activePackageFilter === 'ENTREGADO' && p.estadoEntrega !== 'Entregado' && p.estadoEntrega !== 'EntregadoDomicilio' && p.estadoEntrega !== 'RecogidoAlmacen') return false;

      if (quickSearch.trim()) {
        const q = quickSearch.toLowerCase().trim();
        const matchWr = p.numeroReciboBodega.toLowerCase().includes(q);
        const matchName = (p.nombreConsignatario || '').toLowerCase().includes(q);
        const matchCasillero = (p.codigoCasillero || '').toLowerCase().includes(q);
        const matchTracking = (p.trackingUsa || '').toLowerCase().includes(q);
        const matchPos = (p.posicionEstante || '').toLowerCase().includes(q);
        return matchWr || matchName || matchCasillero || matchTracking || matchPos;
      }
      return true;
    });
  }, [paquetes, activePackageFilter, quickSearch]);

  return (
    <div className="cmd-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden', background: '#f8fafc' }}>
      {/* ---------------- TOP BAR: COMMAND CENTER ACTIONS ---------------- */}
      <div
        className="cmd-topbar"
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
          <div className="cmd-brand-icon" style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', boxShadow: '0 4px 10px rgba(37,99,235,0.25)', flexShrink: 0 }}>
            <Activity className="w-5 h-5" style={{ width: '20px', height: '20px' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.2px' }}>
                Centro de Control Operativo
              </h1>
              <span
                style={{
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontSize: '10px',
                  fontWeight: 900,
                  background: '#ecfdf5',
                  color: '#047857',
                  border: '1px solid #a7f3d0',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                Lince Hub En Vivo
              </span>
            </div>
            <p style={{ fontSize: '11.5px', color: '#64748b', margin: '2px 0 0 0' }}>
              Monitoreo dinámico de inventario, cotejo y entregas
            </p>
          </div>
        </div>

        {/* Quick Action Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={onNewPackage}
            className="btn-cmd-primary"
            style={{
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              padding: '8px 14px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(37,99,235,0.25)'
            }}
          >
            <Plus style={{ width: '16px', height: '16px', strokeWidth: 3 }} />
            <span>Registrar WR</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('live-sheets')}
            className="btn-cmd-success"
            style={{
              background: '#059669',
              color: '#ffffff',
              border: 'none',
              padding: '8px 14px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 6px rgba(5,150,105,0.25)'
            }}
            title="Abrir hoja de cotejo y pistoleo en vivo"
          >
            <Zap style={{ width: '16px', height: '16px', color: '#fde047', fill: 'currentColor' }} />
            <span>Cotejo Live (Sheets)</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('mobile-scanner')}
            className="btn-cmd-dark"
            style={{
              background: '#0f172a',
              color: '#ffffff',
              border: 'none',
              padding: '8px 14px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <ScanLine style={{ width: '16px', height: '16px', color: '#38bdf8' }} />
            <span>Escáner</span>
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#334155',
              padding: '8px',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Refrescar datos"
          >
            <RefreshCw className={isRefreshing ? 'animate-spin' : ''} style={{ width: '16px', height: '16px', color: '#2563eb' }} />
          </button>
        </div>
      </div>

      {/* ---------------- 4 INTERACTIVE KPI CARDS ---------------- */}
      <div
        className="cmd-kpi-grid"
        style={{
          padding: '10px 16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '10px',
          flexShrink: 0
        }}
      >
        {/* KPI 1: Almacén Lince */}
        <div
          onClick={() => onNavigateTab('mm-lince')}
          className="cmd-kpi-card"
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px 14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b' }}>
              Almacén Lince
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Boxes style={{ width: '16px', height: '16px' }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#0f172a', fontFamily: 'monospace' }}>
              {paquetesLince.length} <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 700 }}>paquetes</span>
            </div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', marginTop: '2px' }}>
              {totalPesoLince.toFixed(1)} kg en anaqueles
            </div>
          </div>
        </div>

        {/* KPI 2: Entregas Mostrador */}
        <div
          onClick={() => onNavigateTab('shp-entregas')}
          className="cmd-kpi-card"
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px 14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#b45309' }}>
              Mostrador Lince
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock style={{ width: '16px', height: '16px' }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#78350f', fontFamily: 'monospace' }}>
              {ordenesActivas.length} <span style={{ fontSize: '12px', color: '#b45309', fontWeight: 700 }}>órdenes</span>
            </div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#d97706', marginTop: '2px' }}>
              {ordenesListas.length} listas para entrega
            </div>
          </div>
        </div>

        {/* KPI 3: Cobros WhatsApp */}
        <div
          onClick={() => onNavigateTab('fico-cobros')}
          className="cmd-kpi-card"
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px 14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#047857' }}>
              Cobros Soles
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Receipt style={{ width: '16px', height: '16px' }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#064e3b', fontFamily: 'monospace' }}>
              S/ {cobrosMetrics.totalSoles.toFixed(2)}
            </div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#059669', marginTop: '2px' }}>
              {cobrosMetrics.validados} validados · {cobrosMetrics.pendientes} pendientes
            </div>
          </div>
        </div>

        {/* KPI 4: Despacho Carro AMEX */}
        <div
          onClick={() => onNavigateTab('shp-deliveries')}
          className="cmd-kpi-card"
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '12px 14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            cursor: 'pointer'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#7e22ce' }}>
              Reparto Carro AMEX
            </span>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: '#faf5ff', color: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Car style={{ width: '16px', height: '16px' }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#581c87', fontFamily: 'monospace' }}>
              {paquetesEnRuta.length} <span style={{ fontSize: '12px', color: '#7e22ce', fontWeight: 700 }}>en ruta</span>
            </div>
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#9333ea', marginTop: '2px' }}>
              Lima Metropolitana & Domicilio
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- MAIN INTERACTIVE SPLIT WORKSPACE ---------------- */}
      <div
        className="cmd-workspace-grid"
        style={{
          padding: '0 16px 16px 16px',
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1.4fr 1fr',
          gap: '12px',
          minHeight: 0,
          overflow: 'hidden'
        }}
      >
        {/* LEFT COLUMN: INTERACTIVE LIVE PACKAGE STREAM */}
        <div
          className="cmd-card-panel"
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '14px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minHeight: 0
          }}
        >
          {/* Header with Search & Filter Tabs */}
          <div
            className="cmd-panel-header"
            style={{
              padding: '10px 14px',
              background: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              flexShrink: 0
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto' }}>
              <button
                type="button"
                onClick={() => setActivePackageFilter('ALL')}
                className={`cmd-filter-pill ${activePackageFilter === 'ALL' ? 'active' : ''}`}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  border: 'none',
                  cursor: 'pointer',
                  background: activePackageFilter === 'ALL' ? '#0f172a' : '#f1f5f9',
                  color: activePackageFilter === 'ALL' ? '#ffffff' : '#475569'
                }}
              >
                Todos ({paquetes.length})
              </button>

              <button
                type="button"
                onClick={() => setActivePackageFilter('LINCE')}
                className={`cmd-filter-pill ${activePackageFilter === 'LINCE' ? 'active' : ''}`}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  border: 'none',
                  cursor: 'pointer',
                  background: activePackageFilter === 'LINCE' ? '#2563eb' : '#eff6ff',
                  color: activePackageFilter === 'LINCE' ? '#ffffff' : '#1e40af'
                }}
              >
                En Lince ({paquetesLince.length})
              </button>

              <button
                type="button"
                onClick={() => setActivePackageFilter('MIAMI')}
                className={`cmd-filter-pill ${activePackageFilter === 'MIAMI' ? 'active' : ''}`}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  border: 'none',
                  cursor: 'pointer',
                  background: activePackageFilter === 'MIAMI' ? '#0284c7' : '#f0f9ff',
                  color: activePackageFilter === 'MIAMI' ? '#ffffff' : '#0369a1'
                }}
              >
                Miami ({paquetesMiami.length})
              </button>

              <button
                type="button"
                onClick={() => setActivePackageFilter('EN_RUTA')}
                className={`cmd-filter-pill ${activePackageFilter === 'EN_RUTA' ? 'active' : ''}`}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 800,
                  border: 'none',
                  cursor: 'pointer',
                  background: activePackageFilter === 'EN_RUTA' ? '#9333ea' : '#faf5ff',
                  color: activePackageFilter === 'EN_RUTA' ? '#ffffff' : '#7e22ce'
                }}
              >
                En Ruta ({paquetesEnRuta.length})
              </button>
            </div>

            {/* Live Search */}
            <div style={{ position: 'relative', width: '200px', flexShrink: 0 }}>
              <Search style={{ width: '14px', height: '14px', color: '#94a3b8', position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                value={quickSearch}
                onChange={e => setQuickSearch(e.target.value)}
                placeholder="Buscar WR o Cliente..."
                style={{
                  width: '100%',
                  paddingLeft: '28px',
                  paddingRight: '8px',
                  paddingTop: '5px',
                  paddingBottom: '5px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  color: '#0f172a',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {/* Interactive Scrollable Package List */}
          <div className="cmd-list-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {filteredPaquetes.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                <Package style={{ width: '36px', height: '36px', color: '#cbd5e1', margin: '0 auto 8px' }} />
                <p style={{ fontSize: '12px', fontWeight: 800, color: '#475569', margin: 0 }}>No se encontraron paquetes</p>
                <p style={{ fontSize: '11px', color: '#94a3b8', margin: '4px 0 0 0' }}>Ajusta los filtros o registra uno nuevo</p>
              </div>
            ) : (
              filteredPaquetes.slice(0, 45).map(pkg => {
                const isLince = pkg.ubicacionActual === 'AmexLince' || pkg.estadoEntrega === 'EnAlmacen';
                const isMiami = pkg.ubicacionActual === 'TibCourierMiami';

                return (
                  <div
                    key={pkg.id}
                    className="cmd-package-item"
                    style={{
                      padding: '8px 14px',
                      borderBottom: '1px solid #f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                          flexShrink: 0,
                          background: isLince ? '#eff6ff' : isMiami ? '#f0f9ff' : '#ecfdf5',
                          border: isLince ? '1px solid #bfdbfe' : isMiami ? '1px solid #bae6fd' : '1px solid #a7f3d0'
                        }}
                      >
                        {pkg.tipoEmpaque === 'SOBRE' ? '✉️' : '📦'}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '12px', color: '#0f172a' }}>
                            {pkg.numeroReciboBodega}
                          </span>
                          <span style={{ padding: '1px 5px', borderRadius: '4px', fontSize: '10px', fontFamily: 'monospace', fontWeight: 800, background: '#f1f5f9', color: '#334155' }}>
                            {pkg.codigoCasillero}
                          </span>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {pkg.nombreConsignatario || 'Sin Consignatario'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          <span>{pkg.pesoKg ? `${pkg.pesoKg} kg` : '0 kg'}</span>
                          <span>•</span>
                          <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#7e22ce', background: '#faf5ff', padding: '1px 5px', borderRadius: '4px', border: '1px solid #f3e8ff' }}>
                            {pkg.posicionEstante || 'A1-P1'}
                          </span>
                          <span>•</span>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                            {pkg.descripcion || 'Mercancía general'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Row Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={() => onPrintLabel(pkg)}
                        style={{ padding: '6px', background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', borderRadius: '6px' }}
                        title="Imprimir Etiqueta Térmica"
                      >
                        <Printer style={{ width: '15px', height: '15px' }} />
                      </button>

                      {pkg.facturaPdfUrl && (
                        <button
                          type="button"
                          onClick={() => onViewPdf(pkg.facturaPdfUrl || '')}
                          style={{ padding: '6px', background: 'transparent', border: 'none', color: '#059669', cursor: 'pointer', borderRadius: '6px' }}
                          title="Ver Factura PDF en R2"
                        >
                          <FileText style={{ width: '15px', height: '15px' }} />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onNavigateTab('mm-lince')}
                        style={{ padding: '6px', background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', borderRadius: '6px' }}
                        title="Ver en Almacén"
                      >
                        <ChevronRight style={{ width: '16px', height: '16px' }} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: WAREHOUSE CAPACITY & ACTIVE ORDERS WIDGETS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minHeight: 0, overflow: 'hidden' }}>
          {/* Widget 1: Medidor Visual de Anaqueles Lince */}
          <div
            style={{
              padding: '14px',
              background: '#ffffff',
              borderRadius: '14px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              flexShrink: 0
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ fontSize: '11.5px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Layers style={{ width: '16px', height: '16px', color: '#9333ea' }} />
                Ocupación de Anaqueles (Lince)
              </span>
              <button
                type="button"
                onClick={() => onNavigateTab('mm-lince')}
                style={{ fontSize: '11px', fontWeight: 800, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Ver Matriz →
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Anaquel 1 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 700, marginBottom: '3px', color: '#334155' }}>
                  <span>Anaquel 1 (A1 · Pisos 1-3)</span>
                  <span style={{ fontFamily: 'monospace', color: '#9333ea', fontWeight: 900 }}>{estantesStats.a1Count} bultos</span>
                </div>
                <div style={{ width: '100%', background: '#f1f5f9', borderRadius: '9999px', height: '7px', overflow: 'hidden' }}>
                  <div
                    style={{
                      background: '#9333ea',
                      height: '100%',
                      borderRadius: '9999px',
                      width: `${Math.min(100, (estantesStats.a1Count / 30) * 100)}%`,
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>
              </div>

              {/* Anaquel 2 */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 700, marginBottom: '3px', color: '#334155' }}>
                  <span>Anaquel 2 (A2 · Pisos 1-3)</span>
                  <span style={{ fontFamily: 'monospace', color: '#2563eb', fontWeight: 900 }}>{estantesStats.a2Count} bultos</span>
                </div>
                <div style={{ width: '100%', background: '#f1f5f9', borderRadius: '9999px', height: '7px', overflow: 'hidden' }}>
                  <div
                    style={{
                      background: '#2563eb',
                      height: '100%',
                      borderRadius: '9999px',
                      width: `${Math.min(100, (estantesStats.a2Count / 30) * 100)}%`,
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>
              </div>

              {/* Recepción */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 700, marginBottom: '3px', color: '#334155' }}>
                  <span>Mesa de Recepción (REC)</span>
                  <span style={{ fontFamily: 'monospace', color: '#d97706', fontWeight: 900 }}>{estantesStats.recCount} bultos</span>
                </div>
                <div style={{ width: '100%', background: '#f1f5f9', borderRadius: '9999px', height: '7px', overflow: 'hidden' }}>
                  <div
                    style={{
                      background: '#f59e0b',
                      height: '100%',
                      borderRadius: '9999px',
                      width: `${Math.min(100, (estantesStats.recCount / 20) * 100)}%`,
                      transition: 'width 0.3s ease'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Widget 2: Órdenes de Mostrador Activas */}
          <div
            className="cmd-card-panel"
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              minHeight: 0
            }}
          >
            <div
              style={{
                padding: '10px 14px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#f8fafc',
                flexShrink: 0
              }}
            >
              <span style={{ fontSize: '11.5px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Store style={{ width: '16px', height: '16px', color: '#059669' }} />
                Mostrador & Entregas en Lince
              </span>
              <button
                type="button"
                onClick={() => onNavigateTab('shp-entregas')}
                style={{ fontSize: '11px', fontWeight: 800, color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Ver Todas →
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '8px', minHeight: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {ordenesActivas.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                  <CheckCircle2 style={{ width: '32px', height: '32px', color: '#10b981', margin: '0 auto 6px' }} />
                  <p style={{ fontSize: '12px', fontWeight: 800, color: '#334155', margin: 0 }}>No hay órdenes pendientes</p>
                  <p style={{ fontSize: '11px', color: '#94a3b8', margin: '2px 0 0 0' }}>Todas las entregas están al día</p>
                </div>
              ) : (
                ordenesActivas.slice(0, 6).map(orden => (
                  <div
                    key={orden.id}
                    onClick={() => onNavigateTab('shp-entregas', { openOrden: orden })}
                    style={{
                      padding: '8px 10px',
                      borderRadius: '10px',
                      border: '1px solid #f1f5f9',
                      background: '#ffffff',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      transition: 'background 0.12s ease'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '11.5px', fontFamily: 'monospace', fontWeight: 900, color: '#2563eb' }}>
                          {orden.codigo_entrega}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {orden.cliente_nombre}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                        {orden.total_paquetes || 0} paquetes asignados
                      </div>
                    </div>

                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '9999px',
                        fontSize: '10px',
                        fontWeight: 900,
                        textTransform: 'uppercase',
                        flexShrink: 0,
                        background: orden.estado === 'LISTO_ENTREGA' ? '#dcfce7' : '#fef3c7',
                        color: orden.estado === 'LISTO_ENTREGA' ? '#166534' : '#92400e'
                      }}
                    >
                      {orden.estado === 'LISTO_ENTREGA' ? 'LISTO' : 'EN BÚSQUEDA'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
