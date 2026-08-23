'use client';

import React, { useState, useMemo } from 'react';
import { Paquete, Cliente, TipoUbicacion, TipoMetodoEntrega, TipoEstadoEntrega } from '@/types';
import {
  Boxes,
  ArrowRightLeft,
  Layers,
  Search,
  Filter,
  Download,
  FileSpreadsheet,
  Plus,
  Edit3,
  Trash2,
  MapPin,
  CheckCircle2,
  Clock,
  Warehouse,
  Truck,
  Box,
  RefreshCw,
  SlidersHorizontal,
  ChevronRight,
  AlertTriangle,
  X,
  FileText,
  User,
  ExternalLink
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

interface InventoryTabProps {
  paquetes: Paquete[];
  clientes: Cliente[];
  onNewPackage: () => void;
  onViewPdf: (url: string) => void;
  onUpdatePackage?: (updated: Paquete) => void;
}

interface MovimientoRegistro {
  id: string;
  paqueteId?: string;
  codigoPaquete: string;
  consignatario: string;
  origen: string;
  destino: string;
  motivo: string;
  operador: string;
  fechaHora: string;
}

export default function InventoryTab({
  paquetes,
  clientes,
  onNewPackage,
  onViewPdf,
  onUpdatePackage
}: InventoryTabProps) {
  // Sub-pestañas: 'existencias' | 'movimientos' | 'matriz'
  const [activeSubTab, setActiveSubTab] = useState<'existencias' | 'movimientos' | 'matriz'>('existencias');

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [shelfFilter, setShelfFilter] = useState<string>('ALL');
  const [floorFilter, setFloorFilter] = useState<string>('ALL');
  const [packageTypeFilter, setPackageTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Selección múltiple para acciones en lote
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modales
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPackageForAction, setSelectedPackageForAction] = useState<Paquete | null>(null);

  // Formulario de Traslado / Reubicación
  const [transferData, setTransferData] = useState<{
    targetUbicacion: TipoUbicacion;
    targetAnaquel: string;
    targetPiso: string;
    motivo: string;
    operador: string;
  }>({
    targetUbicacion: 'AmexLince',
    targetAnaquel: 'A1',
    targetPiso: 'P1',
    motivo: 'Reubicación WMS de Almacén',
    operador: 'Operador Logístico AMEX'
  });

  // Formulario de Edición de Paquete
  const [editFormData, setEditFormData] = useState<Partial<Paquete>>({});

  // Historial local de movimientos (Kardex simulado / sincronizado)
  const [movimientosList, setMovimientosList] = useState<MovimientoRegistro[]>([
    {
      id: 'mov-1',
      codigoPaquete: 'WR-000101',
      consignatario: 'María Torres Mendoza',
      origen: 'TibCourierMiami',
      destino: 'AmexLince (A1-P1)',
      motivo: 'Recepción de Manifiesto Vuelo Miami',
      operador: 'Operador AMEX',
      fechaHora: new Date(Date.now() - 3600000 * 2).toLocaleString()
    },
    {
      id: 'mov-2',
      codigoPaquete: 'WR-000103',
      consignatario: 'Juan Mendoza García',
      origen: 'REC (Mesa Recepción)',
      destino: 'AmexLince (A2-P1)',
      motivo: 'Clasificación Slotting Estantería',
      operador: 'Operador AMEX',
      fechaHora: new Date(Date.now() - 3600000 * 5).toLocaleString()
    },
    {
      id: 'mov-3',
      codigoPaquete: 'WR-000105',
      consignatario: 'Luis García Rodríguez',
      origen: 'AmexLince (A1-P3)',
      destino: 'DSP (Zona Despacho / Carro Amex)',
      motivo: 'Asignación a Ruta de Reparto Lince',
      operador: 'Supervisor Rutas',
      fechaHora: new Date(Date.now() - 3600000 * 8).toLocaleString()
    }
  ]);

  // Métricas globales
  const totalExistencias = paquetes.length;
  const totalPesoKg = paquetes.reduce((acc, p) => acc + (Number(p.pesoKg) || 0), 0);
  const totalValorUsd = paquetes.reduce((acc, p) => acc + (Number(p.valorDeclaradoUsd) || 0), 0);

  const countMiami = paquetes.filter(p => p.ubicacionActual === 'TibCourierMiami').length;
  const countTingo = paquetes.filter(p => p.ubicacionActual === 'TibTingoMaria' || p.ubicacionActual === 'TibCourierTingoMaria').length;
  const countLince = paquetes.filter(p => p.ubicacionActual === 'AmexLince').length;
  const countEnRuta = paquetes.filter(p => p.estadoEntrega === 'EnRutaCarroAmex').length;
  const countEntregados = paquetes.filter(p => p.ubicacionActual === 'Entregado' || p.estadoEntrega === 'Entregado' || p.estadoEntrega === 'EntregadoDomicilio' || p.estadoEntrega === 'RecogidoAlmacen').length;

  const countA1 = paquetes.filter(p => (p.posicionEstante?.startsWith('A1') || p.anaquel === 'A1')).length;
  const countA2 = paquetes.filter(p => (p.posicionEstante?.startsWith('A2') || p.anaquel === 'A2')).length;
  const countRec = paquetes.filter(p => p.posicionEstante?.startsWith('REC') || p.anaquel === 'REC' || (!p.posicionEstante && !p.anaquel)).length;

  // Filtrado reactivo de paquetes
  const filteredPaquetes = useMemo(() => {
    return paquetes.filter(p => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch = !q || (
        p.numeroReciboBodega?.toLowerCase().includes(q) ||
        p.trackingUsa?.toLowerCase().includes(q) ||
        p.codigoCasillero?.toLowerCase().includes(q) ||
        p.nombreConsignatario?.toLowerCase().includes(q) ||
        p.dniConsignatario?.toLowerCase().includes(q) ||
        p.descripcion?.toLowerCase().includes(q) ||
        p.posicionEstante?.toLowerCase().includes(q)
      );

      const matchesLocation = locationFilter === 'ALL' || p.ubicacionActual === locationFilter;
      
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

      const matchesType = packageTypeFilter === 'ALL' || p.tipoEmpaque === packageTypeFilter;
      const matchesStatus = statusFilter === 'ALL' || p.estadoEntrega === statusFilter;

      return matchesSearch && matchesLocation && matchesShelf && matchesFloor && matchesType && matchesStatus;
    });
  }, [paquetes, searchTerm, locationFilter, shelfFilter, floorFilter, packageTypeFilter, statusFilter]);

  // Manejadores de Selección Múltiple
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredPaquetes.map(p => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // Abrir Modal de Traslado para 1 o varios paquetes
  const openTransferModal = (singlePkg?: Paquete) => {
    if (singlePkg) {
      setSelectedPackageForAction(singlePkg);
      setSelectedIds([singlePkg.id]);
      setTransferData(prev => ({
        ...prev,
        targetUbicacion: singlePkg.ubicacionActual,
        targetAnaquel: singlePkg.anaquel || 'A1',
        targetPiso: singlePkg.piso || 'P1'
      }));
    } else {
      setSelectedPackageForAction(null);
    }
    setIsTransferModalOpen(true);
  };

  // Ejecutar Traslado / Movimiento WMS
  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetPos = `${transferData.targetAnaquel}-${transferData.targetPiso}`;
    const idsToMove = selectedPackageForAction ? [selectedPackageForAction.id] : selectedIds;

    if (idsToMove.length === 0) return;

    // Actualizar en Supabase
    try {
      await supabase
        .from('paquetes')
        .update({
          ubicacion_actual: transferData.targetUbicacion,
          anaquel: transferData.targetAnaquel,
          piso: transferData.targetPiso,
          posicion_estante: targetPos
        })
        .in('id', idsToMove);

      // Registrar en historial trazabilidad para cada paquete
      const nowStr = new Date().toLocaleString();
      const newMovs: MovimientoRegistro[] = [];

      for (const id of idsToMove) {
        const pkg = paquetes.find(p => p.id === id);
        if (pkg) {
          const origenStr = `${pkg.ubicacionActual} (${pkg.posicionEstante || 'REC'})`;
          const destinoStr = `${transferData.targetUbicacion} (${targetPos})`;

          newMovs.push({
            id: `mov-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            paqueteId: pkg.id,
            codigoPaquete: pkg.numeroReciboBodega,
            consignatario: pkg.nombreConsignatario || pkg.codigoCasillero,
            origen: origenStr,
            destino: destinoStr,
            motivo: transferData.motivo,
            operador: transferData.operador,
            fechaHora: nowStr
          });

          await supabase.from('historial_trazabilidad').insert({
            paquete_id: pkg.id,
            ubicacion: destinoStr,
            descripcion_evento: `Movimiento WMS: ${transferData.motivo} (De ${origenStr} a ${destinoStr})`,
            usuario_operador: transferData.operador
          });
        }
      }

      setMovimientosList(prev => [...newMovs, ...prev]);
    } catch (err) {
      console.warn('Error executing bulk transfer in Supabase:', err);
    }

    setIsTransferModalOpen(false);
    setSelectedIds([]);
    setSelectedPackageForAction(null);
  };

  // Abrir Modal de Edición de Paquete
  const openEditModal = (pkg: Paquete) => {
    setSelectedPackageForAction(pkg);
    setEditFormData({
      ...pkg
    });
    setIsEditModalOpen(true);
  };

  // Guardar Edición de Paquete
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackageForAction) return;

    const pos = editFormData.posicionEstante || `${editFormData.anaquel || 'A1'}-${editFormData.piso || 'P1'}`;
    const [ana, pis] = pos.includes('-') ? pos.split('-') : [pos, 'P1'];

    const updated: Paquete = {
      ...selectedPackageForAction,
      ...editFormData,
      anaquel: ana,
      piso: pis,
      posicionEstante: pos,
      pesoKg: Number(editFormData.pesoKg || 0),
      valorDeclaradoUsd: Number(editFormData.valorDeclaradoUsd || 0)
    };

    if (onUpdatePackage) {
      onUpdatePackage(updated);
    }

    try {
      await supabase
        .from('paquetes')
        .update({
          codigo_casillero: updated.codigoCasillero,
          numero_recibo_bodega: updated.numeroReciboBodega,
          tracking_usa: updated.trackingUsa,
          tipo_empaque: updated.tipoEmpaque,
          numero_factura: updated.numeroFactura,
          dni_consignatario: updated.dniConsignatario,
          nombre_consignatario: updated.nombreConsignatario,
          descripcion: updated.descripcion,
          peso_kg: updated.pesoKg,
          valor_declarado_usd: updated.valorDeclaradoUsd,
          ubicacion_actual: updated.ubicacionActual,
          anaquel: updated.anaquel,
          piso: updated.piso,
          posicion_estante: updated.posicionEstante,
          metodo_entrega: updated.metodoEntrega,
          estado_entrega: updated.estadoEntrega
        })
        .eq('id', updated.id);
    } catch (err) {
      console.warn('Error updating package in Supabase:', err);
    }

    setIsEditModalOpen(false);
    setSelectedPackageForAction(null);
  };

  // Exportar Existencias a CSV / Excel
  const handleExportCSV = () => {
    const headers = [
      'Guía WR',
      'Casillero',
      'Tracking USA',
      'Consignatario',
      'DNI',
      'Descripción',
      'Tipo Empaque',
      'Peso Kg',
      'Valor USD',
      'Almacén Actual',
      'Anaquel',
      'Piso',
      'Posición Estante',
      'Método Entrega',
      'Estado Entrega'
    ];

    const rows = filteredPaquetes.map(p => [
      p.numeroReciboBodega,
      p.codigoCasillero,
      p.trackingUsa,
      `"${p.nombreConsignatario || ''}"`,
      p.dniConsignatario || '',
      `"${p.descripcion || ''}"`,
      p.tipoEmpaque,
      p.pesoKg,
      p.valorDeclaradoUsd,
      p.ubicacionActual,
      p.anaquel || '',
      p.piso || '',
      p.posicionEstante || '',
      p.metodoEntrega,
      p.estadoEntrega
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `inventario_amex_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Breadcrumb & Header Principal */}
      <div className="sap-breadcrumb">
        <span>Operaciones y Almacenes</span> / <span>Control de Inventario & Movimientos WMS</span>
      </div>

      <div className="page-title-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <Boxes style={{ width: '28px', height: '28px', color: '#2563eb' }} />
            Control de Inventario, Existencias y Movimientos WMS
          </h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0 0' }}>
            Gestión física integral de paquetes, reubicaciones, trazabilidad Kardex y matriz de anaqueles
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn"
            onClick={handleExportCSV}
            style={{ background: '#f8fafc', border: '1px solid #cbd5e1', color: '#334155', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
          >
            <Download className="w-4 h-4 text-emerald-600" /> Exportar CSV
          </button>
          
          <button
            className="btn btn-primary"
            onClick={onNewPackage}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
          >
            <Plus className="w-4 h-4" /> Ingresar Paquete
          </button>
        </div>
      </div>

      {/* KPI Ribbons (Métricas Clave) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Total Existencias</span>
            <Boxes className="w-5 h-5 text-blue-600" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>{totalExistencias} <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>paquetes</span></div>
          <div style={{ fontSize: '11px', color: '#22c55e', marginTop: '4px', fontWeight: 700 }}>● Sincronizado en Vivo</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Peso Total en Custodia</span>
            <Warehouse className="w-5 h-5 text-indigo-600" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>{totalPesoKg.toFixed(2)} <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Kg</span></div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Carga física en almacén</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Valor Declarado</span>
            <FileText className="w-5 h-5 text-emerald-600" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>${totalValorUsd.toFixed(2)} <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>USD</span></div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Valor comercial asegurado</div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Distribución por Sede</span>
            <MapPin className="w-5 h-5 text-amber-600" />
          </div>
          <div style={{ display: 'flex', gap: '8px', fontSize: '11.5px', fontWeight: 700, marginTop: '4px', flexWrap: 'wrap' }}>
            <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px' }}>MIA: {countMiami}</span>
            <span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: '4px' }}>TGO: {countTingo}</span>
            <span style={{ background: '#f0fdf4', color: '#15803d', padding: '2px 6px', borderRadius: '4px' }}>LINCE: {countLince}</span>
          </div>
        </div>
      </div>

      {/* Selector de Sub-Pestañas (Barra de Navegación del Módulo) */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '2px solid #e2e8f0', paddingBottom: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveSubTab('existencias')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            fontWeight: 800,
            fontSize: '13px',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: activeSubTab === 'existencias' ? '#2563eb' : 'transparent',
            color: activeSubTab === 'existencias' ? '#ffffff' : '#64748b',
            transition: 'all 0.15s ease'
          }}
        >
          <Boxes className="w-4 h-4" /> 1. Existencias y Almacén ({filteredPaquetes.length})
        </button>

        <button
          onClick={() => setActiveSubTab('movimientos')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            fontWeight: 800,
            fontSize: '13px',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: activeSubTab === 'movimientos' ? '#2563eb' : 'transparent',
            color: activeSubTab === 'movimientos' ? '#ffffff' : '#64748b',
            transition: 'all 0.15s ease'
          }}
        >
          <ArrowRightLeft className="w-4 h-4" /> 2. Kardex de Movimientos & Trazabilidad
        </button>

        <button
          onClick={() => setActiveSubTab('matriz')}
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            fontWeight: 800,
            fontSize: '13px',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: activeSubTab === 'matriz' ? '#2563eb' : 'transparent',
            color: activeSubTab === 'matriz' ? '#ffffff' : '#64748b',
            transition: 'all 0.15s ease'
          }}
        >
          <Layers className="w-4 h-4" /> 3. Matriz Visual de Anaqueles (Slotting)
        </button>
      </div>

      {/* VISTA 1: EXISTENCIAS Y ALMACÉN */}
      {activeSubTab === 'existencias' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Barra de Filtros y Búsqueda */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ position: 'relative', flex: '1 1 280px' }}>
                <Search style={{ position: 'absolute', left: '12px', top: '10px', width: '16px', height: '16px', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Buscar por Guía WR#, Tracking USA, Casillero, Consignatario o Estante..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '13px',
                    background: '#f8fafc'
                  }}
                />
              </div>

              {/* Botón de Acción Masiva si hay seleccionados */}
              {selectedIds.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#eff6ff', padding: '6px 12px', borderRadius: '8px', border: '1px solid #bfdbfe' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#1e40af' }}>
                    {selectedIds.length} paquete(s) seleccionados
                  </span>
                  <button
                    onClick={() => openTransferModal()}
                    className="btn btn-primary"
                    style={{ padding: '4px 10px', fontSize: '12px', height: '28px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" /> Reubicar / Trasladar Selección
                  </button>
                  <button
                    onClick={() => setSelectedIds([])}
                    style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Desmarcar
                  </button>
                </div>
              )}
            </div>

            {/* Selectores de Filtro Avanzado */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 800, color: '#475569' }}>Sede:</span>
                <select
                  value={locationFilter}
                  onChange={e => setLocationFilter(e.target.value)}
                  style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#ffffff' }}
                >
                  <option value="ALL">Todas las Sedes</option>
                  <option value="TibCourierMiami">Miami Hub (USA)</option>
                  <option value="TibTingoMaria">Tingo María</option>
                  <option value="AmexLince">Sede Central Lince</option>
                  <option value="Entregado">Entregados</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 800, color: '#475569' }}>Anaquel:</span>
                <select
                  value={shelfFilter}
                  onChange={e => { setShelfFilter(e.target.value); setFloorFilter('ALL'); }}
                  style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#ffffff' }}
                >
                  <option value="ALL">Todos los Anaqueles</option>
                  <option value="A1">Anaquel 1 (A1)</option>
                  <option value="A2">Anaquel 2 (A2)</option>
                  <option value="REC">Recepción / Sin Estante</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 800, color: '#475569' }}>Piso:</span>
                <select
                  value={floorFilter}
                  onChange={e => setFloorFilter(e.target.value)}
                  style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#ffffff' }}
                >
                  <option value="ALL">Todos los Pisos</option>
                  <option value="P1">P1 (Inferior)</option>
                  <option value="P2">P2 (Medio)</option>
                  <option value="P3">P3 (Superior)</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 800, color: '#475569' }}>Empaque:</span>
                <select
                  value={packageTypeFilter}
                  onChange={e => setPackageTypeFilter(e.target.value)}
                  style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px', background: '#ffffff' }}
                >
                  <option value="ALL">Todos</option>
                  <option value="CAJA">CAJA</option>
                  <option value="SOBRE">SOBRE</option>
                  <option value="SACA">SACA</option>
                </select>
              </div>

              {(searchTerm || locationFilter !== 'ALL' || shelfFilter !== 'ALL' || floorFilter !== 'ALL' || packageTypeFilter !== 'ALL') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setLocationFilter('ALL');
                    setShelfFilter('ALL');
                    setFloorFilter('ALL');
                    setPackageTypeFilter('ALL');
                  }}
                  style={{ background: '#f1f5f9', border: 'none', padding: '4px 10px', borderRadius: '6px', color: '#ef4444', fontWeight: 800, cursor: 'pointer' }}
                >
                  ✕ Limpiar Filtros
                </button>
              )}
            </div>
          </div>

          {/* Tabla de Existencias */}
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 800 }}>
                    <th style={{ padding: '10px 14px', width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.length > 0 && selectedIds.length === filteredPaquetes.length}
                        onChange={handleSelectAll}
                      />
                    </th>
                    <th style={{ padding: '10px 14px' }}>Guía WR / Tracking</th>
                    <th style={{ padding: '10px 14px' }}>Casillero / Cliente</th>
                    <th style={{ padding: '10px 14px' }}>Descripción & Tipo</th>
                    <th style={{ padding: '10px 14px' }}>Peso & Valor</th>
                    <th style={{ padding: '10px 14px' }}>Ubicación Sede</th>
                    <th style={{ padding: '10px 14px' }}>Anaquel & Piso (WMS)</th>
                    <th style={{ padding: '10px 14px' }}>Estado</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPaquetes.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                        <Boxes style={{ width: '40px', height: '40px', margin: '0 auto 8px auto', color: '#cbd5e1' }} />
                        <div style={{ fontWeight: 800, color: '#64748b' }}>No se encontraron paquetes con los filtros seleccionados</div>
                      </td>
                    </tr>
                  ) : (
                    filteredPaquetes.map(pkg => {
                      const pos = pkg.posicionEstante || (pkg.anaquel && pkg.piso ? `${pkg.anaquel}-${pkg.piso}` : 'REC');
                      const isSelected = selectedIds.includes(pkg.id);

                      return (
                        <tr
                          key={pkg.id}
                          style={{
                            borderBottom: '1px solid #f1f5f9',
                            background: isSelected ? '#eff6ff' : '#ffffff',
                            transition: 'background 0.15s ease'
                          }}
                        >
                          <td style={{ padding: '10px 14px' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelect(pkg.id)}
                            />
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 800, color: '#0f172a', fontFamily: 'monospace', fontSize: '13px' }}>
                              {pkg.numeroReciboBodega}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                              {pkg.trackingUsa}
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 800, color: '#2563eb' }}>{pkg.codigoCasillero}</div>
                            <div style={{ fontSize: '11.5px', color: '#334155' }}>{pkg.nombreConsignatario || 'Consignatario no asignado'}</div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ color: '#0f172a', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {pkg.descripcion}
                            </div>
                            <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#475569' }}>
                              {pkg.tipoEmpaque}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 800, color: '#0f172a' }}>{pkg.pesoKg} Kg</div>
                            <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>${pkg.valorDeclaradoUsd} USD</div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 800,
                                padding: '3px 8px',
                                borderRadius: '6px',
                                background:
                                  pkg.ubicacionActual === 'TibCourierMiami' ? '#dbeafe' :
                                  pkg.ubicacionActual === 'TibTingoMaria' ? '#fef3c7' :
                                  pkg.ubicacionActual === 'AmexLince' ? '#dcfce7' : '#f1f5f9',
                                color:
                                  pkg.ubicacionActual === 'TibCourierMiami' ? '#1e40af' :
                                  pkg.ubicacionActual === 'TibTingoMaria' ? '#92400e' :
                                  pkg.ubicacionActual === 'AmexLince' ? '#166534' : '#475569'
                              }}
                            >
                              {pkg.ubicacionActual}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span
                                style={{
                                  fontSize: '11.5px',
                                  fontWeight: 800,
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontFamily: 'monospace',
                                  background:
                                    pos.startsWith('A1') ? '#eff6ff' :
                                    pos.startsWith('A2') ? '#f0fdf4' : '#fefce8',
                                  color:
                                    pos.startsWith('A1') ? '#1d4ed8' :
                                    pos.startsWith('A2') ? '#15803d' : '#b45309',
                                  border: `1px solid ${
                                    pos.startsWith('A1') ? '#bfdbfe' :
                                    pos.startsWith('A2') ? '#bbf7d0' : '#fde047'
                                  }`
                                }}
                              >
                                {pos}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: pkg.estadoEntrega === 'EnAlmacen' ? '#0369a1' : '#15803d'
                              }}
                            >
                              {pkg.estadoEntrega}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              <button
                                title="Reubicar o Trasladar"
                                onClick={() => openTransferModal(pkg)}
                                style={{
                                  background: '#eff6ff',
                                  border: '1px solid #bfdbfe',
                                  color: '#1d4ed8',
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                              </button>

                              <button
                                title="Editar Paquete / Ajustar Existencia"
                                onClick={() => openEditModal(pkg)}
                                style={{
                                  background: '#f8fafc',
                                  border: '1px solid #cbd5e1',
                                  color: '#334155',
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>

                              {pkg.facturaPdfUrl && (
                                <button
                                  title="Ver Factura PDF"
                                  onClick={() => onViewPdf(pkg.facturaPdfUrl!)}
                                  style={{
                                    background: '#fef2f2',
                                    border: '1px solid #fecaca',
                                    color: '#dc2626',
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* VISTA 2: KARDEX DE MOVIMIENTOS & TRAZABILIDAD */}
      {activeSubTab === 'movimientos' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock className="w-5 h-5 text-blue-600" /> Bitácora Kardex de Movimientos y Auditoría
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                Registro cronológico de entradas, salidas, reubicaciones y pases a despacho
              </p>
            </div>

            <button
              onClick={() => openTransferModal()}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700 }}
            >
              <Plus className="w-4 h-4" /> Registrar Nuevo Movimiento
            </button>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 800 }}>
                  <th style={{ padding: '10px 14px' }}>Fecha & Hora</th>
                  <th style={{ padding: '10px 14px' }}>Paquete / Guía</th>
                  <th style={{ padding: '10px 14px' }}>Consignatario</th>
                  <th style={{ padding: '10px 14px' }}>Origen ➔ Destino</th>
                  <th style={{ padding: '10px 14px' }}>Motivo de Traslado</th>
                  <th style={{ padding: '10px 14px' }}>Operador Responsable</th>
                </tr>
              </thead>
              <tbody>
                {movimientosList.map(mov => (
                  <tr key={mov.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', color: '#64748b', fontSize: '12px' }}>
                      {mov.fechaHora}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 800, fontFamily: 'monospace', color: '#2563eb' }}>
                      {mov.codigoPaquete}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#0f172a', fontWeight: 600 }}>
                      {mov.consignatario}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                        <span style={{ color: '#dc2626', fontWeight: 700 }}>{mov.origen}</span>
                        <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                        <span style={{ color: '#16a34a', fontWeight: 700 }}>{mov.destino}</span>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', color: '#334155' }}>
                      {mov.motivo}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#64748b', fontSize: '11.5px', fontWeight: 700 }}>
                      <span style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: '4px' }}>
                        {mov.operador}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISTA 3: MATRIZ VISUAL DE ANAQUELES (SLOTTING 3D/2D) */}
      {activeSubTab === 'matriz' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers className="w-5 h-5 text-indigo-600" /> Mapa Físico del Almacén Sede Lince
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
              Vista estructural de estanterías y capacidad por nivel (P1 Inferior, P2 Medio, P3 Superior)
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {/* ANAQUEL 1 */}
            <div style={{ background: '#ffffff', border: '2px solid #3b82f6', borderRadius: '14px', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers className="w-4 h-4" /> ANAQUEL 1 (Izquierdo)
                </span>
                <span style={{ fontSize: '12px', fontWeight: 800, background: '#dbeafe', color: '#1e40af', padding: '2px 8px', borderRadius: '6px' }}>
                  {countA1} paquetes
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {['P3', 'P2', 'P1'].map(pisoKey => {
                  const posCode = `A1-${pisoKey}`;
                  const pkgsInFloor = paquetes.filter(p => (p.posicionEstante === posCode || (p.anaquel === 'A1' && p.piso === pisoKey)));
                  const pisoLabel = pisoKey === 'P3' ? 'Piso 3 (Superior - Ligeros)' : pisoKey === 'P2' ? 'Piso 2 (Medio - Rápido Acceso)' : 'Piso 1 (Inferior - Pesados)';

                  return (
                    <div
                      key={posCode}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>{pisoLabel}</span>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#2563eb', fontFamily: 'monospace' }}>{posCode}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '8px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.min((pkgsInFloor.length / 25) * 100, 100)}%`,
                              height: '100%',
                              background: pkgsInFloor.length > 20 ? '#ef4444' : pkgsInFloor.length > 12 ? '#f59e0b' : '#22c55e',
                              borderRadius: '999px',
                              transition: 'width 0.3s ease'
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569', minWidth: '70px', textAlign: 'right' }}>
                          {pkgsInFloor.length} / 25 cap
                        </span>
                      </div>

                      {pkgsInFloor.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                          {pkgsInFloor.slice(0, 6).map(p => (
                            <span
                              key={p.id}
                              style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                fontFamily: 'monospace',
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                color: '#334155'
                              }}
                            >
                              {p.numeroReciboBodega}
                            </span>
                          ))}
                          {pkgsInFloor.length > 6 && (
                            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, alignSelf: 'center' }}>
                              +{pkgsInFloor.length - 6} más
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ANAQUEL 2 */}
            <div style={{ background: '#ffffff', border: '2px solid #16a34a', borderRadius: '14px', padding: '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px' }}>
                <span style={{ fontSize: '14px', fontWeight: 800, color: '#15803d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Layers className="w-4 h-4" /> ANAQUEL 2 (Derecho)
                </span>
                <span style={{ fontSize: '12px', fontWeight: 800, background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '6px' }}>
                  {countA2} paquetes
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {['P3', 'P2', 'P1'].map(pisoKey => {
                  const posCode = `A2-${pisoKey}`;
                  const pkgsInFloor = paquetes.filter(p => (p.posicionEstante === posCode || (p.anaquel === 'A2' && p.piso === pisoKey)));
                  const pisoLabel = pisoKey === 'P3' ? 'Piso 3 (Superior - Ligeros)' : pisoKey === 'P2' ? 'Piso 2 (Medio - Rápido Acceso)' : 'Piso 1 (Inferior - Pesados)';

                  return (
                    <div
                      key={posCode}
                      style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        borderRadius: '10px',
                        padding: '12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>{pisoLabel}</span>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#16a34a', fontFamily: 'monospace' }}>{posCode}</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, height: '8px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.min((pkgsInFloor.length / 25) * 100, 100)}%`,
                              height: '100%',
                              background: pkgsInFloor.length > 20 ? '#ef4444' : pkgsInFloor.length > 12 ? '#f59e0b' : '#22c55e',
                              borderRadius: '999px',
                              transition: 'width 0.3s ease'
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: '#475569', minWidth: '70px', textAlign: 'right' }}>
                          {pkgsInFloor.length} / 25 cap
                        </span>
                      </div>

                      {pkgsInFloor.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                          {pkgsInFloor.slice(0, 6).map(p => (
                            <span
                              key={p.id}
                              style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                fontFamily: 'monospace',
                                background: '#ffffff',
                                border: '1px solid #cbd5e1',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                color: '#334155'
                              }}
                            >
                              {p.numeroReciboBodega}
                            </span>
                          ))}
                          {pkgsInFloor.length > 6 && (
                            <span style={{ fontSize: '10px', color: '#64748b', fontWeight: 700, alignSelf: 'center' }}>
                              +{pkgsInFloor.length - 6} más
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE REUBICACIÓN / TRASLADO WMS */}
      {isTransferModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowRightLeft className="w-5 h-5 text-blue-600" /> Reubicar / Trasladar Paquete(s)
              </span>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleExecuteTransfer} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#1e40af' }}>
                  {selectedPackageForAction
                    ? `Paquete: ${selectedPackageForAction.numeroReciboBodega} (${selectedPackageForAction.codigoCasillero})`
                    : `Paquetes seleccionados en lote: ${selectedIds.length} unidades`}
                </div>
              </div>

              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Almacén / Sede de Destino</label>
                <select
                  value={transferData.targetUbicacion}
                  onChange={e => setTransferData({ ...transferData, targetUbicacion: e.target.value as TipoUbicacion })}
                  className="form-control"
                  required
                >
                  <option value="AmexLince">Sede Central Lince (Lima)</option>
                  <option value="TibTingoMaria">Almacén Regional Tingo María</option>
                  <option value="TibCourierMiami">Bodega Hub Miami (USA)</option>
                  <option value="Entregado">Entregado a Cliente / Finalizado</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Anaquel Destino</label>
                  <select
                    value={transferData.targetAnaquel}
                    onChange={e => setTransferData({ ...transferData, targetAnaquel: e.target.value })}
                    className="form-control"
                    required
                  >
                    <option value="A1">Anaquel 1 (A1)</option>
                    <option value="A2">Anaquel 2 (A2)</option>
                    <option value="RECEPCION">Recepción (REC)</option>
                    <option value="DESPACHO">Despacho (DSP)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Piso / Nivel</label>
                  <select
                    value={transferData.targetPiso}
                    onChange={e => setTransferData({ ...transferData, targetPiso: e.target.value })}
                    className="form-control"
                    required
                  >
                    <option value="P1">Piso 1 (Inferior)</option>
                    <option value="P2">Piso 2 (Medio)</option>
                    <option value="P3">Piso 3 (Superior)</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Motivo del Movimiento</label>
                <select
                  value={transferData.motivo}
                  onChange={e => setTransferData({ ...transferData, motivo: e.target.value })}
                  className="form-control"
                  required
                >
                  <option value="Reubicación WMS de Almacén">Reubicación WMS de Almacén</option>
                  <option value="Ingreso de Carga Vuelo Miami">Ingreso de Carga Vuelo Miami</option>
                  <option value="Traslado a Zona de Despacho">Traslado a Zona de Despacho</option>
                  <option value="Ajuste de Espacio / Reordenamiento">Ajuste de Espacio / Reordenamiento</option>
                  <option value="Pase a Ruta de Reparto Lince">Pase a Ruta de Reparto Lince</option>
                </select>
              </div>

              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Operador Responsable</label>
                <input
                  type="text"
                  value={transferData.operador}
                  onChange={e => setTransferData({ ...transferData, operador: e.target.value })}
                  className="form-control"
                  required
                />
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="btn"
                  style={{ background: '#f1f5f9', color: '#475569', fontWeight: 700 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ fontWeight: 800 }}
                >
                  ✓ Confirmar Traslado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE EDICIÓN / AJUSTE DE PAQUETE */}
      {isEditModalOpen && selectedPackageForAction && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit3 className="w-5 h-5 text-blue-600" /> Editar Paquete / Ajustar Existencia
              </span>
              <button
                onClick={() => setIsEditModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Guía WR (No editable)</label>
                  <input
                    type="text"
                    value={editFormData.numeroReciboBodega || ''}
                    disabled
                    className="form-control"
                    style={{ background: '#f1f5f9', fontWeight: 800, fontFamily: 'monospace' }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Código Casillero</label>
                  <input
                    type="text"
                    value={editFormData.codigoCasillero || ''}
                    onChange={e => setEditFormData({ ...editFormData, codigoCasillero: e.target.value })}
                    className="form-control"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Nombre Consignatario</label>
                <input
                  type="text"
                  value={editFormData.nombreConsignatario || ''}
                  onChange={e => setEditFormData({ ...editFormData, nombreConsignatario: e.target.value })}
                  className="form-control"
                  required
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Descripción del Contenido</label>
                <input
                  type="text"
                  value={editFormData.descripcion || ''}
                  onChange={e => setEditFormData({ ...editFormData, descripcion: e.target.value })}
                  className="form-control"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Peso (Kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.pesoKg || 0}
                    onChange={e => setEditFormData({ ...editFormData, pesoKg: Number(e.target.value) })}
                    className="form-control"
                    required
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Valor Decl. ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.valorDeclaradoUsd || 0}
                    onChange={e => setEditFormData({ ...editFormData, valorDeclaradoUsd: Number(e.target.value) })}
                    className="form-control"
                    required
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Tipo Empaque</label>
                  <select
                    value={editFormData.tipoEmpaque || 'CAJA'}
                    onChange={e => setEditFormData({ ...editFormData, tipoEmpaque: e.target.value })}
                    className="form-control"
                  >
                    <option value="CAJA">CAJA</option>
                    <option value="SOBRE">SOBRE</option>
                    <option value="SACA">SACA</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Almacén Sede</label>
                  <select
                    value={editFormData.ubicacionActual || 'AmexLince'}
                    onChange={e => setEditFormData({ ...editFormData, ubicacionActual: e.target.value as TipoUbicacion })}
                    className="form-control"
                  >
                    <option value="AmexLince">Sede Central Lince</option>
                    <option value="TibCourierMiami">Miami Hub (USA)</option>
                    <option value="TibTingoMaria">Tingo María</option>
                    <option value="Entregado">Entregado</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Posición Estante WMS</label>
                  <input
                    type="text"
                    value={editFormData.posicionEstante || 'A1-P1'}
                    onChange={e => setEditFormData({ ...editFormData, posicionEstante: e.target.value })}
                    placeholder="Ej: A1-P1, A2-P3, REC"
                    className="form-control"
                  />
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="btn"
                  style={{ background: '#f1f5f9', color: '#475569', fontWeight: 700 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ fontWeight: 800 }}
                >
                  ✓ Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
