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
  Grid,
  Printer,
  FileSpreadsheet
} from 'lucide-react';
import { supabase } from '@/lib/supabase/client';
import { TableSkeleton, MatrixSkeleton } from '@/components/ui/Skeleton';
import ThermalLabelModal from '@/components/modals/ThermalLabelModal';
import { TipoEstadoEntrega } from '@/types';
import { matchesFuzzySearch } from '@/lib/fuzzySearch';
import { exportPaquetesToExcel, exportKardexToExcel } from '@/lib/excelExport';

interface InventoryTabProps {
  paquetes: Paquete[];
  clientes: Cliente[];
  onNewPackage: () => void;
  onViewPdf: (url: string) => void;
  onUpdatePackage?: (updated: Paquete) => void;
  onDeletePackage?: (id: string) => void;
  onRefreshData?: () => Promise<void> | void;
}

export default function InventoryTab({
  paquetes,
  clientes,
  onNewPackage,
  onViewPdf,
  onUpdatePackage,
  onDeletePackage,
  onRefreshData
}: InventoryTabProps) {
  // Sub-pestañas: 'existencias' | 'movimientos' | 'matriz' | 'gestor'
  const [activeSubTab, setActiveSubTab] = useState<'existencias' | 'movimientos' | 'matriz' | 'gestor'>('existencias');

  // Filtros de Existencias (Por defecto enfocado en Almacén Central Lince)
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState<string>('AmexLince');
  const [shelfFilter, setShelfFilter] = useState<string>('ALL');
  const [floorFilter, setFloorFilter] = useState<string>('ALL');
  const [packageTypeFilter, setPackageTypeFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Paginación reactiva
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

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

  // Modales Pop-Up
  const [isGestorModalOpen, setIsGestorModalOpen] = useState(false);
  const [isMatrizModalOpen, setIsMatrizModalOpen] = useState(false);
  const [isKardexModalOpen, setIsKardexModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isNewPositionModalOpen, setIsNewPositionModalOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<EstanteriaPosicion | null>(null);
  const [isBatchStatusModalOpen, setIsBatchStatusModalOpen] = useState(false);
  const [batchTargetStatus, setBatchTargetStatus] = useState<TipoEstadoEntrega>('EnAlmacen');
  const [selectedThermalPkg, setSelectedThermalPkg] = useState<Paquete | null>(null);
  const [inspectingPosition, setInspectingPosition] = useState<string | null>(null);
  const [selectedPackageForAction, setSelectedPackageForAction] = useState<Paquete | null>(null);

  // Filtros interactivos para la vista de Anaqueles
  const [shelfSearchTerm, setShelfSearchTerm] = useState('');
  const [shelfZoneFilter, setShelfZoneFilter] = useState<string>('ALL');
  const [shelfOccupancyFilter, setShelfOccupancyFilter] = useState<string>('ALL');

  // Modo de creación de anaquel: 'batch' (Lote de N pisos) | 'single' (1 posición)
  const [newPositionMode, setNewPositionMode] = useState<'batch' | 'single'>('batch');
  const [batchShelfData, setBatchShelfData] = useState<{
    almacenCodigo: string;
    codigoEstante: string;
    cantidadPisos: number;
    capacidadPorPiso: number;
    pesoPorPiso: number;
    zonaTipo: string;
    descripcion: string;
  }>({
    almacenCodigo: 'LIN',
    codigoEstante: '',
    cantidadPisos: 3,
    capacidadPorPiso: 40,
    pesoPorPiso: 150,
    zonaTipo: 'ALMACENAJE',
    descripcion: ''
  });

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

  // Formulario de Nueva Posición Individual
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

  // Filtrado reactivo de paquetes con Motor Fuzzy Inteligente
  const filteredPaquetes = useMemo(() => {
    return paquetes.filter(p => {
      const pos = p.posicionEstante || (p.anaquel && p.piso ? `${p.anaquel}-${p.piso}` : 'REC');

      const matchesSearch = matchesFuzzySearch(searchTerm, [
        p.numeroReciboBodega,
        p.trackingUsa,
        p.codigoCasillero,
        p.nombreConsignatario,
        p.dniConsignatario,
        p.descripcion,
        p.posicionEstante,
        p.anaquel,
        p.piso,
        pos,
        p.numeroFactura,
        p.tipoEmpaque,
        p.estadoEntrega
      ]);

      const matchesLocation = locationFilter === 'ALL' || p.ubicacionActual === locationFilter;

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

  // Resetear página al cambiar cualquier filtro
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, locationFilter, shelfFilter, floorFilter, packageTypeFilter, statusFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredPaquetes.length / pageSize));
  const paginatedPaquetes = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPaquetes.slice(start, start + pageSize);
  }, [filteredPaquetes, currentPage, pageSize]);

  // Filtrado reactivo de Kardex con Motor Fuzzy
  const filteredKardex = useMemo(() => {
    return kardexList.filter(k => {
      const matchesSearch = matchesFuzzySearch(kardexSearch, [
        k.codigoPaquete,
        k.consignatario,
        k.origenDescripcion,
        k.destinoDescripcion,
        k.usuarioOperador,
        k.motivo,
        k.tipoMovimiento
      ]);

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

  // Eliminar paquete individual
  const handleDeletePackage = async (pkgId: string, wrCode: string) => {
    if (!confirm(`¿Estás seguro de eliminar el paquete ${wrCode} de la base de datos de Almacén Lince?`)) return;
    try {
      await supabase.from('paquetes').delete().eq('id', pkgId);
      if (onDeletePackage) {
        onDeletePackage(pkgId);
      }
      setSelectedIds(prev => prev.filter(x => x !== pkgId));
    } catch (err) {
      console.error('Error eliminando paquete:', err);
      alert('Error al eliminar paquete.');
    }
  };

  // Cambio rápido de estado individual
  const handleQuickStatusChange = async (pkg: Paquete, newStatus: TipoEstadoEntrega) => {
    try {
      await supabase.from('paquetes').update({ estado_entrega: newStatus }).eq('id', pkg.id);
      const updated: Paquete = { ...pkg, estadoEntrega: newStatus };
      if (onUpdatePackage) onUpdatePackage(updated);

      await supabase.from('movimientos_kardex').insert({
        paquete_id: pkg.id,
        codigo_paquete: pkg.numeroReciboBodega,
        consignatario: pkg.nombreConsignatario || pkg.codigoCasillero,
        origen_descripcion: `AmexLince (${pkg.posicionEstante || 'REC'})`,
        destino_descripcion: `Estado actualizado a: ${newStatus}`,
        tipo_movimiento: newStatus === 'Entregado' ? 'ENTREGA' : 'ESTADO_CAMBIO',
        motivo: 'Ajuste operativo desde Almacén Central Lince',
        usuario_operador: 'Operador Logístico AMEX'
      });
    } catch (err) {
      console.error('Error actualizando estado:', err);
    }
  };

  // Cambio de estado masivo en lote
  const handleBatchStatusChange = async () => {
    if (selectedIds.length === 0) return;
    try {
      await supabase.from('paquetes').update({ estado_entrega: batchTargetStatus }).in('id', selectedIds);
      for (const id of selectedIds) {
        const pkg = paquetes.find(p => p.id === id);
        if (pkg) {
          const updated: Paquete = { ...pkg, estadoEntrega: batchTargetStatus };
          if (onUpdatePackage) onUpdatePackage(updated);
          await supabase.from('movimientos_kardex').insert({
            paquete_id: pkg.id,
            codigo_paquete: pkg.numeroReciboBodega,
            consignatario: pkg.nombreConsignatario || pkg.codigoCasillero,
            origen_descripcion: `AmexLince (${pkg.posicionEstante || 'REC'})`,
            destino_descripcion: `Estado en lote: ${batchTargetStatus}`,
            tipo_movimiento: batchTargetStatus === 'Entregado' ? 'ENTREGA' : 'ESTADO_CAMBIO',
            motivo: 'Cambio masivo de estado desde Almacén Lince',
            usuario_operador: 'Operador Logístico AMEX'
          });
        }
      }
      setIsBatchStatusModalOpen(false);
      setSelectedIds([]);
    } catch (err) {
      console.error('Error actualizando estado en lote:', err);
    }
  };

  // Eliminación masiva en lote
  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`¿Estás seguro de eliminar los ${selectedIds.length} paquetes seleccionados de la base de datos?`)) return;
    try {
      await supabase.from('paquetes').delete().in('id', selectedIds);
      if (onDeletePackage) {
        selectedIds.forEach(id => onDeletePackage(id));
      }
      setSelectedIds([]);
    } catch (err) {
      console.error('Error eliminando en lote:', err);
    }
  };

  // Guardar Nueva Posición Individual
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

  // Crear Anaquel Completo en Lote (N Pisos de un solo clic)
  const handleCreateBatchShelf = async (e: React.FormEvent) => {
    e.preventDefault();
    const codigoEstanteClean = batchShelfData.codigoEstante.trim().toUpperCase();
    if (!codigoEstanteClean) {
      alert('Por favor ingresa un código para el anaquel (ej: A3, B1).');
      return;
    }

    try {
      const sede = sedesList.find(s => s.codigo === batchShelfData.almacenCodigo);
      const almacenId = sede ? sede.id : null;

      const newPositionsToInsert = [];
      for (let i = 1; i <= batchShelfData.cantidadPisos; i++) {
        const nivelPiso = `P${i}`;
        const codigoPosicion = `${codigoEstanteClean}-${nivelPiso}`;
        newPositionsToInsert.push({
          almacen_id: almacenId,
          codigo_estante: codigoEstanteClean,
          nivel_piso: nivelPiso,
          codigo_posicion: codigoPosicion,
          zona_tipo: batchShelfData.zonaTipo,
          capacidad_max_paquetes: Number(batchShelfData.capacidadPorPiso),
          peso_max_kg: Number(batchShelfData.pesoPorPiso),
          descripcion: batchShelfData.descripcion || `Anaquel ${codigoEstanteClean} - Piso ${i}`
        });
      }

      const { data, error } = await supabase
        .from('estanterias_posiciones')
        .insert(newPositionsToInsert)
        .select();

      if (!error && data) {
        const created: EstanteriaPosicion[] = data.map(p => ({
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
        }));
        setPosicionesList(prev => [...prev, ...created]);
        setIsNewPositionModalOpen(false);
        setBatchShelfData({
          almacenCodigo: 'LIN',
          codigoEstante: '',
          cantidadPisos: 3,
          capacidadPorPiso: 40,
          pesoPorPiso: 150,
          zonaTipo: 'ALMACENAJE',
          descripcion: ''
        });
      }
    } catch (err) {
      console.error('Error creating batch shelf:', err);
    }
  };

  // Guardar Edición de Posición / Capacidad
  const handleUpdatePosition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPosition) return;
    try {
      await supabase
        .from('estanterias_posiciones')
        .update({
          zona_tipo: editingPosition.zonaTipo,
          capacidad_max_paquetes: Number(editingPosition.capacidadMaxPaquetes),
          peso_max_kg: Number(editingPosition.pesoMaxKg),
          descripcion: editingPosition.descripcion
        })
        .eq('id', editingPosition.id);

      setPosicionesList(prev =>
        prev.map(p => (p.id === editingPosition.id ? editingPosition : p))
      );
      setEditingPosition(null);
    } catch (err) {
      console.error('Error updating shelf position:', err);
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

  // Exportar Existencias a Excel (.xlsx)
  const handleExportExcel = () => {
    exportPaquetesToExcel(filteredPaquetes, 'Inventario_AMEX_Lince');
  };

  // Exportar Kardex a Excel (.xlsx)
  const handleExportKardexExcel = () => {
    exportKardexToExcel(filteredKardex, 'Kardex_Movimientos_AMEX');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Breadcrumb & Header Principal */}
      <div className="sap-breadcrumb">
        <span>Operaciones y Almacenes</span> / <span>Almacén Central Sede Lince (Lima)</span>
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
            <Warehouse style={{ width: '28px', height: '28px', color: '#2563eb' }} />
            Almacén Central Sede Lince (Lima)
          </h1>
          <p className="page-subtitle" style={{ margin: '4px 0 0 0' }}>
            Búsquedas en tiempo real, modificaciones de bultos, traslados entre anaqueles/pisos y control de salidas
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className="btn"
            onClick={handleExportExcel}
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

          <button
            className="btn"
            onClick={() => setIsMatrizModalOpen(true)}
            style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#1e40af',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700
            }}
          >
            <Layers className="w-4 h-4 text-blue-600" /> 🗺️ Mapa 3D Slotting
          </button>

          <button
            className="btn"
            onClick={() => setIsGestorModalOpen(true)}
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
            <Settings className="w-4 h-4 text-slate-700" /> ⚙️ Configurar Anaqueles
          </button>

          <button
            className="btn"
            onClick={() => setIsKardexModalOpen(true)}
            style={{
              background: '#f0fdfa',
              border: '1px solid #99f6e4',
              color: '#0f766e',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700
            }}
          >
            <Clock className="w-4 h-4 text-teal-600" /> 🔄 Kardex Movimientos
          </button>

          <button
            className="btn"
            onClick={async () => {
              if (onRefreshData) await onRefreshData();
            }}
            style={{
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#0f172a',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 800,
              cursor: 'pointer'
            }}
            title="Sincronizar inventario en vivo"
          >
            <RefreshCw className="w-4 h-4 text-blue-600" /> Actualizar
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

      {/* Selector de Sub-Pestañas & Accesos Pop-Up */}
      {/* Selector de Sub-Pestañas & Accesos Directos */}
      <div className="wms-subtab-container" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <button
          onClick={() => setActiveSubTab('existencias')}
          className="wms-subtab-btn"
          style={{
            background: activeSubTab === 'existencias' ? '#2563eb' : '#f8fafc',
            color: activeSubTab === 'existencias' ? '#ffffff' : '#475569',
            border: activeSubTab === 'existencias' ? '1px solid #1d4ed8' : '1px solid #e2e8f0',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          <Boxes className="w-4 h-4" /> 1. Existencias Lince ({filteredPaquetes.length})
        </button>

        <button
          onClick={() => setActiveSubTab('matriz')}
          className="wms-subtab-btn"
          style={{
            background: activeSubTab === 'matriz' ? '#4338ca' : '#f8fafc',
            color: activeSubTab === 'matriz' ? '#ffffff' : '#475569',
            border: activeSubTab === 'matriz' ? '1px solid #3730a3' : '1px solid #e2e8f0',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          <Layers className="w-4 h-4" /> 2. 🗺️ Mapa Visual de Anaqueles ({Object.keys(shelfGroups).length} Estantes)
        </button>

        <button
          onClick={() => setActiveSubTab('gestor')}
          className="wms-subtab-btn"
          style={{
            background: activeSubTab === 'gestor' ? '#1e40af' : '#f8fafc',
            color: activeSubTab === 'gestor' ? '#ffffff' : '#475569',
            border: activeSubTab === 'gestor' ? '1px solid #1e3a8a' : '1px solid #e2e8f0',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          <Settings className="w-4 h-4" /> 3. ⚙️ Configurar Anaqueles & Capacidad ({posicionesList.length})
        </button>

        <button
          onClick={() => setActiveSubTab('movimientos')}
          className="wms-subtab-btn"
          style={{
            background: activeSubTab === 'movimientos' ? '#0f766e' : '#f8fafc',
            color: activeSubTab === 'movimientos' ? '#ffffff' : '#475569',
            border: activeSubTab === 'movimientos' ? '1px solid #115e59' : '1px solid #e2e8f0',
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 14px',
            borderRadius: '8px',
            cursor: 'pointer'
          }}
        >
          <Clock className="w-4 h-4" /> 4. 🔄 Kardex Movimientos ({kardexList.length})
        </button>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => {
              setNewPositionMode('batch');
              setIsNewPositionModalOpen(true);
            }}
            style={{
              background: '#2563eb',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 14px',
              fontSize: '12px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(37,99,235,0.2)'
            }}
          >
            <Plus className="w-4 h-4" /> + Crear Nuevo Anaquel
          </button>
        </div>
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
                    border: '1px solid #bfdbfe',
                    flexWrap: 'wrap'
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#1e40af' }}>
                    {selectedIds.length} paquete(s) seleccionados:
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
                    <ArrowRightLeft className="w-3.5 h-3.5" /> Reubicar Selección
                  </button>
                  <button
                    onClick={() => setIsBatchStatusModalOpen(true)}
                    className="btn btn-secondary"
                    style={{
                      padding: '4px 10px',
                      fontSize: '12px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: '#ffffff'
                    }}
                  >
                    <Truck className="w-3.5 h-3.5 text-amber-600" /> Cambiar Estado
                  </button>
                  <button
                    onClick={handleBatchDelete}
                    className="btn"
                    style={{
                      padding: '4px 10px',
                      fontSize: '12px',
                      height: '28px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: '#fee2e2',
                      color: '#dc2626',
                      border: '1px solid #fecaca'
                    }}
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Eliminar
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
                    paginatedPaquetes.map(pkg => {
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
                              {pkg.descripcion || 'Sin descripción'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              {pkg.tipoEmpaque || 'CAJA'}
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ fontWeight: 800, color: '#0f172a' }}>
                              {Number(pkg.pesoKg || 0).toFixed(2)} kg
                            </div>
                            <div style={{ fontSize: '11px', color: '#059669', fontWeight: 700 }}>
                              ${Number(pkg.valorDeclaradoUsd || 0).toFixed(2)} USD
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 8px',
                                borderRadius: '9999px',
                                fontSize: '11px',
                                fontWeight: 800,
                                background:
                                  pkg.ubicacionActual === 'AmexLince'
                                    ? '#dcfce7'
                                    : pkg.ubicacionActual === 'TibCourierMiami'
                                    ? '#dbeafe'
                                    : '#fef3c7',
                                color:
                                  pkg.ubicacionActual === 'AmexLince'
                                    ? '#15803d'
                                    : pkg.ubicacionActual === 'TibCourierMiami'
                                    ? '#1e40af'
                                    : '#b45309'
                              }}
                            >
                              <MapPin className="w-3 h-3" />
                              {pkg.ubicacionActual === 'AmexLince'
                                ? 'Sede Lince'
                                : pkg.ubicacionActual === 'TibCourierMiami'
                                ? 'Miami Hub'
                                : pkg.ubicacionActual || 'Almacén'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontWeight: 900,
                                fontSize: '12px',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                background: pos.startsWith('REC') ? '#fef3c7' : '#eff6ff',
                                color: pos.startsWith('REC') ? '#b45309' : '#1d4ed8',
                                border: pos.startsWith('REC') ? '1px solid #fde68a' : '1px solid #bfdbfe'
                              }}
                            >
                              📍 {pos}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span
                              style={{
                                padding: '3px 8px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                background:
                                  pkg.estadoEntrega === 'EntregadoDomicilio' || pkg.estadoEntrega === 'RecogidoAlmacen'
                                    ? '#dcfce7'
                                    : pkg.estadoEntrega === 'EnRutaCarroAmex'
                                    ? '#dbeafe'
                                    : '#f1f5f9',
                                color:
                                  pkg.estadoEntrega === 'EntregadoDomicilio' || pkg.estadoEntrega === 'RecogidoAlmacen'
                                    ? '#15803d'
                                    : pkg.estadoEntrega === 'EnRutaCarroAmex'
                                    ? '#1d4ed8'
                                    : '#475569'
                              }}
                            >
                              {pkg.estadoEntrega === 'EnAlmacen'
                                ? 'En Almacén'
                                : pkg.estadoEntrega === 'EnRutaCarroAmex'
                                ? 'En Ruta'
                                : pkg.estadoEntrega === 'ListoParaRecojo'
                                ? 'Listo Recojo'
                                : pkg.estadoEntrega === 'EntregadoDomicilio'
                                ? 'Entregado'
                                : pkg.estadoEntrega || 'En Almacén'}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                              <button
                                title="Mover a otro Estante / Anaquel"
                                onClick={() => openTransferModal(pkg)}
                                style={{
                                  background: '#eff6ff',
                                  border: '1px solid #bfdbfe',
                                  color: '#2563eb',
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
                                title="Editar Paquete / Modificar Datos"
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

                              <button
                                title="Imprimir Rótulo Térmico 4x6"
                                onClick={() => setSelectedThermalPkg(pkg)}
                                style={{
                                  background: '#f0fdf4',
                                  border: '1px solid #bbf7d0',
                                  color: '#166534',
                                  width: '28px',
                                  height: '28px',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center'
                                }}
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>

                              {pkg.facturaPdfUrl && (
                                <button
                                  title="Ver Factura PDF R2"
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

                              <button
                                title="Eliminar Paquete"
                                onClick={() => handleDeletePackage(pkg.id, pkg.numeroReciboBodega)}
                                style={{
                                  background: '#fee2e2',
                                  border: '1px solid #fca5a5',
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
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Barra de Paginación Reactiva */}
            {filteredPaquetes.length > 0 && (
              <div
                style={{
                  padding: '10px 16px',
                  background: '#f8fafc',
                  borderTop: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px',
                  fontSize: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b' }}>
                  <span>
                    Mostrando <b>{Math.min((currentPage - 1) * pageSize + 1, filteredPaquetes.length)}</b> -{' '}
                    <b>{Math.min(currentPage * pageSize, filteredPaquetes.length)}</b> de{' '}
                    <b>{filteredPaquetes.length}</b> paquetes
                  </span>

                  <span style={{ color: '#cbd5e1' }}>•</span>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span>Por página:</span>
                    <select
                      value={pageSize}
                      onChange={e => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      style={{
                        padding: '2px 6px',
                        borderRadius: '4px',
                        border: '1px solid #cbd5e1',
                        background: '#ffffff',
                        fontSize: '12px',
                        fontWeight: 700
                      }}
                    >
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                      <option value={200}>200</option>
                    </select>
                  </label>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: currentPage <= 1 ? '#f1f5f9' : '#ffffff',
                      color: currentPage <= 1 ? '#94a3b8' : '#0f172a',
                      fontWeight: 700,
                      cursor: currentPage <= 1 ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Anterior
                  </button>

                  <span style={{ padding: '4px 8px', fontWeight: 800, color: '#2563eb' }}>
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={currentPage >= totalPages}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      background: currentPage >= totalPages ? '#f1f5f9' : '#ffffff',
                      color: currentPage >= totalPages ? '#94a3b8' : '#0f172a',
                      fontWeight: 700,
                      cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer'
                    }}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
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

          {isLoadingKardex ? (
            <TableSkeleton rows={6} columns={6} />
          ) : (
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
          )}
        </div>
      )}

      {/* VISTA 2: MAPA VISUAL DE ANAQUELES (SLOTTING 3D / RACK GRID) */}
      {activeSubTab === 'matriz' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Header & KPI Summary */}
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
              gap: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: 800,
                  color: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Layers className="w-5 h-5 text-indigo-600" /> Mapa Visual de Anaqueles & Slotting (Almacén Lince)
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                Vista gráfica interactiva de estantes físicos, niveles de piso, capacidad en tiempo real y paquetes almacenados
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={() => {
                  setNewPositionMode('batch');
                  setIsNewPositionModalOpen(true);
                }}
                className="btn btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  padding: '8px 14px',
                  borderRadius: '8px'
                }}
              >
                <Plus className="w-4 h-4" /> + Crear Nuevo Anaquel (Lote)
              </button>
            </div>
          </div>

          {/* Barra de Filtros y Búsqueda en el Mapa */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '12px 16px',
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              alignItems: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.03)'
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
                placeholder="Buscar por Anaquel (A1, A2...), Piso (P1, P2) o Guía WR..."
                value={shelfSearchTerm}
                onChange={e => setShelfSearchTerm(e.target.value)}
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
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#475569' }}>Zona:</span>
              <select
                value={shelfZoneFilter}
                onChange={e => setShelfZoneFilter(e.target.value)}
                style={{
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  background: '#ffffff',
                  fontWeight: 600
                }}
              >
                <option value="ALL">Todas las Zonas</option>
                <option value="ALMACENAJE">📦 Almacenaje</option>
                <option value="RECEPCION">📥 Recepción (REC)</option>
                <option value="DESPACHO">🚚 Despacho (DSP)</option>
                <option value="DEVOLUCION">⚠️ Devoluciones</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 800, color: '#475569' }}>Ocupación:</span>
              <select
                value={shelfOccupancyFilter}
                onChange={e => setShelfOccupancyFilter(e.target.value)}
                style={{
                  padding: '5px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  background: '#ffffff',
                  fontWeight: 600
                }}
              >
                <option value="ALL">Todos los Estados</option>
                <option value="DISPONIBLE">🟢 Disponible (&lt; 70%)</option>
                <option value="CASI_LLENO">🟡 Casi Lleno (70% - 90%)</option>
                <option value="LLENO">🔴 Lleno (&gt; 90%)</option>
              </select>
            </div>

            {(shelfSearchTerm || shelfZoneFilter !== 'ALL' || shelfOccupancyFilter !== 'ALL') && (
              <button
                onClick={() => {
                  setShelfSearchTerm('');
                  setShelfZoneFilter('ALL');
                  setShelfOccupancyFilter('ALL');
                }}
                style={{
                  background: '#fee2e2',
                  border: '1px solid #fca5a5',
                  color: '#dc2626',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                ✕ Limpiar Filtros
              </button>
            )}
          </div>

          {/* Grilla Visual de Estanterías Físicas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '18px' }}>
            {Object.entries(shelfGroups)
              .filter(([shelfCode, positions]) => {
                if (shelfSearchTerm) {
                  const term = shelfSearchTerm.toLowerCase();
                  const matchesCode = shelfCode.toLowerCase().includes(term);
                  const matchesPos = positions.some(p => p.codigoPosicion.toLowerCase().includes(term));
                  const matchesPkg = paquetes.some(
                    p =>
                      (p.posicionEstante && p.posicionEstante.startsWith(shelfCode) && p.numeroReciboBodega.toLowerCase().includes(term))
                  );
                  if (!matchesCode && !matchesPos && !matchesPkg) return false;
                }
                if (shelfZoneFilter !== 'ALL') {
                  const hasZone = positions.some(p => p.zonaTipo === shelfZoneFilter);
                  if (!hasZone) return false;
                }
                return true;
              })
              .map(([shelfCode, positions]) => {
                const totalInShelf = paquetes.filter(
                  p =>
                    p.anaquel === shelfCode ||
                    (p.posicionEstante && p.posicionEstante.startsWith(shelfCode))
                ).length;

                const totalWeightInShelf = paquetes
                  .filter(
                    p =>
                      p.anaquel === shelfCode ||
                      (p.posicionEstante && p.posicionEstante.startsWith(shelfCode))
                  )
                  .reduce((sum, p) => sum + (Number(p.pesoKg) || 0), 0);

                const isSpecialZone = shelfCode === 'REC' || shelfCode === 'DSP';
                const borderColor =
                  shelfCode === 'A1'
                    ? '#3b82f6'
                    : shelfCode === 'A2'
                    ? '#10b981'
                    : shelfCode === 'A3'
                    ? '#8b5cf6'
                    : isSpecialZone
                    ? '#f59e0b'
                    : '#0284c7';

                return (
                  <div
                    key={shelfCode}
                    style={{
                      background: '#ffffff',
                      border: `2px solid ${borderColor}`,
                      borderRadius: '14px',
                      overflow: 'hidden',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                      display: 'flex',
                      flexDirection: 'column'
                    }}
                  >
                    {/* Cabecera del Anaquel */}
                    <div
                      style={{
                        background: isSpecialZone ? '#fffbeb' : '#f8fafc',
                        padding: '12px 16px',
                        borderBottom: '1px solid #e2e8f0',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '8px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            background: borderColor,
                            color: '#ffffff',
                            fontWeight: 900,
                            fontSize: '13px',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontFamily: 'monospace'
                          }}
                        >
                          {shelfCode}
                        </span>
                        <div>
                          <span style={{ fontSize: '13.5px', fontWeight: 800, color: '#0f172a' }}>
                            {isSpecialZone
                              ? shelfCode === 'REC'
                                ? 'Mesa de Recepción & Ingreso'
                                : 'Zona de Despacho & Salida'
                              : `Anaquel ${shelfCode}`}
                          </span>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {positions.length} niveles configurados • {totalWeightInShelf.toFixed(1)} kg totales
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 800,
                            background: '#eff6ff',
                            color: '#1d4ed8',
                            padding: '3px 8px',
                            borderRadius: '6px'
                          }}
                        >
                          {totalInShelf} bultos
                        </span>

                        <button
                          title={`Filtrar existencias del Anaquel ${shelfCode}`}
                          onClick={() => {
                            setShelfFilter(shelfCode);
                            setActiveSubTab('existencias');
                          }}
                          style={{
                            background: '#ffffff',
                            border: '1px solid #cbd5e1',
                            padding: '3px 6px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            color: '#334155'
                          }}
                        >
                          🔍 Filtrar
                        </button>
                      </div>
                    </div>

                    {/* Niveles / Pisos del Anaquel */}
                    <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
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

                        const barColor =
                          percent > 85 ? '#ef4444' : percent > 60 ? '#f59e0b' : '#10b981';

                        return (
                          <div
                            key={posItem.id}
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '10px',
                              padding: '10px 12px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px'
                            }}
                          >
                            {/* Cabecera del Piso */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span
                                  style={{
                                    fontFamily: 'monospace',
                                    fontWeight: 900,
                                    fontSize: '11.5px',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: '#eff6ff',
                                    color: '#1d4ed8',
                                    border: '1px solid #bfdbfe'
                                  }}
                                >
                                  {posCode}
                                </span>
                                <span style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                                  {isSpecialZone ? posItem.descripcion || posCode : floorLabel}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <button
                                  title="Editar capacidad / peso de este piso"
                                  onClick={() => setEditingPosition(posItem)}
                                  style={{
                                    background: '#ffffff',
                                    border: '1px solid #cbd5e1',
                                    width: '24px',
                                    height: '24px',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: '#475569'
                                  }}
                                >
                                  <Edit3 className="w-3 h-3" />
                                </button>

                                <span
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 800,
                                    color: barColor
                                  }}
                                >
                                  {pkgsInFloor.length} / {maxCap} ({percent}%)
                                </span>
                              </div>
                            </div>

                            {/* Barra de Ocupación Visual */}
                            <div
                              style={{
                                height: '7px',
                                background: '#e2e8f0',
                                borderRadius: '999px',
                                overflow: 'hidden'
                              }}
                            >
                              <div
                                style={{
                                  width: `${percent}%`,
                                  height: '100%',
                                  background: barColor,
                                  borderRadius: '999px',
                                  transition: 'width 0.3s ease'
                                }}
                              />
                            </div>

                            {/* Chips de Paquetes en el Piso */}
                            {pkgsInFloor.length > 0 ? (
                              <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                                {pkgsInFloor.slice(0, 5).map(p => (
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
                                      padding: '2px 5px',
                                      borderRadius: '4px',
                                      color: '#1e293b',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    📦 {p.numeroReciboBodega}
                                  </span>
                                ))}
                                {pkgsInFloor.length > 5 && (
                                  <span
                                    onClick={() => {
                                      setShelfFilter(shelfCode);
                                      setFloorFilter(posItem.nivelPiso);
                                      setActiveSubTab('existencias');
                                    }}
                                    style={{
                                      fontSize: '10px',
                                      color: '#2563eb',
                                      fontWeight: 800,
                                      alignSelf: 'center',
                                      cursor: 'pointer',
                                      textDecoration: 'underline'
                                    }}
                                  >
                                    +{pkgsInFloor.length - 5} más (Ver todos)
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div style={{ fontSize: '10.5px', color: '#94a3b8', fontStyle: 'italic' }}>
                                Piso vacío • Listo para almacenar carga
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

      {/* VISTA 3: CONFIGURAR ANAQUELES & CAPACIDADES WMS */}
      {activeSubTab === 'gestor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Header & KPI Cards */}
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
              gap: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
            }}
          >
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: '16px',
                  fontWeight: 800,
                  color: '#0f172a',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Settings className="w-5 h-5 text-indigo-600" /> Configuración de Anaqueles, Pisos y Parámetros WMS
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#64748b' }}>
                Administra los anaqueles físicos, niveles de piso, límites de peso y zonas de operación en el Almacén Central Lince
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  setNewPositionMode('batch');
                  setIsNewPositionModalOpen(true);
                }}
                className="btn btn-primary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12.5px',
                  fontWeight: 800,
                  padding: '8px 14px',
                  borderRadius: '8px'
                }}
              >
                <Plus className="w-4 h-4" /> + Crear Anaquel en Lote
              </button>

              <button
                onClick={() => {
                  setNewPositionMode('single');
                  setIsNewPositionModalOpen(true);
                }}
                className="btn"
                style={{
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  padding: '8px 14px',
                  borderRadius: '8px'
                }}
              >
                <Plus className="w-4 h-4" /> + Posición Individual
              </button>
            </div>
          </div>

          {/* Tabla de Configuración de Posiciones */}
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
                    <th style={{ padding: '10px 14px' }}>Código Posición</th>
                    <th style={{ padding: '10px 14px' }}>Anaquel</th>
                    <th style={{ padding: '10px 14px' }}>Nivel / Piso</th>
                    <th style={{ padding: '10px 14px' }}>Tipo de Zona</th>
                    <th style={{ padding: '10px 14px' }}>Ocupación / Capacidad</th>
                    <th style={{ padding: '10px 14px' }}>Límite Peso (Kg)</th>
                    <th style={{ padding: '10px 14px' }}>Descripción / Ubicación</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {posicionesList.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8' }}>
                        <Settings style={{ width: '40px', height: '40px', margin: '0 auto 8px auto', color: '#cbd5e1' }} />
                        <div style={{ fontWeight: 800, color: '#64748b' }}>No hay posiciones de estantería configuradas</div>
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px' }}>Haz clic en "+ Crear Anaquel en Lote" para comenzar.</p>
                      </td>
                    </tr>
                  ) : (
                    posicionesList.map(pos => {
                      const countInPos = paquetes.filter(
                        p =>
                          p.posicionEstante === pos.codigoPosicion ||
                          (p.anaquel === pos.codigoEstante && p.piso === pos.nivelPiso)
                      ).length;
                      const maxCap = pos.capacidadMaxPaquetes || 40;
                      const pct = Math.min(Math.round((countInPos / maxCap) * 100), 100);

                      return (
                        <tr key={pos.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '10px 14px' }}>
                            <span
                              style={{
                                fontFamily: 'monospace',
                                fontWeight: 900,
                                fontSize: '13px',
                                color: '#2563eb',
                                background: '#eff6ff',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                border: '1px solid #bfdbfe'
                              }}
                            >
                              {pos.codigoPosicion}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', fontWeight: 800, color: '#0f172a' }}>
                            Anaquel {pos.codigoEstante}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#334155', fontWeight: 700 }}>
                            {pos.nivelPiso}
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 800,
                                padding: '3px 8px',
                                borderRadius: '6px',
                                background:
                                  pos.zonaTipo === 'ALMACENAJE'
                                    ? '#dbeafe'
                                    : pos.zonaTipo === 'RECEPCION'
                                    ? '#fef3c7'
                                    : pos.zonaTipo === 'DESPACHO'
                                    ? '#dcfce7'
                                    : '#fee2e2',
                                color:
                                  pos.zonaTipo === 'ALMACENAJE'
                                    ? '#1e40af'
                                    : pos.zonaTipo === 'RECEPCION'
                                    ? '#92400e'
                                    : pos.zonaTipo === 'DESPACHO'
                                    ? '#166534'
                                    : '#dc2626'
                              }}
                            >
                              {pos.zonaTipo}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div
                                style={{
                                  width: '70px',
                                  height: '6px',
                                  background: '#e2e8f0',
                                  borderRadius: '999px',
                                  overflow: 'hidden'
                                }}
                              >
                                <div
                                  style={{
                                    width: `${pct}%`,
                                    height: '100%',
                                    background: pct > 85 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#10b981'
                                  }}
                                />
                              </div>
                              <span style={{ fontSize: '11.5px', fontWeight: 800, color: '#0f172a' }}>
                                {countInPos} / {maxCap} ({pct}%)
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: '10px 14px', color: '#64748b', fontWeight: 600 }}>
                            {pos.pesoMaxKg} Kg
                          </td>
                          <td style={{ padding: '10px 14px', color: '#64748b' }}>
                            {pos.descripcion || 'Sin descripción'}
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                              <button
                                title="Editar Posición / Capacidad"
                                onClick={() => setEditingPosition(pos)}
                                style={{
                                  background: '#eff6ff',
                                  border: '1px solid #bfdbfe',
                                  color: '#2563eb',
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

                              <button
                                title="Filtrar existencias en este anaquel"
                                onClick={() => {
                                  setShelfFilter(pos.codigoEstante);
                                  setFloorFilter(pos.nivelPiso);
                                  setActiveSubTab('existencias');
                                }}
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
                                <Boxes className="w-3.5 h-3.5" />
                              </button>

                              <button
                                title="Eliminar Posición"
                                onClick={() => handleDeletePosition(pos.id)}
                                style={{
                                  background: '#fee2e2',
                                  border: '1px solid #fca5a5',
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
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
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

              <div className="wms-modal-grid-2">
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

      {/* MODAL DE NUEVA POSICIÓN / CREAR ANAQUEL WMS */}
      {isNewPositionModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '540px', maxHeight: '92vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus className="w-5 h-5 text-blue-600" /> Crear & Configurar Anaquel WMS
              </span>
              <button
                onClick={() => setIsNewPositionModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            {/* Selector de Modo: Lote vs Individual */}
            <div style={{ padding: '12px 20px 0 20px', display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setNewPositionMode('batch')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '8px',
                  border: newPositionMode === 'batch' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  background: newPositionMode === 'batch' ? '#eff6ff' : '#ffffff',
                  color: newPositionMode === 'batch' ? '#1d4ed8' : '#64748b',
                  fontWeight: 800,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                ⚡ Anaquel Completo (Lote)
              </button>

              <button
                type="button"
                onClick={() => setNewPositionMode('single')}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '8px',
                  border: newPositionMode === 'single' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  background: newPositionMode === 'single' ? '#eff6ff' : '#ffffff',
                  color: newPositionMode === 'single' ? '#1d4ed8' : '#64748b',
                  fontWeight: 800,
                  fontSize: '12px',
                  cursor: 'pointer'
                }}
              >
                🛠️ Posición Individual
              </button>
            </div>

            {/* MODO 1: CREAR EN LOTE */}
            {newPositionMode === 'batch' ? (
              <form onSubmit={handleCreateBatchShelf} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '16px 20px' }}>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#166534' }}>
                  💡 <b>Creación Rápida:</b> Genera automáticamente todos los pisos (P1, P2, P3...) con sus límites de capacidad para el nuevo anaquel en un solo paso.
                </div>

                <div className="wms-modal-grid-2">
                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Código de Anaquel</label>
                    <input
                      type="text"
                      placeholder="Ej: A3, B1, C2"
                      value={batchShelfData.codigoEstante}
                      onChange={e => setBatchShelfData({ ...batchShelfData, codigoEstante: e.target.value.toUpperCase() })}
                      className="form-control"
                      style={{ fontWeight: 800, fontFamily: 'monospace' }}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Cantidad de Pisos / Niveles</label>
                    <select
                      value={batchShelfData.cantidadPisos}
                      onChange={e => setBatchShelfData({ ...batchShelfData, cantidadPisos: Number(e.target.value) })}
                      className="form-control"
                      style={{ fontWeight: 700 }}
                    >
                      <option value={1}>1 Nivel (Solo P1)</option>
                      <option value={2}>2 Niveles (P1, P2)</option>
                      <option value={3}>3 Niveles (P1, P2, P3)</option>
                      <option value={4}>4 Niveles (P1, P2, P3, P4)</option>
                      <option value={5}>5 Niveles (P1 a P5)</option>
                    </select>
                  </div>
                </div>

                <div className="wms-modal-grid-2">
                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Capacidad por Piso (Bultos)</label>
                    <input
                      type="number"
                      value={batchShelfData.capacidadPorPiso}
                      onChange={e => setBatchShelfData({ ...batchShelfData, capacidadPorPiso: Number(e.target.value) })}
                      className="form-control"
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Peso Máx. por Piso (Kg)</label>
                    <input
                      type="number"
                      value={batchShelfData.pesoPorPiso}
                      onChange={e => setBatchShelfData({ ...batchShelfData, pesoPorPiso: Number(e.target.value) })}
                      className="form-control"
                      required
                    />
                  </div>
                </div>

                <div className="wms-modal-grid-2">
                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Tipo de Zona</label>
                    <select
                      value={batchShelfData.zonaTipo}
                      onChange={e => setBatchShelfData({ ...batchShelfData, zonaTipo: e.target.value })}
                      className="form-control"
                    >
                      <option value="ALMACENAJE">📦 Almacenaje Normal</option>
                      <option value="RECEPCION">📥 Zona de Recepción</option>
                      <option value="DESPACHO">🚚 Zona de Despacho</option>
                      <option value="DEVOLUCION">⚠️ Devoluciones / Rechazos</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Sede Almacén</label>
                    <select
                      value={batchShelfData.almacenCodigo}
                      onChange={e => setBatchShelfData({ ...batchShelfData, almacenCodigo: e.target.value })}
                      className="form-control"
                    >
                      <option value="LIN">Sede Central Lince (Lima)</option>
                      <option value="MIA">Miami Hub (USA)</option>
                      <option value="TGO">Tingo María</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Descripción / Referencia Física</label>
                  <input
                    type="text"
                    placeholder="Ej: Pasillo central lado izquierdo"
                    value={batchShelfData.descripcion}
                    onChange={e => setBatchShelfData({ ...batchShelfData, descripcion: e.target.value })}
                    className="form-control"
                  />
                </div>

                {/* Vista Previa de Posiciones a Generar */}
                {batchShelfData.codigoEstante && (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '6px' }}>
                      Vista Previa de Códigos a Generar:
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {Array.from({ length: batchShelfData.cantidadPisos }).map((_, idx) => (
                        <span
                          key={idx}
                          style={{
                            background: '#eff6ff',
                            border: '1px solid #bfdbfe',
                            color: '#1d4ed8',
                            fontFamily: 'monospace',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '11.5px'
                          }}
                        >
                          📍 {batchShelfData.codigoEstante}-P{idx + 1}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setIsNewPositionModalOpen(false)}
                    className="btn btn-secondary"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ fontWeight: 800 }}>
                    ✓ Crear Anaquel ({batchShelfData.cantidadPisos} Pisos)
                  </button>
                </div>
              </form>
            ) : (
              /* MODO 2: CREAR POSICIÓN INDIVIDUAL */
              <form onSubmit={handleCreatePosition} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px 20px' }}>
                <div className="wms-modal-grid-2">
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
                      onChange={e => setNewPositionData({ ...newPositionData, codigoEstante: e.target.value.toUpperCase() })}
                      className="form-control"
                      required
                    />
                  </div>
                </div>

                <div className="wms-modal-grid-2">
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
                      <option value="P5">P5 (Altillo)</option>
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

                <div className="wms-modal-grid-2">
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

                <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setIsNewPositionModalOpen(false)}
                    className="btn btn-secondary"
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ fontWeight: 800 }}>
                    ✓ Guardar Posición
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE EDICIÓN DE POSICIÓN / CAPACIDAD */}
      {editingPosition && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2563eb' }}>
                <Edit3 className="w-5 h-5" /> Configurar Posición: {editingPosition.codigoPosicion}
              </span>
              <button
                onClick={() => setEditingPosition(null)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdatePosition} className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="wms-modal-grid-2">
                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Anaquel</label>
                  <input
                    type="text"
                    value={editingPosition.codigoEstante}
                    disabled
                    className="form-control"
                    style={{ background: '#f1f5f9', fontWeight: 800 }}
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Nivel / Piso</label>
                  <input
                    type="text"
                    value={editingPosition.nivelPiso}
                    disabled
                    className="form-control"
                    style={{ background: '#f1f5f9', fontWeight: 800 }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Tipo de Zona</label>
                <select
                  value={editingPosition.zonaTipo}
                  onChange={e => setEditingPosition({ ...editingPosition, zonaTipo: e.target.value })}
                  className="form-control"
                >
                  <option value="ALMACENAJE">📦 Almacenaje</option>
                  <option value="RECEPCION">📥 Recepción (REC)</option>
                  <option value="DESPACHO">🚚 Despacho (DSP)</option>
                  <option value="DEVOLUCION">⚠️ Devoluciones</option>
                </select>
              </div>

              <div className="wms-modal-grid-2">
                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Capacidad Máx. (Paquetes)</label>
                  <input
                    type="number"
                    value={editingPosition.capacidadMaxPaquetes}
                    onChange={e => setEditingPosition({ ...editingPosition, capacidadMaxPaquetes: Number(e.target.value) })}
                    className="form-control"
                    required
                  />
                </div>

                <div className="form-group">
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Peso Máx. (Kg)</label>
                  <input
                    type="number"
                    value={editingPosition.pesoMaxKg}
                    onChange={e => setEditingPosition({ ...editingPosition, pesoMaxKg: Number(e.target.value) })}
                    className="form-control"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Descripción / Referencia</label>
                <input
                  type="text"
                  value={editingPosition.descripcion || ''}
                  onChange={e => setEditingPosition({ ...editingPosition, descripcion: e.target.value })}
                  className="form-control"
                />
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setEditingPosition(null)}
                  className="btn btn-secondary"
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
              <div className="wms-modal-grid-2">
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

              <div className="wms-modal-grid-3">
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

              <div className="wms-modal-grid-2">
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

      {/* MODAL DE RÓTULO TÉRMICO */}
      {selectedThermalPkg && (
        <ThermalLabelModal
          pkg={selectedThermalPkg}
          onClose={() => setSelectedThermalPkg(null)}
        />
      )}

      {/* MODAL DE CAMBIO DE ESTADO MASIVO EN LOTE */}
      {isBatchStatusModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2563eb' }}>
                <Truck className="w-5 h-5" /> Cambiar Estado Masivo ({selectedIds.length} paquetes)
              </span>
              <button
                onClick={() => setIsBatchStatusModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#64748b' }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '12.5px', color: '#475569', margin: 0 }}>
                Selecciona el nuevo estado para los <strong>{selectedIds.length}</strong> paquetes seleccionados:
              </p>
              <div className="form-group">
                <label style={{ fontSize: '12px', fontWeight: 800, color: '#334155' }}>Nuevo Estado</label>
                <select
                  value={batchTargetStatus}
                  onChange={e => setBatchTargetStatus(e.target.value as TipoEstadoEntrega)}
                  className="form-control"
                  style={{ fontWeight: 700 }}
                >
                  <option value="EnAlmacen">📦 En Almacén (Custodia Lince)</option>
                  <option value="EnRutaCarroAmex">🚚 En Ruta Carro Amex (Despacho Domicilio)</option>
                  <option value="ListoParaRecojo">🏪 Listo para Recojo en Tienda Lince</option>
                  <option value="Entregado">✅ Entregado / Despachado</option>
                </select>
              </div>
              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setIsBatchStatusModalOpen(false)} className="btn btn-secondary">
                  Cancelar
                </button>
                <button type="button" onClick={handleBatchStatusChange} className="btn btn-primary" style={{ fontWeight: 800 }}>
                  ✓ Aplicar a {selectedIds.length} paquetes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. MODAL POP-UP: GESTOR Y CONFIGURACIÓN DE ANAQUELES WMS                 */}
      {/* ========================================================================= */}
      {isGestorModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '980px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#1e40af', fontSize: '16px', fontWeight: 800 }}>
                <Settings className="w-5 h-5" /> Gestor Dinámico de Anaqueles y Parámetros WMS
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={() => setIsNewPositionModalOpen(true)}
                  className="btn btn-primary"
                  style={{ fontSize: '12px', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800 }}
                >
                  <Plus className="w-4 h-4" /> + Nueva Posición
                </button>
                <button
                  onClick={() => setIsGestorModalOpen(false)}
                  style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', maxHeight: 'calc(90vh - 130px)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ margin: 0, fontSize: '12.5px', color: '#64748b' }}>
                  Administra los anaqueles físicos, niveles de piso, límites de peso y zonas de operación en el Almacén Central Lince
                </p>
                <span style={{ fontSize: '11.5px', fontWeight: 800, background: '#eff6ff', color: '#1d4ed8', padding: '4px 10px', borderRadius: '6px' }}>
                  {posicionesList.length} posiciones configuradas
                </span>
              </div>

              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569', fontWeight: 800 }}>
                      <th style={{ padding: '10px 14px' }}>Código Posición</th>
                      <th style={{ padding: '10px 14px' }}>Anaquel</th>
                      <th style={{ padding: '10px 14px' }}>Nivel / Piso</th>
                      <th style={{ padding: '10px 14px' }}>Tipo de Zona</th>
                      <th style={{ padding: '10px 14px' }}>Ocupación / Capacidad</th>
                      <th style={{ padding: '10px 14px' }}>Límite Peso (Kg)</th>
                      <th style={{ padding: '10px 14px' }}>Descripción</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center' }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {posicionesList.map(pos => {
                      const countInPos = paquetes.filter(p => p.posicionEstante === pos.codigoPosicion || (p.anaquel === pos.codigoEstante && p.piso === pos.nivelPiso)).length;
                      const maxCap = pos.capacidadMaxPaquetes || 40;
                      const pct = Math.min(Math.round((countInPos / maxCap) * 100), 100);

                      return (
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
                                    ? '#eff6ff'
                                    : pos.zonaTipo === 'RECEPCION'
                                    ? '#fef3c7'
                                    : '#f0fdf4',
                                color:
                                  pos.zonaTipo === 'ALMACENAJE'
                                    ? '#1e40af'
                                    : pos.zonaTipo === 'RECEPCION'
                                    ? '#b45309'
                                    : '#166534'
                              }}
                            >
                              {pos.zonaTipo}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ flex: 1, minWidth: '60px', height: '6px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                                <div style={{ width: `${pct}%`, height: '100%', background: pct > 85 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#22c55e' }} />
                              </div>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#334155' }}>
                                {countInPos} / {maxCap} ({pct}%)
                              </span>
                            </div>
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 20px', borderTop: '1px solid #e2e8f0' }}>
              <button className="btn btn-secondary" onClick={() => setIsGestorModalOpen(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. MODAL POP-UP: MATRIZ VISUAL 3D SLOTTING DE ANAQUELES                  */}
      {/* ========================================================================= */}
      {isMatrizModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '1050px', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#4338ca', fontSize: '16px', fontWeight: 800 }}>
                <Layers className="w-5 h-5" /> Mapa Físico & Distribución de Anaqueles (Slotting WMS Lince)
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={() => setIsNewPositionModalOpen(true)}
                  className="btn btn-primary"
                  style={{ fontSize: '12px', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 800 }}
                >
                  <Plus className="w-4 h-4" /> + Agregar Anaquel / Nivel
                </button>
                <button
                  onClick={() => setIsMatrizModalOpen(false)}
                  style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', maxHeight: 'calc(92vh - 130px)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
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
                                      onClick={() => {
                                        setIsMatrizModalOpen(false);
                                        openTransferModal(p);
                                      }}
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
                                      onClick={() => {
                                        setIsMatrizModalOpen(false);
                                        setInspectingPosition(posCode);
                                      }}
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

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 20px', borderTop: '1px solid #e2e8f0' }}>
              <button className="btn btn-secondary" onClick={() => setIsMatrizModalOpen(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. MODAL POP-UP: KARDEX DE MOVIMIENTOS Y TRAZABILIDAD                    */}
      {/* ========================================================================= */}
      {isKardexModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '1080px', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #e2e8f0' }}>
              <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0f766e', fontSize: '16px', fontWeight: 800 }}>
                <Clock className="w-5 h-5" /> Bitácora Kardex de Movimientos y Auditoría en Vivo
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={handleExportKardexExcel}
                  className="btn"
                  style={{ fontSize: '12px', padding: '4px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" /> Exportar (.xlsx)
                </button>
                <button
                  onClick={fetchData}
                  className="btn"
                  style={{ fontSize: '12px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingKardex ? 'animate-spin' : ''}`} /> Refrescar
                </button>
                <button
                  onClick={() => setIsKardexModalOpen(false)}
                  style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', maxHeight: 'calc(92vh - 130px)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: '1 1 260px' }}>
                  <Search style={{ position: 'absolute', left: '10px', top: '9px', width: '15px', height: '15px', color: '#94a3b8' }} />
                  <input
                    type="text"
                    placeholder="Buscar por Guía, Consignatario, Origen, Destino u Operador..."
                    value={kardexSearch}
                    onChange={e => setKardexSearch(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px 6px 32px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12.5px' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 800, color: '#475569' }}>Tipo:</span>
                  <select
                    value={kardexTypeFilter}
                    onChange={e => setKardexTypeFilter(e.target.value)}
                    style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '12px' }}
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

              {isLoadingKardex ? (
                <TableSkeleton rows={6} columns={6} />
              ) : (
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
                                <span style={{ color: '#166534', fontWeight: 700 }}>{mov.destinoDescripcion}</span>
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
              )}
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 20px', borderTop: '1px solid #e2e8f0' }}>
              <button className="btn btn-secondary" onClick={() => setIsKardexModalOpen(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
