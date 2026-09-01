'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PackageCheck,
  Search,
  Camera,
  UploadCloud,
  CheckCircle2,
  Clock,
  User,
  ShieldCheck,
  FileSpreadsheet,
  Printer,
  Eye,
  Plus,
  ArrowRight,
  MapPin,
  Phone,
  Layers,
  X,
  AlertTriangle,
  RotateCcw,
  Check,
  Store,
  FileText,
  ExternalLink,
  ChevronRight,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  Sparkles,
  Edit3,
  Barcode,
  Save,
  Users,
  Truck,
  Filter,
  Boxes
} from 'lucide-react';
import { Paquete, Cliente } from '@/types';
import { supabase } from '@/lib/supabase/client';
import { exportEntregasToExcel } from '@/lib/excelExport';
import { matchesFuzzySearch } from '@/lib/fuzzySearch';
import { getR2ViewUrl } from '@/lib/r2/client';
import PhotoViewerModal from '@/components/modals/PhotoViewerModal';
import { soundEffects } from '@/lib/audio/soundEffects';

export interface OrdenEntrega {
  id: string;
  codigo_entrega: string;
  tipo_entrega: string;
  cliente_nombre: string;
  cliente_casillero?: string;
  cliente_documento?: string;
  receptor_nombre?: string;
  receptor_documento?: string;
  receptor_parentesco?: string;
  operador_asignado: string;
  estado: 'PENDIENTE_BUSQUEDA' | 'EN_BUSQUEDA' | 'LISTO_ENTREGA' | 'ENTREGADO';
  total_paquetes: number;
  paquetes_data: Array<{
    id?: string;
    numeroReciboBodega: string;
    descripcion?: string;
    pesoKg?: number;
    posicionEstante?: string;
    encontrado?: boolean;
  }>;
  fotos_evidencia: Array<{
    url: string;
    key?: string;
    fileName?: string;
    fecha?: string;
  }>;
  notas?: string;
  creado_por: string;
  creado_en: string;
  entregado_en?: string;
}

interface EntregasTabProps {
  paquetes: Paquete[];
  clientes: Cliente[];
  onUpdatePackage?: (pkg: Paquete) => void;
  onViewPdf?: (url: string) => void;
  openOrden?: OrdenEntrega | null;
}

