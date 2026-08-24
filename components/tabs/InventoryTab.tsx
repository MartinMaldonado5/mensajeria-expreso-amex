'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Paquete, Cliente, TipoUbicacion, EstanteriaPosicion, MovimientoKardex, AlmacenSede } from '@/types';
import {
  Boxes,
  ArrowRightLeft,
  Layers,
  Search,
  Filter,
  Download,
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
  ExternalLink,
  Settings,
  ShieldCheck,
  Package,
  Activity,
  Grid
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

interface InventoryTabProps {
  paquetes: Paquete[];
  clientes: Cliente[];
  onNewPackage: () => void;
  onViewPdf: (url: string) => void;
  onUpdatePackage?: (updated: Paquete) => void;
}

export default function InventoryTab({
  paquetes,
  clientes,
  onNewPackage,
  onViewPdf,
  onUpdatePackage
}: InventoryTabProps) {
  // Sub-pestañas: 'existencias' | 'movimientos' | 'matriz' | 'gestor'
  const [activeSubTab, setActiveSubTab] = useState<'existencias' | 'movimientos' | 'matriz' | 'gestor'>('existencias');

  // Filtros de Existencias
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [shelfFilter, setShelfFilter] = useState<string>('ALL');
  const [floorFilter, setFloorFilter] = useState<string>('ALL');
  const [packageTypeFilter, setPackageTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Filtros de Kardex
  const [kardexSearch, setKardexSearch] = useState('');
  const [kardexTypeFilter, setKardexTypeFilter] = useState<string>('ALL');

  // Selección múltiple para acciones en lote
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Datos de Supabase en Tiempo Real
  const [kardexList, setKardexList] = useState<MovimientoKardex[]>([]);
  const [posicionesList, setPosicionesList] = useState<EstanteriaPosicion[]>([]);
  const [sedesList, setSedesList] = useState<AlmacenSede[]>([]);
  const [isLoadingKardex, setIsLoadingKardex] = useState(false);

  // Modales
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isNewPositionModalOpen, setIsNewPositionModalOpen] = useState(false);
  const [inspectingPosition, setInspectingPosition] = useState<string | null>(null);
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

  // Formulario de Nueva Posición / Anaquel WMS
  const [newPositionData, setNewPositionData] = useState<{
    almacenCodigo: string;
    codigoEstante: string;
    nivelPiso: string;
    zonaTipo: string;
    capacidadMaxPaquetes: number;
    pesoMaxKg: number;
    descripcion: string;
  }>({
    almacenCodigo: 'LIN',
    codigoEstante: 'A3',
    nivelPiso: 'P1',
    zonaTipo: 'ALMACENAJE',
    capacidadMaxPaquetes: 40,
    pesoMaxKg: 120,
    descripcion: 'Nuevo anaquel de almacenamiento'
  });

  // Carga inicial de Kardex, Posiciones y Sedes desde Supabase
  const fetchData = useCallback(async () => {
    setIsLoadingKardex(true);
    try {
      // 1. Sedes
      const { data: sedesData } = await supabase
        .from('almacenes_sedes')
        .select('*')
        .order('nombre', { ascending: true });
      if (sedesData) {
        setSedesList(
          sedesData.map(s => ({
            id: s.id,
            codigo: s.codigo,
            nombre: s.nombre,
            tipo: s.tipo || 'ALMACEN',
            direccion: s.direccion || '',
            ciudad: s.ciudad || '',
            pais: s.pais || '',
            esActivo: s.es_activo ?? true,
            creadoEn: s.creado_en || ''
          }))
        );
      }

      // 2. Estanterías / Posiciones
      const { data: posData } = await supabase
        .from('estanterias_posiciones')
        .select('*')
        .order('codigo_posicion', { ascending: true });
      if (posData) {
        setPosicionesList(
          posData.map(p => ({
            id: p.id,
            almacenId: p.almacen_id || '',
            codigoEstante: p.codigo_estante,
            nivelPiso: p.nivel_piso,
            codigoPosicion: p.codigo_posicion,
            zonaTipo: p.zona_tipo || 'ALMACENAJE',
            capacidadMaxPaquetes: p.capacidad_max_paquetes || 40,
            pesoMaxKg: Number(p.peso_max_kg || 150),
            descripcion: p.descripcion || '',
            creadoEn: p.creado_en || ''
          }))
        );
      }

      // 3. Kardex Movimientos
      const { data: kData } = await supabase
        .from('movimientos_kardex')
        .select('*')
        .order('creado_en', { ascending: false })
        .limit(200);
      if (kData) {
        setKardexList(
          kData.map(k => ({
            id: k.id,
            paqueteId: k.paquete_id || undefined,
            codigoPaquete: k.codigo_paquete,
            consignatario: k.consignatario || '',
            origenDescripcion: k.origen_descripcion,
            destinoDescripcion: k.destino_descripcion,
            tipoMovimiento: k.tipo_movimiento,
            motivo: k.motivo || '',
            usuarioOperador: k.usuario_operador || 'Operador AMEX',
            creadoEn: k.creado_en || new Date().toISOString()
          }))
        );
      }
    } catch (err) {
      console.warn('Error fetching WMS data from Supabase:', err);
    } finally {
      setIsLoadingKardex(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    // Suscripción Realtime a movimientos_kardex y estanterias_posiciones
    const kardexChannel = supabase
      .channel('kardex_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'movimientos_kardex' },
        payload => {
          const newK = payload.new as {
            id: string;
            paquete_id?: string;
            codigo_paquete: string;
            consignatario?: string;
            origen_descripcion: string;
            destino_descripcion: string;
            tipo_movimiento: string;
            motivo?: string;
            usuario_operador?: string;
            creado_en?: string;
          };
          setKardexList(prev => [
            {
              id: newK.id,
              paqueteId: newK.paquete_id,
              codigoPaquete: newK.codigo_paquete,
              consignatario: newK.consignatario || '',
              origenDescripcion: newK.origen_descripcion,
              destinoDescripcion: newK.destino_descripcion,
              tipoMovimiento: newK.tipo_movimiento,
              motivo: newK.motivo || '',
              usuarioOperador: newK.usuario_operador || 'Operador AMEX',
              creadoEn: newK.creado_en || new Date().toISOString()
            },
            ...prev
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(kardexChannel);
    };
  }, [fetchData]);

  // Métricas globales WMS
  const totalExistencias = paquetes.length;
  const totalPesoKg = paquetes.reduce((acc, p) => acc + (Number(p.pesoKg) || 0), 0);
  const totalValorUsd = paquetes.reduce((acc, p) => acc + (Number(p.valorDeclaradoUsd) || 0), 0);

  const countMiami = paquetes.filter(p => p.ubicacionActual === 'TibCourierMiami').length;
  const countTingo = paquetes.filter(
    p => p.ubicacionActual === 'TibTingoMaria' || p.ubicacionActual === 'TibCourierTingoMaria'
  ).length;
  const countLince = paquetes.filter(p => p.ubicacionActual === 'AmexLince').length;

  // Filtrado reactivo de paquetes
  const filteredPaquetes = useMemo(() => {
    return paquetes.filter(p => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !q ||
        p.numeroReciboBodega?.toLowerCase().includes(q) ||
        p.trackingUsa?.toLowerCase().includes(q) ||
        p.codigoCasillero?.toLowerCase().includes(q) ||
        p.nombreConsignatario?.toLowerCase().includes(q) ||
        p.dniConsignatario?.toLowerCase().includes(q) ||
        p.descripcion?.toLowerCase().includes(q) ||
        p.posicionEstante?.toLowerCase().includes(q);

      const matchesLocation = locationFilter === 'ALL' || p.ubicacionActual === locationFilter;

      const pos = p.posicionEstante || (p.anaquel && p.piso ? `${p.anaquel}-${p.piso}` : 'REC');
      const matchesShelf =
        shelfFilter === 'ALL'
          ? true
          : shelfFilter === 'REC'
          ? pos.startsWith('REC') || (!p.posicionEstante && !p.anaquel)
          : pos.startsWith(shelfFilter);

      const matchesFloor = floorFilter === 'ALL' ? true : pos.includes(floorFilter) || p.piso === floorFilter;

      const matchesType = packageTypeFilter === 'ALL' || p.tipoEmpaque === packageTypeFilter;
      const matchesStatus = statusFilter === 'ALL' || p.estadoEntrega === statusFilter;

      return matchesSearch && matchesLocation && matchesShelf && matchesFloor && matchesType && matchesStatus;
    });
  }, [paquetes, searchTerm, locationFilter, shelfFilter, floorFilter, packageTypeFilter, statusFilter]);

  // Filtrado reactivo de Kardex
  const filteredKardex = useMemo(() => {
    return kardexList.filter(k => {
      const q = kardexSearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        k.codigoPaquete.toLowerCase().includes(q) ||
        (k.consignatario && k.consignatario.toLowerCase().includes(q)) ||
        k.origenDescripcion.toLowerCase().includes(q) ||
        k.destinoDescripcion.toLowerCase().includes(q) ||
        k.usuarioOperador.toLowerCase().includes(q) ||
        (k.motivo && k.motivo.toLowerCase().includes(q));

      const matchesType = kardexTypeFilter === 'ALL' || k.tipoMovimiento === kardexTypeFilter;

      return matchesSearch && matchesType;
    });
  }, [kardexList, kardexSearch, kardexTypeFilter]);

  // Agrupación dinámica de posiciones de estantería por anaquel
  const shelfGroups = useMemo(() => {
    const groups: { [key: string]: EstanteriaPosicion[] } = {};

    // Fallback default si no hay registros en Supabase todavía
    const effectivePosiciones =
      posicionesList.length > 0
        ? posicionesList
        : [
            { id: '1', almacenId: 'LIN', codigoEstante: 'A1', nivelPiso: 'P1', codigoPosicion: 'A1-P1', zonaTipo: 'ALMACENAJE', capacidadMaxPaquetes: 40, pesoMaxKg: 150 },
            { id: '2', almacenId: 'LIN', codigoEstante: 'A1', nivelPiso: 'P2', codigoPosicion: 'A1-P2', zonaTipo: 'ALMACENAJE', capacidadMaxPaquetes: 40, pesoMaxKg: 120 },
            { id: '3', almacenId: 'LIN', codigoEstante: 'A1', nivelPiso: 'P3', codigoPosicion: 'A1-P3', zonaTipo: 'ALMACENAJE', capacidadMaxPaquetes: 40, pesoMaxKg: 80 },
            { id: '4', almacenId: 'LIN', codigoEstante: 'A2', nivelPiso: 'P1', codigoPosicion: 'A2-P1', zonaTipo: 'ALMACENAJE', capacidadMaxPaquetes: 40, pesoMaxKg: 150 },
            { id: '5', almacenId: 'LIN', codigoEstante: 'A2', nivelPiso: 'P2', codigoPosicion: 'A2-P2', zonaTipo: 'ALMACENAJE', capacidadMaxPaquetes: 40, pesoMaxKg: 120 },
            { id: '6', almacenId: 'LIN', codigoEstante: 'A2', nivelPiso: 'P3', codigoPosicion: 'A2-P3', zonaTipo: 'ALMACENAJE', capacidadMaxPaquetes: 40, pesoMaxKg: 80 },
            { id: '7', almacenId: 'LIN', codigoEstante: 'REC', nivelPiso: 'P1', codigoPosicion: 'REC', zonaTipo: 'RECEPCION', capacidadMaxPaquetes: 100, pesoMaxKg: 500 },
            { id: '8', almacenId: 'LIN', codigoEstante: 'DSP', nivelPiso: 'P1', codigoPosicion: 'DSP', zonaTipo: 'DESPACHO', capacidadMaxPaquetes: 100, pesoMaxKg: 500 }
          ];

    effectivePosiciones.forEach(pos => {
      if (!groups[pos.codigoEstante]) {
        groups[pos.codigoEstante] = [];
      }
      groups[pos.codigoEstante].push(pos);
    });

    return groups;
  }, [posicionesList]);

  // Manejadores de Selección Múltiple
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredPaquetes.map(p => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]));
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
    const targetPos =
      transferData.targetAnaquel === 'REC' || transferData.targetAnaquel === 'DSP'
        ? transferData.targetAnaquel
        : `${transferData.targetAnaquel}-${transferData.targetPiso}`;
    const idsToMove = selectedPackageForAction ? [selectedPackageForAction.id] : selectedIds;

    if (idsToMove.length === 0) return;

    try {
      // 1. Actualizar paquetes en Supabase
      await supabase
        .from('paquetes')
        .update({
          ubicacion_actual: transferData.targetUbicacion,
          anaquel: transferData.targetAnaquel,
          piso: transferData.targetPiso,
          posicion_estante: targetPos
        })
        .in('id', idsToMove);

      // 2. Registrar en Kardex de Movimientos Inmutable
      const nowStr = new Date().toISOString();
      const kardexInserts = [];

      for (const id of idsToMove) {
        const pkg = paquetes.find(p => p.id === id);
        if (pkg) {
          const origenStr = `${pkg.ubicacionActual} (${pkg.posicionEstante || 'REC'})`;
          const destinoStr = `${transferData.targetUbicacion} (${targetPos})`;

          kardexInserts.push({
            paquete_id: pkg.id,
            codigo_paquete: pkg.numeroReciboBodega,
            consignatario: pkg.nombreConsignatario || pkg.codigoCasillero,
            origen_descripcion: origenStr,
            destino_descripcion: destinoStr,
            tipo_movimiento: 'REUBICACION',
            motivo: transferData.motivo,
            usuario_operador: transferData.operador
          });

          // Notificar actualización local si hay prop
          if (onUpdatePackage) {
            onUpdatePackage({
              ...pkg,
              ubicacionActual: transferData.targetUbicacion,
              anaquel: transferData.targetAnaquel,
              piso: transferData.targetPiso,
              posicionEstante: targetPos
            });
          }
        }
      }

      if (kardexInserts.length > 0) {
        await supabase.from('movimientos_kardex').insert(kardexInserts);
      }
    } catch (err) {
      console.warn('Error executing transfer in Supabase:', err);
    }

    setIsTransferModalOpen(false);
    setSelectedIds([]);
    setSelectedPackageForAction(null);
  };

  // Abrir Modal de Edición de Paquete
  const openEditModal = (pkg: Paquete) => {
    setSelectedPackageForAction(pkg);
    setEditFormData({ ...pkg });
    setIsEditModalOpen(true);
  };

  // Guardar Edición de Paquete
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPackageForAction) return;

    const pos =
      editFormData.posicionEstante || `${editFormData.anaquel || 'A1'}-${editFormData.piso || 'P1'}`;
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

  // Guardar Nueva Posición / Anaquel WMS
  const handleCreatePosition = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const sede = sedesList.find(s => s.codigo === newPositionData.almacenCodigo);
      const almacenId = sede ? sede.id : null;
      const codigoPos = `${newPositionData.codigoEstante}-${newPositionData.nivelPiso}`;

      const { data, error } = await supabase.from('estanterias_posiciones').insert({
        almacen_id: almacenId,
        codigo_estante: newPositionData.codigoEstante.toUpperCase(),
        nivel_piso: newPositionData.nivelPiso.toUpperCase(),
        codigo_posicion: codigoPos.toUpperCase(),
        zona_tipo: newPositionData.zonaTipo,
        capacidad_max_paquetes: Number(newPositionData.capacidadMaxPaquetes),
        peso_max_kg: Number(newPositionData.pesoMaxKg),
        descripcion: newPositionData.descripcion
      }).select();

      if (!error && data && data.length > 0) {
        const p = data[0];
        setPosicionesList(prev => [
          ...prev,
          {
            id: p.id,
            almacenId: p.almacen_id || '',
            codigoEstante: p.codigo_estante,
            nivelPiso: p.nivel_piso,
            codigoPosicion: p.codigo_posicion,
            zonaTipo: p.zona_tipo || 'ALMACENAJE',
            capacidadMaxPaquetes: p.capacidad_max_paquetes || 40,
            pesoMaxKg: Number(p.peso_max_kg || 150),
            descripcion: p.descripcion || '',
            creadoEn: p.creado_en || ''
          }
        ]);
        setIsNewPositionModalOpen(false);
      }
    } catch (err) {
      console.warn('Error creating shelf position:', err);
    }
  };

  // Eliminar Posición de Estantería
  const handleDeletePosition = async (posId: string) => {
    if (!confirm('¿Estás seguro de eliminar esta posición de estantería?')) return;
    try {
      await supabase.from('estanterias_posiciones').delete().eq('id', posId);
      setPosicionesList(prev => prev.filter(p => p.id !== posId));
    } catch (err) {
      console.warn('Error deleting shelf position:', err);
    }
  };

  // Exportar Existencias a CSV
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

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `inventario_amex_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Exportar Kardex a CSV
  const handleExportKardexCSV = () => {
    const headers = [
      'Fecha y Hora',
      'Guía Paquete',
      'Consignatario',
      'Origen',
      'Destino',
      'Tipo Movimiento',
      'Motivo',
      'Operador Responsable'
    ];

    const rows = filteredKardex.map(k => [
      new Date(k.creadoEn).toLocaleString(),
      k.codigoPaquete,
      `"${k.consignatario || ''}"`,
      `"${k.origenDescripcion}"`,
      `"${k.destinoDescripcion}"`,
      k.tipoMovimiento,
      `"${k.motivo || ''}"`,
      `"${k.usuarioOperador}"`
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `kardex_amex_${new Date().toISOString().slice(0, 10)}.csv`);
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

      <div
        className="page-title-bar"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}
      >
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
            onClick={activeSubTab === 'movimientos' ? handleExportKardexCSV : handleExportCSV}
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#334155',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700
            }}
          >
            <Download className="w-4 h-4 text-emerald-600" /> Exportar CSV
          </button>

          <button
            className="btn"
            onClick={() => setIsNewPositionModalOpen(true)}
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#1e40af',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700
            }}
          >
            <Settings className="w-4 h-4 text-blue-600" /> + Configurar Anaquel
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

      {/* KPI Ribbons (Métricas Clave WMS) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              Total Existencias
            </span>
            <Boxes className="w-5 h-5 text-blue-600" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>
            {totalExistencias} <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>paquetes</span>
          </div>
          <div style={{ fontSize: '11px', color: '#22c55e', marginTop: '4px', fontWeight: 700 }}>
            ● Sincronizado en Vivo (Supabase)
          </div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              Peso Total en Custodia
            </span>
            <Warehouse className="w-5 h-5 text-indigo-600" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>
            {totalPesoKg.toFixed(2)} <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Kg</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Carga física en almacenes</div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              Valor Declarado
            </span>
            <FileText className="w-5 h-5 text-emerald-600" />
          </div>
          <div style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>
            ${totalValorUsd.toFixed(2)}{' '}
            <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>USD</span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>Valor comercial asegurado</div>
        </div>

        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '14px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>
              Distribución por Sede
            </span>
            <MapPin className="w-5 h-5 text-amber-600" />
          </div>
          <div style={{ display: 'flex', gap: '8px', fontSize: '11.5px', fontWeight: 700, marginTop: '4px', flexWrap: 'wrap' }}>
            <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px' }}>
              MIA: {countMiami}
            </span>
            <span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: '4px' }}>
              TGO: {countTingo}
            </span>
            <span style={{ background: '#f0fdf4', color: '#15803d', padding: '2px 6px', borderRadius: '4px' }}>
              LINCE: {countLince}
            </span>
          </div>
        </div>
      </div>

      {/* Selector de Sub-Pestañas */}
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
          <ArrowRightLeft className="w-4 h-4" /> 2. Kardex de Movimientos & Trazabilidad ({kardexList.length})
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

        <button
          onClick={() => setActiveSubTab('gestor')}
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
            background: activeSubTab === 'gestor' ? '#2563eb' : 'transparent',
            color: activeSubTab === 'gestor' ? '#ffffff' : '#64748b',
            transition: 'all 0.15s ease'
          }}
        >
          <Settings className="w-4 h-4" /> 4. Configuración de Estanterías ({posicionesList.length})
        </button>
      </div>

      {/* VISTA 1: EXISTENCIAS Y ALMACÉN */}
      {activeSubTab === 'existencias' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Barra de Filtros y Búsqueda */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ position: 'relative', flex: '1 1 280px' }}>
                <Search
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '10px',
                    width: '16px',
                    height: '16px',
                    color: '#94a3b8'
                  }}
                />
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
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: '#eff6ff',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    border: '1px solid #bfdbfe'
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#1e40af' }}>
                    {selectedIds.length} paquete(s) seleccionados
                  </span>
                  <button
                    onClick={() => openTransferModal()}
                    className="btn btn-primary"
                    style={{
                      padding: '4px 10px',
                      fontSize: '12px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" /> Reubicar / Trasladar Selección
                  </button>
                  <button
                    onClick={() => setSelectedIds([])}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      fontSize: '11.5px',
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
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
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    background: '#ffffff'
                  }}
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
                  onChange={e => {
                    setShelfFilter(e.target.value);
                    setFloorFilter('ALL');
                  }}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    background: '#ffffff'
                  }}
                >
                  <option value="ALL">Todos los Anaqueles</option>
                  {Object.keys(shelfGroups).map(shelfKey => (
                    <option key={shelfKey} value={shelfKey}>
                      Anaquel {shelfKey}
                    </option>
                  ))}
                  <option value="REC">Recepción / Sin Estante</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 800, color: '#475569' }}>Piso:</span>
                <select
                  value={floorFilter}
                  onChange={e => setFloorFilter(e.target.value)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    background: '#ffffff'
                  }}
                >
                  <option value="ALL">Todos los Pisos</option>
                  <option value="P1">P1 (Inferior)</option>
                  <option value="P2">P2 (Medio)</option>
                  <option value="P3">P3 (Superior)</option>
                  <option value="P4">P4 (Especial)</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontWeight: 800, color: '#475569' }}>Empaque:</span>
                <select
                  value={packageTypeFilter}
                  onChange={e => setPackageTypeFilter(e.target.value)}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '12px',
                    background: '#ffffff'
                  }}
                >
                  <option value="ALL">Todos</option>
                  <option value="CAJA">CAJA</option>
                  <option value="SOBRE">SOBRE</option>
                  <option value="SACA">SACA</option>
                </select>
              </div>

              {(searchTerm ||
                locationFilter !== 'ALL' ||
                shelfFilter !== 'ALL' ||
                floorFilter !== 'ALL' ||
                packageTypeFilter !== 'ALL') && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setLocationFilter('ALL');
                    setShelfFilter('ALL');
                    setFloorFilter('ALL');
                    setPackageTypeFilter('ALL');
                  }}
                  style={{
                    background: '#f1f5f9',
                    border: 'none',
                    padding: '4px 10px',
                    borderRadius: '6px',
                    color: '#ef4444',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                >
                  ✕ Limpiar Filtros
                </button>
              )}
            </div>
          </div>

          {/* Tabla de Existencias */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
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
                        <div style={{ fontWeight: 800, color: '#64748b' }}>
                          No se encontraron paquetes con los filtros seleccionados
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredPaquetes.map(pkg => {
                      const pos =
                        pkg.posicionEstante ||
                        (pkg.anaquel && pkg.piso ? `${pkg.anaquel}-${pkg.piso}` : 'REC');
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
                            <div
                              style={{
                                fontWeight: 800,
                                color: '#0f172a',
                                fontFamily: 'monospace',
                                fontSize: '13px'
                              }}
                            >
                              {pkg.numeroReciboBodega}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                              {pkg.trackingUsa}
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 800, color: '#2563eb' }}>{pkg.codigoCasillero}</div>
                            <div style={{ fontSize: '11.5px', color: '#334155' }}>
                              {pkg.nombreConsignatario || 'Consignatario no asignado'}
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div
                              style={{
                                color: '#0f172a',
                                maxWidth: '200px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                            >
                              {pkg.descripcion}
                            </div>
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 800,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: '#f1f5f9',
                                color: '#475569'
                              }}
                            >
                              {pkg.tipoEmpaque}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 800, color: '#0f172a' }}>{pkg.pesoKg} Kg</div>
                            <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>
                              ${pkg.valorDeclaradoUsd} USD
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 800,
                                padding: '3px 8px',
                                borderRadius: '6px',
                                background:
                                  pkg.ubicacionActual === 'TibCourierMiami'
                                    ? '#dbeafe'
                                    : pkg.ubicacionActual === 'TibTingoMaria'
                                    ? '#fef3c7'
                                    : pkg.ubicacionActual === 'AmexLince'
                                    ? '#dcfce7'
                                    : '#f1f5f9',
                                color:
                                  pkg.ubicacionActual === 'TibCourierMiami'
                                    ? '#1e40af'
                                    : pkg.ubicacionActual === 'TibTingoMaria'
                                    ? '#92400e'
                                    : pkg.ubicacionActual === 'AmexLince'
                                    ? '#166534'
                                    : '#475569'
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
                                  background: pos.startsWith('A1')
                                    ? '#eff6ff'
                                    : pos.startsWith('A2')
                                    ? '#f0fdf4'
                                    : '#fefce8',
                                  color: pos.startsWith('A1')
                                    ? '#1d4ed8'
                                    : pos.startsWith('A2')
                                    ? '#15803d'
                                    : '#b45309',
                                  border: `1px solid ${
                                    pos.startsWith('A1')
                                      ? '#bfdbfe'
                                      : pos.startsWith('A2')
                                      ? '#bbf7d0'
                                      : '#fde047'
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
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px'
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '15px',
                  fontWeight: 800,
                  color: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Clock className="w-5 h-5 text-blue-600" /> Bitácora Kardex de Movimientos y Auditoría en Tiempo Real
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                Registro cronológico inmutable de entradas, salidas, reubicaciones y cambios de estado
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={fetchData}
                className="btn"
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12.5px',
                  fontWeight: 700
                }}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingKardex ? 'animate-spin' : ''}`} /> Refrescar
              </button>

              <button
                onClick={() => openTransferModal()}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700 }}
              >
                <Plus className="w-4 h-4" /> Registrar Movimiento
              </button>
            </div>
          </div>

          {/* Filtros de Kardex */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '12px 16px',
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              alignItems: 'center'
            }}
          >
            <div style={{ position: 'relative', flex: '1 1 240px' }}>
              <Search
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '9px',
                  width: '15px',
                  height: '15px',
                  color: '#94a3b8'
                }}
              />
              <input
                type="text"
                placeholder="Buscar por Guía, Consignatario, Origen, Destino u Operador..."
                value={kardexSearch}
                onChange={e => setKardexSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 32px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12.5px'
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#475569' }}>Tipo:</span>
              <select
                value={kardexTypeFilter}
                onChange={e => setKardexTypeFilter(e.target.value)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px'
                }}
              >
                <option value="ALL">Todos los Movimientos</option>
                <option value="RECEPCION">Recepción</option>
                <option value="SLOTTING">Slotting / Clasificación</option>
                <option value="REUBICACION">Reubicación</option>
                <option value="DESPACHO">Despacho</option>
                <option value="ENTREGA">Entrega</option>
              </select>
            </div>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 800 }}>
                  <th style={{ padding: '10px 14px' }}>Fecha & Hora</th>
                  <th style={{ padding: '10px 14px' }}>Paquete / Guía</th>
                  <th style={{ padding: '10px 14px' }}>Consignatario</th>
                  <th style={{ padding: '10px 14px' }}>Origen ➔ Destino</th>
                  <th style={{ padding: '10px 14px' }}>Tipo & Motivo</th>
                  <th style={{ padding: '10px 14px' }}>Operador Responsable</th>
                </tr>
              </thead>
              <tbody>
                {filteredKardex.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                      <Clock style={{ width: '36px', height: '36px', margin: '0 auto 8px auto', color: '#cbd5e1' }} />
                      <div style={{ fontWeight: 800, color: '#64748b' }}>No hay registros de Kardex coincidentes</div>
                    </td>
                  </tr>
                ) : (
                  filteredKardex.map(mov => (
                    <tr key={mov.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '10px 14px', color: '#64748b', fontSize: '12px' }}>
                        {new Date(mov.creadoEn).toLocaleString()}
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 800, fontFamily: 'monospace', color: '#2563eb' }}>
                        {mov.codigoPaquete}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#0f172a', fontWeight: 600 }}>
                        {mov.consignatario || '-'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                          <span style={{ color: '#dc2626', fontWeight: 700 }}>{mov.origenDescripcion}</span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                          <span style={{ color: '#16a34a', fontWeight: 700 }}>{mov.destinoDescripcion}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', color: '#334155' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            background: '#eff6ff',
                            color: '#1e40af',
                            marginRight: '6px'
                          }}
                        >
                          {mov.tipoMovimiento}
                        </span>
                        {mov.motivo}
                      </td>
                      <td style={{ padding: '10px 14px', color: '#64748b', fontSize: '11.5px', fontWeight: 700 }}>
                        <span style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: '4px' }}>
                          {mov.usuarioOperador}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VISTA 3: MATRIZ VISUAL DE ANAQUELES (SLOTTING DINÁMICO 2D) */}
      {activeSubTab === 'matriz' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px'
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '15px',
                  fontWeight: 800,
                  color: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Layers className="w-5 h-5 text-indigo-600" /> Mapa Físico del Almacén Sede Lince & Distribución de Anaqueles
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                Slotting en vivo con mapa de calor y control de capacidad por estante y nivel
              </p>
            </div>

            <button
              onClick={() => setIsNewPositionModalOpen(true)}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700 }}
            >
              <Plus className="w-4 h-4" /> Agregar Nuevo Anaquel / Nivel
            </button>
          </div>

          {/* Grilla dinámica de Anaqueles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
            {Object.entries(shelfGroups).map(([shelfCode, positions]) => {
              const totalInShelf = paquetes.filter(
                p =>
                  p.anaquel === shelfCode ||
                  (p.posicionEstante && p.posicionEstante.startsWith(shelfCode))
              ).length;

              const isSpecialZone = shelfCode === 'REC' || shelfCode === 'DSP';
              const borderColor =
                shelfCode === 'A1'
                  ? '#3b82f6'
                  : shelfCode === 'A2'
                  ? '#16a34a'
                  : isSpecialZone
                  ? '#f59e0b'
                  : '#8b5cf6';

              return (
                <div
                  key={shelfCode}
                  style={{
                    background: '#ffffff',
                    border: `2px solid ${borderColor}`,
                    borderRadius: '14px',
                    padding: '16px',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '14px',
                      borderBottom: '1px solid #e2e8f0',
                      paddingBottom: '10px'
                    }}
                  >
                    <span
                      style={{
                        fontSize: '14px',
                        fontWeight: 800,
                        color: '#0f172a',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Layers className="w-4 h-4 text-blue-600" />{' '}
                      {isSpecialZone
                        ? shelfCode === 'REC'
                          ? 'Mesa de Recepción (REC)'
                          : 'Zona de Despacho (DSP)'
                        : `ANAQUEL ${shelfCode}`}
                    </span>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 800,
                        background: '#eff6ff',
                        color: '#1e40af',
                        padding: '2px 8px',
                        borderRadius: '6px'
                      }}
                    >
                      {totalInShelf} paquetes
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {positions.map(posItem => {
                      const posCode = posItem.codigoPosicion;
                      const pkgsInFloor = paquetes.filter(
                        p =>
                          p.posicionEstante === posCode ||
                          (p.anaquel === shelfCode && p.piso === posItem.nivelPiso)
                      );
                      const maxCap = posItem.capacidadMaxPaquetes || 40;
                      const percent = Math.min(Math.round((pkgsInFloor.length / maxCap) * 100), 100);

                      const floorLabel =
                        posItem.nivelPiso === 'P3'
                          ? 'Piso 3 (Superior)'
                          : posItem.nivelPiso === 'P2'
                          ? 'Piso 2 (Medio)'
                          : posItem.nivelPiso === 'P1'
                          ? 'Piso 1 (Inferior)'
                          : `Nivel ${posItem.nivelPiso}`;

                      return (
                        <div
                          key={posItem.id}
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
                            <span style={{ fontSize: '12px', fontWeight: 800, color: '#0f172a' }}>
                              {isSpecialZone ? posItem.descripcion || posCode : floorLabel}
                            </span>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 800,
                                color: '#2563eb',
                                fontFamily: 'monospace'
                              }}
                            >
                              {posCode}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div
                              style={{
                                flex: 1,
                                height: '8px',
                                background: '#e2e8f0',
                                borderRadius: '999px',
                                overflow: 'hidden'
                              }}
                            >
                              <div
                                style={{
                                  width: `${percent}%`,
                                  height: '100%',
                                  background: percent > 85 ? '#ef4444' : percent > 60 ? '#f59e0b' : '#22c55e',
                                  borderRadius: '999px',
                                  transition: 'width 0.3s ease'
                                }}
                              />
                            </div>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 800,
                                color: '#475569',
                                minWidth: '70px',
                                textAlign: 'right'
                              }}
                            >
                              {pkgsInFloor.length} / {maxCap} ({percent}%)
                            </span>
                          </div>

                          {pkgsInFloor.length > 0 && (
                            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                              {pkgsInFloor.slice(0, 6).map(p => (
                                <span
                                  key={p.id}
                                  onClick={() => openTransferModal(p)}
                                  title={`Clic para reubicar: ${p.numeroReciboBodega} (${p.nombreConsignatario || p.codigoCasillero})`}
                                  style={{
                                    fontSize: '10px',
                                    fontWeight: 800,
                                    fontFamily: 'monospace',
                                    background: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    color: '#334155',
                                    cursor: 'pointer'
                                  }}
                                >
                                  {p.numeroReciboBodega}
                                </span>
                              ))}
                              {pkgsInFloor.length > 6 && (
                                <span
                                  onClick={() => setInspectingPosition(posCode)}
                                  style={{
                                    fontSize: '10px',
                                    color: '#2563eb',
                                    fontWeight: 800,
                                    alignSelf: 'center',
                                    cursor: 'pointer',
                                    textDecoration: 'underline'
                                  }}
                                >
                                  +{pkgsInFloor.length - 6} más (Ver todos)
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VISTA 4: CONFIGURACIÓN Y GESTOR DE ANAQUELES */}
      {activeSubTab === 'gestor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '10px'
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '15px',
                  fontWeight: 800,
                  color: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Settings className="w-5 h-5 text-indigo-600" /> Gestor Dinámico de Estanterías y Parámetros WMS
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                Administra los anaqueles físicos, niveles de piso, límites de peso y zonas de operación
              </p>
            </div>

            <button
              onClick={() => setIsNewPositionModalOpen(true)}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 700 }}
            >
              <Plus className="w-4 h-4" /> Agregar Nueva Posición
            </button>
          </div>

          <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 800 }}>
                  <th style={{ padding: '10px 14px' }}>Código Posición</th>
                  <th style={{ padding: '10px 14px' }}>Anaquel</th>
                  <th style={{ padding: '10px 14px' }}>Nivel / Piso</th>
                  <th style={{ padding: '10px 14px' }}>Tipo de Zona</th>
                  <th style={{ padding: '10px 14px' }}>Capacidad Paquetes</th>
                  <th style={{ padding: '10px 14px' }}>Límite Peso (Kg)</th>
                  <th style={{ padding: '10px 14px' }}>Descripción</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {posicionesList.map(pos => (
                  <tr key={pos.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 800, fontFamily: 'monospace', color: '#2563eb' }}>
                      {pos.codigoPosicion}
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>
                      {pos.codigoEstante}
                    </td>
                    <td style={{ padding: '10px 14px', color: '#334155' }}>
                      {pos.nivelPiso}
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      <span
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background:
                            pos.zonaTipo === 'ALMACENAJE'
                              ? '#dbeafe'
                              : pos.zonaTipo === 'RECEPCION'
                              ? '#fef3c7'
                              : '#dcfce7',
                          color:
                            pos.zonaTipo === 'ALMACENAJE'
                              ? '#1e40af'
                              : pos.zonaTipo === 'RECEPCION'
                              ? '#92400e'
                              : '#166534'
                        }}
                      >
                        {pos.zonaTipo}
                      </span>
                    </td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>
                      {pos.capacidadMaxPaquetes} bultos
                    </td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>
                      {pos.pesoMaxKg} Kg
                    </td>
                    <td style={{ padding: '10px 14px', color: '#64748b' }}>
                      {pos.descripcion || '-'}
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      <button
                        title="Eliminar Posición"
                        onClick={() => handleDeletePosition(pos.id)}
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                    {Object.keys(shelfGroups).map(shelfKey => (
                      <option key={shelfKey} value={shelfKey}>
                        Anaquel {shelfKey}
                      </option>
                    ))}
                    <option value="REC">Recepción (REC)</option>
                    <option value="DSP">Despacho (DSP)</option>
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
                    <option value="P4">Piso 4 (Especial)</option>
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
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 800 }}>
                  ✓ Confirmar Traslado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE NUEVA POSICIÓN / ANAQUEL WMS */}
      {isNewPositionModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus className="w-5 h-5 text-blue-600" /> Crear Nueva Posición de Anaquel
              </span>
              <button
                onClick={() => setIsNewPositionModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreatePosition} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Almacén Sede</label>
                  <select
                    value={newPositionData.almacenCodigo}
                    onChange={e => setNewPositionData({ ...newPositionData, almacenCodigo: e.target.value })}
                    className="form-control"
                  >
                    <option value="LIN">Sede Central Lince</option>
                    <option value="MIA">Miami Hub (USA)</option>
                    <option value="TGO">Tingo María</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Código Anaquel</label>
                  <input
                    type="text"
                    placeholder="Ej: A3, B1, S1"
                    value={newPositionData.codigoEstante}
                    onChange={e => setNewPositionData({ ...newPositionData, codigoEstante: e.target.value })}
                    className="form-control"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Nivel de Piso</label>
                  <select
                    value={newPositionData.nivelPiso}
                    onChange={e => setNewPositionData({ ...newPositionData, nivelPiso: e.target.value })}
                    className="form-control"
                  >
                    <option value="P1">P1 (Inferior)</option>
                    <option value="P2">P2 (Medio)</option>
                    <option value="P3">P3 (Superior)</option>
                    <option value="P4">P4 (Especial)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Tipo de Zona</label>
                  <select
                    value={newPositionData.zonaTipo}
                    onChange={e => setNewPositionData({ ...newPositionData, zonaTipo: e.target.value })}
                    className="form-control"
                  >
                    <option value="ALMACENAJE">Almacenaje Normal</option>
                    <option value="RECEPCION">Zona de Recepción</option>
                    <option value="DESPACHO">Zona de Despacho</option>
                    <option value="DEVOLUCION">Devoluciones / Rechazos</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Capacidad Máx. (Paquetes)</label>
                  <input
                    type="number"
                    value={newPositionData.capacidadMaxPaquetes}
                    onChange={e => setNewPositionData({ ...newPositionData, capacidadMaxPaquetes: Number(e.target.value) })}
                    className="form-control"
                    required
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Peso Máx. (Kg)</label>
                  <input
                    type="number"
                    value={newPositionData.pesoMaxKg}
                    onChange={e => setNewPositionData({ ...newPositionData, pesoMaxKg: Number(e.target.value) })}
                    className="form-control"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Descripción / Ubicación Física</label>
                <input
                  type="text"
                  placeholder="Ej: Anaquel sector derecho pasillo 2"
                  value={newPositionData.descripcion}
                  onChange={e => setNewPositionData({ ...newPositionData, descripcion: e.target.value })}
                  className="form-control"
                />
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsNewPositionModalOpen(false)}
                  className="btn"
                  style={{ background: '#f1f5f9', color: '#475569', fontWeight: 700 }}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 800 }}>
                  ✓ Guardar Posición
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
                <button type="submit" className="btn btn-primary" style={{ fontWeight: 800 }}>
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