export default function EntregasTab({
  paquetes = [],
  clientes = [],
  onUpdatePackage,
  onViewPdf,
  openOrden
}: EntregasTabProps) {
  const [subtab, setSubtab] = useState<'activas' | 'nueva' | 'historial'>('activas');
  const [ordenes, setOrdenes] = useState<OrdenEntrega[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Active Picking / Operator Modal
  const [activePickingOrden, setActivePickingOrden] = useState<OrdenEntrega | null>(null);
  const [pickingChecks, setPickingChecks] = useState<Record<string, boolean>>({});
  const [uploadedPhotos, setUploadedPhotos] = useState<Array<{ url: string; key?: string; fileName?: string }>>([]);
  const [scannerInputCode, setScannerInputCode] = useState('');
  const [toastMessage, setToastMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [isSavingAvance, setIsSavingAvance] = useState(false);

  // Recipient Form
  const [receptorForm, setReceptorForm] = useState({
    nombre: '',
    documento: '',
    parentesco: 'Titular'
  });

  // New Order Form State
  const [newOrderForm, setNewOrderForm] = useState({
    tipoEntrega: 'RECOJO_TIENDA_LINCE',
    clienteNombre: '',
    clienteCasillero: '',
    clienteDocumento: '',
    operadorAsignado: 'Carlos Mendoza (Almacén Lince)',
    notas: '',
    wrInput: ''
  });
  const [selectedWrsForNewOrder, setSelectedWrsForNewOrder] = useState<Paquete[]>([]);
  const [wrSearchQuery, setWrSearchQuery] = useState('');

  // 1. Fetch Orders from Supabase
  const fetchOrdenes = useCallback(async () => {
    try {
      setRefreshing(true);
      const { data, error } = await supabase
        .from('entregas_ordenes')
        .select('*')
        .order('creado_en', { ascending: false });

      if (error) {
        console.error('Error fetching entregas_ordenes:', error);
      } else if (data) {
        setOrdenes(data as OrdenEntrega[]);
      }
    } catch (err) {
      console.error('Error in fetchOrdenes:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOrdenes();

    const channel = supabase
      .channel('realtime_entregas_ordenes_tab')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'entregas_ordenes' }, () => {
        fetchOrdenes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchOrdenes]);

  // Open initial order if passed from dashboard
  useEffect(() => {
    if (openOrden) {
      handleOpenPicking(openOrden);
    }
  }, [openOrden]);

  // 2. Metrics
  const metrics = useMemo(() => {
    const total = ordenes.length;
    const pendientes = ordenes.filter(o => o.estado === 'PENDIENTE_BUSQUEDA').length;
    const enBusqueda = ordenes.filter(o => o.estado === 'EN_BUSQUEDA').length;
    const listos = ordenes.filter(o => o.estado === 'LISTO_ENTREGA').length;
    const entregados = ordenes.filter(o => o.estado === 'ENTREGADO').length;
    return { total, pendientes, enBusqueda, listos, entregados };
  }, [ordenes]);

  // 3. Filtered Orders
  const filteredOrdenes = useMemo(() => {
    return ordenes.filter(o => {
      if (subtab === 'activas' && o.estado === 'ENTREGADO') return false;
      if (subtab === 'historial' && o.estado !== 'ENTREGADO') return false;

      if (statusFilter !== 'ALL' && o.estado !== statusFilter) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchCode = o.codigo_entrega.toLowerCase().includes(q);
        const matchClient = o.cliente_nombre.toLowerCase().includes(q);
        const matchCasillero = (o.cliente_casillero || '').toLowerCase().includes(q);
        const matchWrs = Array.isArray(o.paquetes_data) && o.paquetes_data.some(p => p.numeroReciboBodega.toLowerCase().includes(q));
        return matchCode || matchClient || matchCasillero || matchWrs;
      }
      return true;
    });
  }, [ordenes, subtab, statusFilter, searchTerm]);

  // Packages in Lince
  const paquetesDisponibles = useMemo(() => {
    return paquetes.filter(p => {
      const isLince = p.ubicacionActual === 'AmexLince' || p.estadoEntrega === 'EnAlmacen';
      if (!isLince) return false;

      if (wrSearchQuery.trim()) {
        const q = wrSearchQuery.toLowerCase().trim();
        return (
          p.numeroReciboBodega.toLowerCase().includes(q) ||
          p.codigoCasillero.toLowerCase().includes(q) ||
          (p.nombreConsignatario || '').toLowerCase().includes(q) ||
          (p.posicionEstante || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [paquetes, wrSearchQuery]);

  // 4. Create Order Handler
  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedWrsForNewOrder.length === 0 && !newOrderForm.wrInput.trim()) {
      alert('Debes seleccionar al menos 1 paquete WR o escribir códigos.');
      return;
    }

    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSeq = Math.floor(100 + Math.random() * 900);
    const codigoEntrega = `ENT-${todayStr}-${randomSeq}`;

    const paquetesList: OrdenEntrega['paquetes_data'] = [
      ...selectedWrsForNewOrder.map(p => ({
        id: p.id,
        numeroReciboBodega: p.numeroReciboBodega,
        descripcion: p.descripcion,
        pesoKg: p.pesoKg,
        posicionEstante: p.posicionEstante || (p.anaquel && p.piso ? `${p.anaquel}-${p.piso}` : 'REC'),
        encontrado: false
      }))
    ];

    if (newOrderForm.wrInput.trim()) {
      const manualWrs = newOrderForm.wrInput
        .split(/[\n,;]+/)
        .map(w => w.trim().toUpperCase())
        .filter(w => w.length > 0);

      manualWrs.forEach(wr => {
        if (!paquetesList.some(p => p.numeroReciboBodega === wr)) {
          const matchPkg = paquetes.find(p => p.numeroReciboBodega.toUpperCase() === wr);
          paquetesList.push({
            id: matchPkg?.id,
            numeroReciboBodega: wr,
            descripcion: matchPkg?.descripcion || 'Carga mostrador',
            pesoKg: matchPkg?.pesoKg || 1,
            posicionEstante: matchPkg?.posicionEstante || 'REC',
            encontrado: false
          });
        }
      });
    }

    const payload = {
      codigo_entrega: codigoEntrega,
      tipo_entrega: newOrderForm.tipoEntrega,
      cliente_nombre: newOrderForm.clienteNombre || 'Cliente Mostrador',
      cliente_casillero: newOrderForm.clienteCasillero || '',
      cliente_documento: newOrderForm.clienteDocumento || '',
      operador_asignado: newOrderForm.operadorAsignado,
      estado: 'PENDIENTE_BUSQUEDA',
      total_paquetes: paquetesList.length,
      paquetes_data: paquetesList,
      fotos_evidencia: [],
      notas: newOrderForm.notas,
      creado_por: 'Administración AMEX',
      creado_en: new Date().toISOString()
    };

    try {
      const { error } = await supabase.from('entregas_ordenes').insert([payload]);
      if (error) throw error;

      soundEffects.playSuccess();
      setNewOrderForm({
        tipoEntrega: 'RECOJO_TIENDA_LINCE',
        clienteNombre: '',
        clienteCasillero: '',
        clienteDocumento: '',
        operadorAsignado: 'Carlos Mendoza (Almacén Lince)',
        notas: '',
        wrInput: ''
      });
      setSelectedWrsForNewOrder([]);
      setSubtab('activas');
      fetchOrdenes();
    } catch (err: any) {
      console.error('Error creating order:', err);
      alert('Error al crear orden: ' + (err.message || 'Error desconocido'));
    }
  };

  // 5. Open Picking Modal
  const handleOpenPicking = (orden: OrdenEntrega) => {
    setActivePickingOrden(orden);
    const checks: Record<string, boolean> = {};
    if (Array.isArray(orden.paquetes_data)) {
      orden.paquetes_data.forEach(p => {
        checks[p.numeroReciboBodega] = Boolean(p.encontrado);
      });
    }
    setPickingChecks(checks);
    setUploadedPhotos(Array.isArray(orden.fotos_evidencia) ? orden.fotos_evidencia : []);
    setReceptorForm({
      nombre: orden.receptor_nombre || orden.cliente_nombre || '',
      documento: orden.receptor_documento || orden.cliente_documento || '',
      parentesco: orden.receptor_parentesco || 'Titular'
    });
    setScannerInputCode('');
  };

  // 6. Save Advance (Picking)
  const handleSaveAvance = async (overrideChecks?: Record<string, boolean>) => {
    if (!activePickingOrden) return;

    const currentChecks = overrideChecks || pickingChecks;
    const currentPaquetes = Array.isArray(activePickingOrden.paquetes_data) ? activePickingOrden.paquetes_data : [];

    const updatedPaquetesData = currentPaquetes.map(p => ({
      ...p,
      encontrado: Boolean(currentChecks[p.numeroReciboBodega])
    }));

    const foundCount = updatedPaquetesData.filter(p => p.encontrado).length;
    const totalCount = updatedPaquetesData.length;

    let nextStatus: OrdenEntrega['estado'] = activePickingOrden.estado;
    if (activePickingOrden.estado !== 'ENTREGADO') {
      if (foundCount === totalCount && totalCount > 0) {
        nextStatus = 'LISTO_ENTREGA';
      } else if (foundCount > 0) {
        nextStatus = 'EN_BUSQUEDA';
      } else {
        nextStatus = 'PENDIENTE_BUSQUEDA';
      }
    }

    try {
      setIsSavingAvance(true);
      const { error } = await supabase
        .from('entregas_ordenes')
        .update({
          paquetes_data: updatedPaquetesData,
          estado: nextStatus,
          receptor_nombre: receptorForm.nombre,
          receptor_documento: receptorForm.documento,
          receptor_parentesco: receptorForm.parentesco
        })
        .eq('id', activePickingOrden.id);

      if (error) throw error;

      setActivePickingOrden(prev => prev ? {
        ...prev,
        paquetes_data: updatedPaquetesData,
        estado: nextStatus,
        receptor_nombre: receptorForm.nombre,
        receptor_documento: receptorForm.documento,
        receptor_parentesco: receptorForm.parentesco
      } : null);

      fetchOrdenes();
    } catch (err) {
      console.error('Error saving picking progress:', err);
    } finally {
      setIsSavingAvance(false);
    }
  };

  // 7. Toggle WR check
  const handleToggleWrCheck = (wr: string) => {
    const nextState = !pickingChecks[wr];
    const newChecks = { ...pickingChecks, [wr]: nextState };
    setPickingChecks(newChecks);

    if (nextState) {
      soundEffects.playSuccess();
    }
    handleSaveAvance(newChecks);
  };

  // 8. Barcode Gun Scan inside Picking Modal
  const handleScanInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannerInputCode.trim() || !activePickingOrden) return;

    const raw = scannerInputCode.trim().toUpperCase().replace(/\s+/g, '');
    setScannerInputCode('');

    const matchedPkg = (activePickingOrden.paquetes_data || []).find(
      p => p.numeroReciboBodega.toUpperCase() === raw || `WR${p.numeroReciboBodega}`.toUpperCase() === raw
    );

    if (matchedPkg) {
      const isAlreadyChecked = pickingChecks[matchedPkg.numeroReciboBodega];
      if (isAlreadyChecked) {
        soundEffects.playDuplicate();
        setToastMessage({ text: `⚠️ ${matchedPkg.numeroReciboBodega} ya estaba marcado`, isError: false });
      } else {
        const newChecks = { ...pickingChecks, [matchedPkg.numeroReciboBodega]: true };
        setPickingChecks(newChecks);
        soundEffects.playSuccess();
        setToastMessage({ text: `✅ ${matchedPkg.numeroReciboBodega} encontrado en ${matchedPkg.posicionEstante || 'Estante'}`, isError: false });
        handleSaveAvance(newChecks);
      }
    } else {
      soundEffects.playNotFound();
      setToastMessage({ text: `❌ ${raw} no pertenece a esta orden de entrega`, isError: true });
    }
  };

  // 9. Complete Handover
  const handleCompleteDelivery = async () => {
    if (!activePickingOrden) return;

    const allChecked = (activePickingOrden.paquetes_data || []).every(p => pickingChecks[p.numeroReciboBodega]);
    if (!allChecked) {
      if (!confirm('No todos los paquetes están marcados como encontrados. ¿Deseas finalizar la entrega de todos modos?')) {
        return;
      }
    }

    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('entregas_ordenes')
        .update({
          estado: 'ENTREGADO',
          entregado_en: nowIso,
          receptor_nombre: receptorForm.nombre || activePickingOrden.cliente_nombre,
          receptor_documento: receptorForm.documento,
          receptor_parentesco: receptorForm.parentesco,
          fotos_evidencia: uploadedPhotos
        })
        .eq('id', activePickingOrden.id);

      if (error) throw error;

      // Update package status in main packages table
      if (Array.isArray(activePickingOrden.paquetes_data)) {
        for (const p of activePickingOrden.paquetes_data) {
          await supabase
            .from('paquetes')
            .update({ estado_entrega: 'Entregado', ubicacion_actual: 'Entregado' })
            .eq('numero_recibo_bodega', p.numeroReciboBodega);
        }
      }

      soundEffects.playSuccess();
      setActivePickingOrden(null);
      fetchOrdenes();
    } catch (err) {
      console.error('Error completing delivery:', err);
      alert('Error al completar la entrega.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden', background: '#f8fafc' }}>
      {/* ---------------- TOP HEADER BAR ---------------- */}
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
          <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff', boxShadow: '0 4px 10px rgba(245,158,11,0.25)', flexShrink: 0 }}>
            <PackageCheck style={{ width: '20px', height: '20px' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', margin: 0, letterSpacing: '-0.2px' }}>
                Entregas & Búsqueda WR
              </h1>
              <span style={{ padding: '2px 8px', borderRadius: '9999px', fontSize: '10px', fontWeight: 900, background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a' }}>
                Mostrador Lince
              </span>
            </div>
            <p style={{ fontSize: '11.5px', color: '#64748b', margin: '2px 0 0 0' }}>
              Gestión de listas de recojo, picking en anaqueles y entrega física
            </p>
          </div>
        </div>

        {/* Subtab Navigation Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#f1f5f9', padding: '4px', borderRadius: '10px' }}>
            <button
              type="button"
              onClick={() => setSubtab('activas')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: subtab === 'activas' ? '#ffffff' : 'transparent',
                color: subtab === 'activas' ? '#0f172a' : '#64748b',
                boxShadow: subtab === 'activas' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              <Clock style={{ width: '14px', height: '14px', color: '#d97706' }} />
              <span>Búsquedas Activas ({metrics.pendientes + metrics.enBusqueda + metrics.listos})</span>
            </button>

            <button
              type="button"
              onClick={() => setSubtab('nueva')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: subtab === 'nueva' ? '#2563eb' : 'transparent',
                color: subtab === 'nueva' ? '#ffffff' : '#2563eb',
                boxShadow: subtab === 'nueva' ? '0 2px 6px rgba(37,99,235,0.25)' : 'none'
              }}
            >
              <Plus style={{ width: '14px', height: '14px' }} />
              <span>+ Crear Orden</span>
            </button>

            <button
              type="button"
              onClick={() => setSubtab('historial')}
              style={{
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 800,
                border: 'none',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: subtab === 'historial' ? '#ffffff' : 'transparent',
                color: subtab === 'historial' ? '#0f172a' : '#64748b',
                boxShadow: subtab === 'historial' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              <CheckCircle2 style={{ width: '14px', height: '14px', color: '#059669' }} />
              <span>Historial ({metrics.entregados})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={fetchOrdenes}
            style={{ background: '#ffffff', border: '1px solid #cbd5e1', padding: '8px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Refrescar"
          >
            <RefreshCw className={refreshing ? 'animate-spin' : ''} style={{ width: '15px', height: '15px', color: '#2563eb' }} />
          </button>
        </div>
      </div>

      {/* ---------------- SUBTAB 1 & 3: ÓRDENES ACTIVAS / HISTORIAL ---------------- */}
      {(subtab === 'activas' || subtab === 'historial') && (
        <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, gap: '12px', overflow: 'hidden' }}>
          {/* Search and Status Filters */}
          <div
            style={{
              background: '#ffffff',
              padding: '10px 14px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              flexShrink: 0
            }}
          >
            <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '400px' }}>
              <Search style={{ width: '14px', height: '14px', color: '#94a3b8', position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar por código ENT-, WR, cliente o casillero..."
                style={{ width: '100%', paddingLeft: '32px', paddingRight: '10px', paddingTop: '6px', paddingBottom: '6px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '11.5px', outline: 'none' }}
              />
            </div>

            {subtab === 'activas' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Filter style={{ width: '14px', height: '14px', color: '#64748b' }} />
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#64748b' }}>Estado:</span>
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  style={{ padding: '4px 8px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, outline: 'none' }}
                >
                  <option value="ALL">Todos los Estados</option>
                  <option value="PENDIENTE_BUSQUEDA">⏳ Pendiente Búsqueda</option>
                  <option value="EN_BUSQUEDA">🏃 En Búsqueda</option>
                  <option value="LISTO_ENTREGA">📦 Listo en Mostrador</option>
                </select>
              </div>
            )}
          </div>

          {/* Orders Cards Grid */}
          <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                <RefreshCw className="animate-spin" style={{ width: '32px', height: '32px', color: '#2563eb', margin: '0 auto 8px' }} />
                <p style={{ fontSize: '12px', fontWeight: 700, color: '#475569', margin: 0 }}>Cargando órdenes de entrega...</p>
              </div>
            ) : filteredOrdenes.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center', background: '#ffffff', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                <PackageCheck style={{ width: '44px', height: '44px', color: '#cbd5e1', margin: '0 auto 8px' }} />
                <p style={{ fontSize: '14px', fontWeight: 900, color: '#0f172a', margin: 0 }}>No se encontraron órdenes</p>
                <p style={{ fontSize: '11.5px', color: '#64748b', margin: '4px 0 0 0' }}>
                  {subtab === 'activas' ? 'No hay órdenes de búsqueda activas en mostrador.' : 'Aún no se registran entregas completadas.'}
                </p>
                {subtab === 'activas' && (
                  <button
                    type="button"
                    onClick={() => setSubtab('nueva')}
                    style={{ marginTop: '12px', padding: '8px 16px', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Plus style={{ width: '14px', height: '14px' }} />
                    <span>Crear Nueva Orden de Búsqueda</span>
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
                {filteredOrdenes.map(orden => {
                  const totalWrs = Array.isArray(orden.paquetes_data) ? orden.paquetes_data.length : 0;
                  const foundWrs = Array.isArray(orden.paquetes_data) ? orden.paquetes_data.filter(p => p.encontrado).length : 0;
                  const progressPct = totalWrs > 0 ? Math.round((foundWrs / totalWrs) * 100) : 0;
                  const isDelivered = orden.estado === 'ENTREGADO';
                  const isReady = orden.estado === 'LISTO_ENTREGA';

                  return (
                    <div
                      key={orden.id}
                      style={{
                        background: '#ffffff',
                        border: isDelivered ? '1px solid #a7f3d0' : isReady ? '1.5px solid #10b981' : '1px solid #e2e8f0',
                        borderRadius: '12px',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                        gap: '10px'
                      }}
                    >
                      <div>
                        {/* Header card */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '12px', color: '#2563eb' }}>
                              {orden.codigo_entrega}
                            </span>
                            {orden.cliente_casillero && (
                              <span style={{ padding: '1px 5px', borderRadius: '4px', fontSize: '10px', fontFamily: 'monospace', fontWeight: 800, background: '#f1f5f9', color: '#334155' }}>
                                {orden.cliente_casillero}
                              </span>
                            )}
                          </div>

                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '9999px',
                              fontSize: '10px',
                              fontWeight: 900,
                              textTransform: 'uppercase',
                              background: isDelivered ? '#ecfdf5' : isReady ? '#10b981' : orden.estado === 'EN_BUSQUEDA' ? '#eff6ff' : '#fef3c7',
                              color: isDelivered ? '#047857' : isReady ? '#ffffff' : orden.estado === 'EN_BUSQUEDA' ? '#1e40af' : '#b45309'
                            }}
                          >
                            {isDelivered
                              ? '✓ ENTREGADO'
                              : isReady
                              ? '📦 LISTO EN MOSTRADOR'
                              : orden.estado === 'EN_BUSQUEDA'
                              ? '🔍 EN BÚSQUEDA'
                              : '⏳ PENDIENTE'}
                          </span>
                        </div>

                        <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a', margin: '0 0 6px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {orden.cliente_nombre}
                        </h3>

                        {/* WR Tags Pill Grid */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '72px', overflowY: 'auto' }}>
                          {Array.isArray(orden.paquetes_data) &&
                            orden.paquetes_data.map((p, i) => (
                              <span
                                key={i}
                                style={{
                                  padding: '2px 6px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontFamily: 'monospace',
                                  fontWeight: 800,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  background: p.encontrado ? '#ecfdf5' : '#f8fafc',
                                  color: p.encontrado ? '#047857' : '#334155',
                                  border: p.encontrado ? '1px solid #a7f3d0' : '1px solid #e2e8f0'
                                }}
                              >
                                {p.encontrado ? '✓ ' : ''}
                                {p.numeroReciboBodega}
                                <span style={{ opacity: 0.7, fontFamily: 'sans-serif', fontSize: '10px' }}>({p.posicionEstante || 'REC'})</span>
                              </span>
                            ))}
                        </div>

                        {/* Progress Bar */}
                        <div style={{ marginTop: '10px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '3px' }}>
                            <span>Bultos encontrados:</span>
                            <span style={{ fontFamily: 'monospace' }}>
                              {foundWrs}/{totalWrs} ({progressPct}%)
                            </span>
                          </div>
                          <div style={{ width: '100%', background: '#f1f5f9', borderRadius: '9999px', height: '6px', overflow: 'hidden' }}>
                            <div
                              style={{
                                height: '100%',
                                background: isDelivered || isReady ? '#10b981' : '#2563eb',
                                width: `${progressPct}%`,
                                transition: 'width 0.3s ease'
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {orden.operador_asignado}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleOpenPicking(orden)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '11.5px',
                            fontWeight: 800,
                            borderRadius: '8px',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: isDelivered ? '#f1f5f9' : '#2563eb',
                            color: isDelivered ? '#334155' : '#ffffff'
                          }}
                        >
                          <span>{isDelivered ? 'Ver Ficha' : 'Atender Entrega'}</span>
                          <ArrowRight style={{ width: '13px', height: '13px' }} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------- SUBTAB 2: CREAR NUEVA ORDEN ---------------- */}
      {subtab === 'nueva' && (
        <div style={{ padding: '16px', flex: 1, overflowY: 'auto', minHeight: 0, maxWidth: '780px', margin: '0 auto', width: '100%' }}>
          <form onSubmit={handleCreateOrder} style={{ background: '#ffffff', padding: '20px', borderRadius: '14px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Plus style={{ width: '18px', height: '18px' }} />
              </div>
              <div>
                <h2 style={{ fontSize: '15px', fontWeight: 900, color: '#0f172a', margin: 0 }}>Emitir Lista de Búsqueda de WRs para Mostrador</h2>
                <p style={{ fontSize: '11.5px', color: '#64748b', margin: '2px 0 0 0' }}>Selecciona los paquetes del cliente para que el operario los ubique en anaqueles</p>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', color: '#334155', marginBottom: '4px' }}>
                  Nombre del Cliente / Consignatario *
                </label>
                <input
                  type="text"
                  required
                  value={newOrderForm.clienteNombre}
                  onChange={e => setNewOrderForm({ ...newOrderForm, clienteNombre: e.target.value })}
                  placeholder="Ej: Juan Pérez García"
                  style={{ width: '100%', padding: '8px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', outline: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', color: '#334155', marginBottom: '4px' }}>
                  Código de Casillero
                </label>
                <input
                  type="text"
                  value={newOrderForm.clienteCasillero}
                  onChange={e => setNewOrderForm({ ...newOrderForm, clienteCasillero: e.target.value.toUpperCase() })}
                  placeholder="AMEX-PER-1001"
                  style={{ width: '100%', padding: '8px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', fontFamily: 'monospace', fontWeight: 700, outline: 'none', textTransform: 'uppercase' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', color: '#334155', marginBottom: '4px' }}>
                  Operario Asignado en Almacén *
                </label>
                <select
                  value={newOrderForm.operadorAsignado}
                  onChange={e => setNewOrderForm({ ...newOrderForm, operadorAsignado: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', fontWeight: 700, outline: 'none' }}
                >
                  <option value="Carlos Mendoza (Almacén Lince)">Carlos Mendoza (Almacén Lince)</option>
                  <option value="Rosa Quispe (Almacén Central)">Rosa Quispe (Almacén Central)</option>
                  <option value="Operario de Turno (Lince)">Operario de Turno (Lince)</option>
                  <option value="Mostrador Central">Mostrador Central</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', color: '#334155', marginBottom: '4px' }}>
                  Tipo de Entrega
                </label>
                <select
                  value={newOrderForm.tipoEntrega}
                  onChange={e => setNewOrderForm({ ...newOrderForm, tipoEntrega: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', fontWeight: 700, outline: 'none' }}
                >
                  <option value="RECOJO_TIENDA_LINCE">Recojo en Tienda (Sede Central Lince)</option>
                  <option value="AGENCIA_SHALOM">Despacho para Agencia (Shalom / Marvisur)</option>
                  <option value="CARRO_AMEX">Despacho en Carro AMEX a Domicilio</option>
                </select>
              </div>
            </div>

            {/* SELECCIONADOR DE WRS EN TIEMPO REAL */}
            <div style={{ padding: '14px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Boxes style={{ width: '16px', height: '16px', color: '#2563eb' }} />
                  Seleccionar Paquetes en Almacén Lince ({selectedWrsForNewOrder.length} seleccionados)
                </span>

                <div style={{ position: 'relative', width: '220px' }}>
                  <Search style={{ width: '13px', height: '13px', color: '#94a3b8', position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    value={wrSearchQuery}
                    onChange={e => setWrSearchQuery(e.target.value)}
                    placeholder="Filtrar por WR o Casillero..."
                    style={{ width: '100%', paddingLeft: '26px', paddingRight: '8px', paddingTop: '4px', paddingBottom: '4px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11.5px', outline: 'none' }}
                  />
                </div>
              </div>

              {/* Grid de Paquetes en Tarjetas Compactas */}
              <div style={{ maxHeight: '180px', overflowY: 'auto', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '6px' }}>
                {paquetesDisponibles.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', padding: '24px', textAlign: 'center', fontSize: '11.5px', color: '#94a3b8' }}>
                    No hay paquetes en Lince con este criterio.
                  </div>
                ) : (
                  paquetesDisponibles.slice(0, 45).map(pkg => {
                    const isSelected = selectedWrsForNewOrder.some(p => p.id === pkg.id);
                    return (
                      <div
                        key={pkg.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedWrsForNewOrder(selectedWrsForNewOrder.filter(p => p.id !== pkg.id));
                          } else {
                            setSelectedWrsForNewOrder([...selectedWrsForNewOrder, pkg]);
                            if (!newOrderForm.clienteNombre && pkg.nombreConsignatario) {
                              setNewOrderForm(prev => ({
                                ...prev,
                                clienteNombre: pkg.nombreConsignatario || '',
                                clienteCasillero: pkg.codigoCasillero || ''
                              }));
                            }
                          }
                        }}
                        style={{
                          padding: '6px 8px',
                          borderRadius: '8px',
                          border: isSelected ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                          background: isSelected ? '#eff6ff' : '#f8fafc',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '6px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                          <div
                            style={{
                              width: '16px',
                              height: '16px',
                              borderRadius: '4px',
                              border: isSelected ? '1px solid #2563eb' : '1px solid #cbd5e1',
                              background: isSelected ? '#2563eb' : '#ffffff',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                              flexShrink: 0
                            }}
                          >
                            {isSelected && <Check style={{ width: '12px', height: '12px', strokeWidth: 3 }} />}
                          </div>
                          <div style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '11.5px', color: '#0f172a' }}>{pkg.numeroReciboBodega}</span>
                            <span style={{ fontSize: '10.5px', color: '#64748b', marginLeft: '4px' }}>
                              {pkg.nombreConsignatario || pkg.codigoCasillero}
                            </span>
                          </div>
                        </div>

                        <span style={{ padding: '1px 5px', borderRadius: '4px', fontSize: '10px', fontFamily: 'monospace', fontWeight: 800, background: '#faf5ff', color: '#7e22ce', border: '1px solid #f3e8ff', flexShrink: 0 }}>
                          {pkg.posicionEstante || 'A1-P1'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 800, textTransform: 'uppercase', color: '#334155', marginBottom: '4px' }}>
                O escribe códigos WR manuales (separados por coma):
              </label>
              <textarea
                rows={2}
                value={newOrderForm.wrInput}
                onChange={e => setNewOrderForm({ ...newOrderForm, wrInput: e.target.value })}
                placeholder="WR000451, WR000452..."
                style={{ width: '100%', padding: '8px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '11.5px', fontFamily: 'monospace', outline: 'none' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', paddingTop: '10px', borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={() => setSubtab('activas')}
                style={{ padding: '8px 14px', fontSize: '12px', fontWeight: 700, color: '#64748b', background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                style={{ padding: '9px 18px', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 6px rgba(37,99,235,0.25)' }}
              >
                <Check style={{ width: '15px', height: '15px', strokeWidth: 3 }} />
                <span>Generar Lista de Búsqueda ({selectedWrsForNewOrder.length} WRs)</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---------------- MODAL PICKING & ATENCIÓN DE MOSTRADOR ---------------- */}
      {activePickingOrden && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)' }}>
          <div style={{ background: '#ffffff', borderRadius: '14px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)', border: '1px solid #e2e8f0', width: '100%', maxWidth: '620px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ padding: '12px 18px', background: '#0f172a', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #334155', flexShrink: 0 }}>
              <div>
                <span style={{ fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#fbbf24', letterSpacing: '0.5px' }}>
                  Búsqueda & Entrega en Mostrador
                </span>
                <div style={{ fontSize: '15px', fontWeight: 900, fontFamily: 'monospace' }}>
                  {activePickingOrden.codigo_entrega} · {activePickingOrden.cliente_nombre}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActivePickingOrden(null)}
                style={{ color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
              >
                <X style={{ width: '18px', height: '18px' }} />
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
              {/* Toast banner */}
              {toastMessage && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '11.5px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: toastMessage.isError ? '#fef2f2' : '#ecfdf5',
                    color: toastMessage.isError ? '#b91c1c' : '#047857',
                    border: toastMessage.isError ? '1px solid #fecaca' : '1px solid #a7f3d0'
                  }}
                >
                  {toastMessage.isError ? <AlertTriangle style={{ width: '14px', height: '14px' }} /> : <CheckCircle2 style={{ width: '14px', height: '14px' }} />}
                  <span>{toastMessage.text}</span>
                </div>
              )}

              {/* Progress */}
              <div style={{ padding: '10px 12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', fontWeight: 900, color: '#0f172a', marginBottom: '4px' }}>
                  <span>
                    🎯 Bultos: {Object.values(pickingChecks).filter(Boolean).length} de {(activePickingOrden.paquetes_data || []).length} encontrados
                  </span>
                  <span style={{ fontFamily: 'monospace', color: '#2563eb' }}>
                    {Math.round((Object.values(pickingChecks).filter(Boolean).length / ((activePickingOrden.paquetes_data || []).length || 1)) * 100)}%
                  </span>
                </div>
                <div style={{ width: '100%', background: '#e2e8f0', borderRadius: '9999px', height: '6px', overflow: 'hidden' }}>
                  <div
                    style={{
                      background: '#10b981',
                      height: '100%',
                      borderRadius: '9999px',
                      width: `${(Object.values(pickingChecks).filter(Boolean).length / ((activePickingOrden.paquetes_data || []).length || 1)) * 100}%`,
                      transition: 'width 0.2s ease'
                    }}
                  />
                </div>
              </div>

              {/* Barcode Gun Input */}
              <form onSubmit={handleScanInputSubmit} style={{ display: 'flex', gap: '6px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Barcode style={{ width: '14px', height: '14px', color: '#2563eb', position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Pistolea o escribe código WR..."
                    value={scannerInputCode}
                    onChange={e => setScannerInputCode(e.target.value)}
                    style={{ width: '100%', paddingLeft: '32px', paddingRight: '10px', paddingTop: '7px', paddingBottom: '7px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px', fontFamily: 'monospace', fontWeight: 700, outline: 'none' }}
                  />
                </div>
                <button
                  type="submit"
                  style={{ padding: '7px 14px', background: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '11.5px', fontWeight: 800, cursor: 'pointer' }}
                >
                  Marcar
                </button>
              </form>

              {/* Packages Checklist */}
              <div>
                <span style={{ display: 'block', fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#334155', marginBottom: '6px' }}>
                  Lista de Paquetes en Anaqueles:
                </span>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  {(activePickingOrden.paquetes_data || []).map((p, idx) => {
                    const isChecked = Boolean(pickingChecks[p.numeroReciboBodega]);
                    return (
                      <div
                        key={idx}
                        onClick={() => handleToggleWrCheck(p.numeroReciboBodega)}
                        style={{
                          padding: '10px 12px',
                          borderBottom: idx === (activePickingOrden.paquetes_data || []).length - 1 ? 'none' : '1px solid #f1f5f9',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                          background: isChecked ? '#ecfdf5' : '#ffffff'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '4px',
                              border: isChecked ? '1px solid #10b981' : '1px solid #cbd5e1',
                              background: isChecked ? '#10b981' : '#ffffff',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              flexShrink: 0
                            }}
                          >
                            {isChecked && <Check style={{ width: '13px', height: '13px', strokeWidth: 3 }} />}
                          </div>

                          <div>
                            <div style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '13px', color: '#0f172a' }}>
                              {p.numeroReciboBodega}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>
                              {p.pesoKg ? `${p.pesoKg} kg` : ''} · {p.descripcion || 'Sin descripción'}
                            </div>
                          </div>
                        </div>

                        <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '11.5px', fontFamily: 'monospace', fontWeight: 900, background: '#faf5ff', color: '#7e22ce', border: '1px solid #f3e8ff' }}>
                          📍 {p.posicionEstante || 'A1-P1'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Handover Recipient Info */}
              <div style={{ padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <User style={{ width: '13px', height: '13px' }} />
                  Datos de Quien Recibe en Mostrador
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: '#64748b', marginBottom: '2px' }}>Nombre Completo</label>
                    <input
                      type="text"
                      value={receptorForm.nombre}
                      onChange={e => setReceptorForm({ ...receptorForm, nombre: e.target.value })}
                      style={{ width: '100%', padding: '6px 10px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11.5px', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: '#64748b', marginBottom: '2px' }}>DNI / Documento</label>
                    <input
                      type="text"
                      value={receptorForm.documento}
                      onChange={e => setReceptorForm({ ...receptorForm, documento: e.target.value })}
                      style={{ width: '100%', padding: '6px 10px', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '11.5px', fontFamily: 'monospace', fontWeight: 700, outline: 'none' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '10px 18px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setActivePickingOrden(null)}
                style={{ padding: '7px 14px', fontSize: '12px', fontWeight: 700, color: '#64748b', background: 'transparent', border: 'none', cursor: 'pointer' }}
              >
                Cerrar
              </button>

              <button
                type="button"
                onClick={handleCompleteDelivery}
                style={{ padding: '8px 16px', background: '#059669', color: '#ffffff', border: 'none', borderRadius: '10px', fontSize: '12px', fontWeight: 900, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 6px rgba(5,150,105,0.25)' }}
              >
                <CheckCircle2 style={{ width: '15px', height: '15px' }} />
                <span>Confirmar Entrega Física</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
